import {
  collection, doc, getDocFromServer, getDocsFromServer, query, runTransaction,
  serverTimestamp, updateDoc, where,
} from "firebase/firestore";

function matches(appointment, notice, id) {
  return appointment && appointment.statusNoticeId === id &&
    appointment.status === notice.kind && appointment.date === notice.date &&
    appointment.startTime === notice.startTime;
}

function validRecipient(appointment) {
  return typeof appointment.customerPhone === "string" && /^55\d{10,11}$/.test(appointment.customerPhone) &&
    typeof appointment.customerName === "string" && typeof appointment.service === "string";
}

function message(appointment, kind) {
  const date = appointment.date.split("-").reverse().join("/");
  return kind === "confirmed"
    ? `Olá ${appointment.customerName}! Seu agendamento de ${appointment.service} está confirmado para ${date} às ${appointment.startTime}. Aguardamos você!`
    : `Olá ${appointment.customerName}! Seu agendamento de ${appointment.service} para ${date} às ${appointment.startTime} foi cancelado. Pedimos desculpas pelo transtorno. Se desejar, fale conosco para escolher outro horário.`;
}

export function createStatusNoticeWorker({ db, client, isRunning }) {
  let timer;
  let running;
  const settingsRef = doc(db, "settings", "reminders");

  async function processNotice(ref) {
    const claimed = await runTransaction(db, async (transaction) => {
      const noticeSnapshot = await transaction.get(ref);
      const notice = noticeSnapshot.data();
      if (!noticeSnapshot.exists() || notice.status !== "queued") return null;
      if (typeof notice.appointmentId !== "string" || !["confirmed", "cancelled"].includes(notice.kind)) {
        transaction.update(ref, { status: "needs_manual", updatedAt: serverTimestamp() });
        return null;
      }
      const [appointmentSnapshot, settingsSnapshot] = await Promise.all([
        transaction.get(doc(db, "appointments", notice.appointmentId)), transaction.get(settingsRef),
      ]);
      const appointment = appointmentSnapshot.data();
      if (!matches(appointment, notice, ref.id)) {
        transaction.update(ref, { status: "obsolete", updatedAt: serverTimestamp() });
        return null;
      }
      if (!isRunning()) return null;
      if (settingsSnapshot.data()?.automation?.statusNotices !== true || !validRecipient(appointment)) {
        transaction.update(ref, { status: "needs_manual", updatedAt: serverTimestamp() });
        return null;
      }
      transaction.update(ref, { status: "sending", updatedAt: serverTimestamp() });
      return notice;
    });
    if (!claimed) return;

    let started = false;
    try {
      const [settingsSnapshot, appointmentSnapshot, noticeSnapshot] = await Promise.all([
        getDocFromServer(settingsRef),
        getDocFromServer(doc(db, "appointments", claimed.appointmentId)),
        getDocFromServer(ref),
      ]);
      const currentNotice = noticeSnapshot.data();
      if (!noticeSnapshot.exists() || currentNotice.status !== "sending") return;
      const updatedAt = currentNotice.updatedAt?.toMillis();
      const age = Date.now() - updatedAt;
      if (!Number.isFinite(age) || age < -30000 || age >= 30000) {
        await updateDoc(ref, { status: "needs_manual", updatedAt: serverTimestamp() });
        return;
      }
      const appointment = appointmentSnapshot.data();
      if (!matches(appointment, claimed, ref.id)) {
        await updateDoc(ref, { status: "obsolete", updatedAt: serverTimestamp() });
        return;
      }
      if (!isRunning() || settingsSnapshot.data()?.automation?.statusNotices !== true || !validRecipient(appointment)) {
        await updateDoc(ref, { status: "needs_manual", updatedAt: serverTimestamp() });
        return;
      }
      let timeout;
      try {
        started = true;
        await Promise.race([
          client.sendText(`${appointment.customerPhone}@c.us`, message(appointment, claimed.kind)),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Tempo de envio excedido.")), 30000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      await updateDoc(ref, { status: "sent", updatedAt: serverTimestamp() });
    } catch (error) {
      console.error("Falha ao processar aviso de reserva:", error.message);
      try {
        await updateDoc(ref, { status: started ? "uncertain" : "needs_manual", updatedAt: serverTimestamp() });
      } catch (statusError) {
        console.error("Não foi possível registrar o resultado do aviso:", statusError.message);
      }
    }
  }

  async function tick() {
    if (!isRunning()) return;
    const snapshot = await getDocsFromServer(query(collection(db, "statusNotices"), where("status", "==", "queued")));
    for (const notice of snapshot.docs) {
      if (!isRunning()) break;
      await processNotice(notice.ref);
    }
  }

  function schedule() {
    if (running || !isRunning()) return;
    running = tick().catch((error) => {
      console.error("Falha ao verificar avisos de reservas:", error.message);
    }).finally(() => { running = undefined; });
  }

  return {
    start() { schedule(); timer = setInterval(schedule, 15000); },
    async stop() { clearInterval(timer); await running; },
    tick,
  };
}
