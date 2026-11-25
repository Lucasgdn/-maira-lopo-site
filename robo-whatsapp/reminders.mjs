import { createHash } from "node:crypto";
import {
  collection, doc, getDocs, getDocsFromServer, getDocFromServer, onSnapshot, query, runTransaction,
  serverTimestamp, updateDoc, where,
} from "firebase/firestore";

const zones = new Set(["America/Sao_Paulo", "America/Cuiaba", "America/Manaus", "America/Rio_Branco"]);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function localParts(value, zone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateKey(value, zone) {
  const p = localParts(value, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

function shiftDate(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function localTime(date, time, zone) {
  if (!datePattern.test(date) || !timePattern.test(time) || !zones.has(zone)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = localParts(instant, zone);
    const actual = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    const difference = target - actual;
    if (difference === 0) return instant;
    instant += difference;
  }
  return null;
}

export function customerDue(appointment, reminder, zone) {
  const start = localTime(appointment.date, appointment.startTime, zone);
  const amount = Number(reminder.amount);
  if (start === null || !Number.isSafeInteger(amount) || amount < 1) return null;
  if (reminder.unit === "days" && reminder.mode === "calendar") {
    if (!timePattern.test(reminder.sendTime ?? "") || amount > 365000) return null;
    const due = localTime(shiftDate(appointment.date, -amount), reminder.sendTime, zone);
    return due !== null && due < start ? due : null;
  }
  if (!["days", "hours"].includes(reminder.unit) ||
      (reminder.mode && reminder.mode !== "elapsed")) return null;
  const due = start - amount * (reminder.unit === "days" ? 86400000 : 3600000);
  return Number.isSafeInteger(due) ? due : null;
}

function timestamp(value) {
  return value && typeof value.toMillis === "function" ? value.toMillis() : NaN;
}

function validConfig(data) {
  const a = data?.automation;
  return !!a && typeof data.revision === "string" &&
    zones.has(a.timeZone) && (a.lateMinutes === "always" ||
      (/^\d+$/.test(a.lateMinutes) && Number(a.lateMinutes) <= 1440)) &&
    typeof a.newBookings === "boolean" && typeof a.summaries === "boolean" &&
    typeof a.customers === "boolean" && typeof a.newText === "string" &&
    typeof a.summaryText === "string" && typeof a.customerText === "string" &&
    Array.isArray(data.summaries) && Array.isArray(data.customerReminders) &&
    Number.isFinite(timestamp(data.updatedAt)) &&
    (!a.newBookings || (/^55\d{10,11}$/.test(data.recipientPhone) &&
      a.newText.trim() && Number.isFinite(timestamp(data.newBookingsSince)))) &&
    (!a.summaries || (/^55\d{10,11}$/.test(data.recipientPhone) && a.summaryText.trim() &&
      Number.isFinite(timestamp(data.summariesSince)))) &&
    (!a.customers || (a.customerText.trim() && Number.isFinite(timestamp(data.customersSince))));
}

function validAppointment(a) {
  return a && typeof a.customerName === "string" && typeof a.customerPhone === "string" &&
    /^55\d{10,11}$/.test(a.customerPhone) && typeof a.service === "string" &&
    typeof a.professionalName === "string" && datePattern.test(a.date) &&
    timePattern.test(a.startTime) && ["pending", "confirmed", "cancelled"].includes(a.status) &&
    (a.remindersDisabled === undefined || typeof a.remindersDisabled === "boolean");
}

function validReminder(reminder) {
  if (!reminder || typeof reminder.amount !== "string" || !/^[1-9]\d*$/.test(reminder.amount) ||
      !Number.isSafeInteger(Number(reminder.amount)) || !["hours", "days"].includes(reminder.unit) ||
      (reminder.mode !== undefined && !["elapsed", "calendar"].includes(reminder.mode))) return false;
  return reminder.mode !== "calendar" || (reminder.unit === "days" && timePattern.test(reminder.sendTime ?? ""));
}

function readAppointments(snapshot) {
  return snapshot.docs.map((item) => {
    const appointment = { ...item.data(), id: item.id };
    if (!validAppointment(appointment)) {
      throw new Error("Uma reserva tem dados inválidos. Revise as reservas no painel.");
    }
    return appointment;
  });
}

function withinWindow(due, now, minutes) {
  return Number.isFinite(due) && due <= now &&
    (minutes === "always" || now - due < Math.max(60000, Number(minutes) * 60000));
}

function formatMessage(template, appointment) {
  const fields = {
    cliente: appointment.customerName,
    servico: appointment.service,
    data: appointment.date.split("-").reverse().join("/"),
    hora: appointment.startTime,
    profissional: appointment.professionalName,
  };
  return template.replace(/\{(cliente|servico|data|hora|profissional)\}/g, (_, key) => fields[key]);
}

function summaryText(template, appointments, targetDate, summary) {
  const confirmed = appointments.filter((item) => item.status === "confirmed");
  const pending = appointments.filter((item) => item.status === "pending");
  const lines = [template, `Data: ${targetDate.split("-").reverse().join("/")}`];
  if (summary.includeConfirmed !== false) {
    lines.push(`Período dos confirmados: ${summary.startTime}–${summary.endTime}`);
  }
  if (confirmed.length) {
    lines.push("\nConfirmados:");
    confirmed.sort((a, b) => a.professionalName.localeCompare(b.professionalName) || a.startTime.localeCompare(b.startTime));
    let professional = null;
    for (const a of confirmed) {
      if (a.professionalName !== professional) {
        professional = a.professionalName;
        lines.push(`\n${professional}:`);
      }
      lines.push(`${a.startTime} — ${a.customerName} — ${a.service}`);
    }
  }
  if (pending.length) {
    lines.push("\nAguardando confirmação:");
    for (const a of pending) lines.push(`${a.startTime} — ${a.customerName} — ${a.service} — ${a.professionalName}`);
  }
  if (!confirmed.length && !pending.length) lines.push("\nNão há atendimentos para este resumo.");
  return lines.join("\n");
}

function deliveryId(parts) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function createReminderWorker({ db, client, isRunning, now = () => Date.now(), onStatus = async () => {} }) {
  let busy = false;
  let timer;
  let runningTick;
  let unsubscribe;
  let subscriptionDay;
  let cachedAppointments;
  const settingsRef = doc(db, "settings", "reminders");

  async function reportStatus(message) {
    try {
      await onStatus(message);
    } catch (error) {
      console.error("Não foi possível informar o estado dos envios ao painel:", error.message);
    }
  }

  async function send(config, candidate) {
    const deliveryRef = doc(db, "botDeliveries", deliveryId(candidate.key));
    const claimed = await runTransaction(db, async (transaction) => {
      const currentSettings = await transaction.get(settingsRef);
      const existing = await transaction.get(deliveryRef);
      if (existing.exists()) return null;
      const current = currentSettings.data();
      if (!validConfig(current) || current.revision !== config.revision ||
          !current.automation[candidate.enabled] || !isRunning() ||
          !withinWindow(candidate.due, now(), current.automation.lateMinutes)) return null;
      let appointments = [];
      if (candidate.appointmentId) {
        const snapshot = await transaction.get(doc(db, "appointments", candidate.appointmentId));
        const a = snapshot.data();
        if (!snapshot.exists() || !validAppointment(a) ||
            a.date !== candidate.appointment.date || a.startTime !== candidate.appointment.startTime ||
            (candidate.kind === "new" && (a.status !== "pending" ||
              timestamp(a.createdAt) !== candidate.due ||
              localTime(a.date, a.startTime, current.automation.timeZone) <= now())) ||
            (candidate.kind === "customer" && (a.status !== "confirmed" || a.remindersDisabled === true ||
              localTime(a.date, a.startTime, current.automation.timeZone) <= now()))) return null;
        appointments = [a];
      }
      const recipient = candidate.kind === "customer" ? appointments[0].customerPhone : current.recipientPhone;
      const text = candidate.kind === "summary"
        ? summaryText(current.automation.summaryText, appointments, candidate.targetDate, candidate.summary)
        : formatMessage(candidate.kind === "new" ? current.automation.newText : current.automation.customerText, appointments[0]);
      transaction.set(deliveryRef, {
        kind: candidate.kind, status: "sending",
        date: candidate.kind === "summary" ? candidate.targetDate : candidate.appointment.date,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      return { recipient, text };
    });
    if (!claimed) return;
    try {
      const currentSnapshot = await getDocFromServer(settingsRef);
      const current = currentSnapshot.data();
      if (!currentSnapshot.exists() || !validConfig(current) || current.revision !== config.revision ||
          !current.automation[candidate.enabled] || !isRunning() ||
          !withinWindow(candidate.due, now(), current.automation.lateMinutes)) {
        await updateDoc(deliveryRef, { status: "cancelled", updatedAt: serverTimestamp() });
        return;
      }
      let recipient = claimed.recipient;
      let text = claimed.text;
      if (candidate.appointmentId) {
        const fresh = await getDocFromServer(doc(db, "appointments", candidate.appointmentId));
        const appointment = fresh.data();
        if (!fresh.exists() || !validAppointment(appointment) ||
            appointment.date !== candidate.appointment.date || appointment.startTime !== candidate.appointment.startTime ||
            localTime(appointment.date, appointment.startTime, current.automation.timeZone) <= now() ||
            (candidate.kind === "new" && (appointment.status !== "pending" || timestamp(appointment.createdAt) !== candidate.due)) ||
            (candidate.kind === "customer" && (appointment.status !== "confirmed" || appointment.remindersDisabled === true))) {
          await updateDoc(deliveryRef, { status: "cancelled", updatedAt: serverTimestamp() });
          return;
        }
        recipient = candidate.kind === "customer" ? appointment.customerPhone : current.recipientPhone;
        text = formatMessage(candidate.kind === "new" ? current.automation.newText : current.automation.customerText, appointment);
      } else {
        const snapshot = await getDocsFromServer(query(collection(db, "appointments"), where("date", "==", candidate.targetDate)));
        const appointments = readAppointments(snapshot).filter((a) =>
          a.date === candidate.targetDate &&
          ((candidate.summary.includeConfirmed !== false && a.status === "confirmed" &&
            a.startTime >= candidate.summary.startTime && a.startTime <= candidate.summary.endTime) ||
           (candidate.summary.includePending === true && a.status === "pending")));
        if (!appointments.length && !candidate.summary.sendWhenEmpty) {
          await updateDoc(deliveryRef, { status: "cancelled", updatedAt: serverTimestamp() });
          return;
        }
        appointments.sort((a, b) => a.startTime.localeCompare(b.startTime));
        text = summaryText(current.automation.summaryText, appointments, candidate.targetDate, candidate.summary);
      }
      if (!isRunning()) {
        await updateDoc(deliveryRef, { status: "cancelled", updatedAt: serverTimestamp() });
        return;
      }
      let timeout;
      try {
        await Promise.race([
          client.sendText(`${recipient}@c.us`, text),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Tempo de envio excedido.")), 30000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      await updateDoc(deliveryRef, { status: "sent", updatedAt: serverTimestamp() });
    } catch {
      console.error("Envio com resultado incerto; não será repetido automaticamente.");
      try {
        await updateDoc(deliveryRef, { status: "uncertain", updatedAt: serverTimestamp() });
      } catch (statusError) {
        console.error("Não foi possível registrar o resultado do envio:", statusError.message);
      }
    }
  }

  async function tick() {
    if (busy || !isRunning()) return;
    busy = true;
    try {
      const snapshot = await getDocFromServer(settingsRef);
      if (!snapshot.exists()) {
        await reportStatus(null);
        return;
      }
      const config = snapshot.data();
      if (!config.automation || (!config.automation.newBookings && !config.automation.summaries && !config.automation.customers)) {
        await reportStatus(null);
        return;
      }
      if (!validConfig(config)) throw new Error("Configuração de envios inválida; nenhum envio foi realizado.");
      const a = config.automation;
      if (a.customers && !config.customerReminders.every(validReminder)) {
        throw new Error("Lembretes configurados incorretamente; revise o painel.");
      }
      const appointments = unsubscribe
        ? cachedAppointments
        : readAppointments(await getDocs(collection(db, "appointments")));
      if (!appointments) return;
      const currentTime = now();
      const candidates = [];
      for (const appointment of appointments) {
        const created = timestamp(appointment.createdAt);
        if (a.newBookings && appointment.status === "pending" && created >= timestamp(config.newBookingsSince) &&
            localTime(appointment.date, appointment.startTime, a.timeZone) > currentTime &&
            withinWindow(created, currentTime, a.lateMinutes)) {
          candidates.push({ kind: "new", enabled: "newBookings", due: created, appointmentId: appointment.id, appointment, key: ["new", appointment.id] });
        }
        if (a.customers && appointment.status === "confirmed" && appointment.remindersDisabled !== true) {
          for (const reminder of config.customerReminders) {
            const due = customerDue(appointment, reminder, a.timeZone);
            if (due !== null && due >= timestamp(config.customersSince) &&
                localTime(appointment.date, appointment.startTime, a.timeZone) > currentTime &&
                withinWindow(due, currentTime, a.lateMinutes)) {
              candidates.push({ kind: "customer", enabled: "customers", due, appointmentId: appointment.id, appointment, key: ["customer", appointment.id, appointment.date, appointment.startTime, due] });
            }
          }
        }
      }
      if (a.summaries) {
        const today = dateKey(currentTime, a.timeZone);
        for (const summary of config.summaries) {
          if (!timePattern.test(summary.sendTime) ||
              (summary.includeConfirmed !== false && (!timePattern.test(summary.startTime) ||
                !timePattern.test(summary.endTime) || summary.startTime > summary.endTime)) ||
              !["today", "tomorrow"].includes(summary.day) ||
              (summary.includeConfirmed === false && !summary.includePending)) {
            throw new Error("Resumo configurado incorretamente; revise o painel.");
          }
          for (const daysAgo of [0, 1, 2]) {
            const sendDate = shiftDate(today, -daysAgo);
            const due = localTime(sendDate, summary.sendTime, a.timeZone);
            if (due === null || due < timestamp(config.summariesSince) || !withinWindow(due, currentTime, a.lateMinutes)) continue;
            const targetDate = shiftDate(sendDate, summary.day === "tomorrow" ? 1 : 0);
            if (targetDate < today) continue;
            candidates.push({ kind: "summary", enabled: "summaries", due, summary, targetDate,
              key: ["summary", due, targetDate, summary.startTime, summary.endTime, summary.includeConfirmed !== false, summary.includePending === true] });
          }
        }
      }
      for (const candidate of candidates) {
        if (!isRunning()) break;
        await send(config, candidate);
      }
      await reportStatus(null);
    } catch (error) {
      console.error("Falha ao verificar envios:", error.message);
      await reportStatus("Falha ao verificar os envios. Confira a conexão e o servidor do robô.");
    } finally {
      busy = false;
    }
  }

  function scheduleTick() {
    if (!isRunning() || runningTick) return;
    if (unsubscribe && subscriptionDay !== dateKey(now(), "America/Sao_Paulo")) {
      unsubscribe();
      subscribe();
      return;
    }
    if (unsubscribe && !cachedAppointments) return;
    runningTick = tick().finally(() => { runningTick = undefined; });
  }

  function subscribe() {
    subscriptionDay = dateKey(now(), "America/Sao_Paulo");
    cachedAppointments = undefined;
    unsubscribe = onSnapshot(
      query(collection(db, "appointments"), where("date", ">=", subscriptionDay)),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) {
          cachedAppointments = undefined;
          void reportStatus("O robô está sem conexão com a agenda; os envios aguardam a reconexão.");
          return;
        }
        try {
          cachedAppointments = readAppointments(snapshot);
          scheduleTick();
        } catch (error) {
          cachedAppointments = undefined;
          console.error("Falha ao carregar reservas:", error.message);
          void reportStatus("Há dados inválidos na agenda. Confira as reservas no painel.");
        }
      },
      (error) => {
        cachedAppointments = undefined;
        console.error("Falha ao acompanhar reservas:", error.message);
        void reportStatus("Falha ao acompanhar a agenda. Confira a conexão e o servidor do robô.");
      },
    );
  }

  return {
    start() { subscribe(); timer = setInterval(scheduleTick, 15000); },
    async stop() { clearInterval(timer); unsubscribe?.(); await runningTick; },
    tick,
  };
}
