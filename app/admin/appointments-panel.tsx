"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";

export type Appointment = {
  id: string;
  customerName: string;
  customerPhone: string;
  remindersDisabled?: boolean;
  service: string;
  price: string;
  durationMinutes: number;
  professionalId: string;
  professionalName: string;
  date: string;
  startTime: string;
  endTime: string;
  slotIds: string[];
  status: "pending" | "confirmed" | "cancelled";
  statusNoticeId?: string | null;
};

type StatusNotice = {
  id: string;
  appointmentId: string;
  kind: "confirmed" | "cancelled";
  date: string;
  startTime: string;
  status: "queued" | "sending" | "uncertain" | "needs_manual" | "manual";
  updatedAt: Timestamp;
};

function isStatusNotice(value: unknown): value is Omit<StatusNotice, "id"> {
  return typeof value === "object" && value !== null &&
    "appointmentId" in value && typeof value.appointmentId === "string" &&
    "kind" in value && (value.kind === "confirmed" || value.kind === "cancelled") &&
    "date" in value && typeof value.date === "string" &&
    "startTime" in value && typeof value.startTime === "string" &&
    "status" in value && ["queued", "sending", "uncertain", "needs_manual", "manual"].includes(String(value.status)) &&
    "updatedAt" in value && value.updatedAt instanceof Timestamp;
}

function robotReady(value: unknown, now: number): boolean {
  if (typeof value !== "object" || value === null ||
      !("status" in value) || value.status !== "connected" ||
      !("statusNotices" in value) || value.statusNotices !== 1 ||
      !("updatedAt" in value) || !(value.updatedAt instanceof Timestamp) ||
      ("deliveryError" in value && value.deliveryError != null)) return false;
  const age = now - value.updatedAt.toMillis();
  return age >= -30000 && age < 45000;
}

type Props = {
  onAppointmentsChange: (appointments: Appointment[]) => void;
  onLoadStateChange: (state: "ready" | "error") => void;
};

type DaySchedule = {
  open: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
};

type ProfessionalSchedule = {
  id: string;
  days: number[];
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  weeklySchedule?: Record<number, DaySchedule>;
};

type Availability = {
  professionals: ProfessionalSchedule[];
  dateOverrides?: Record<
    string,
    { closed: boolean; closedPeriod?: "morning" | "afternoon" | "evening" }
  >;
  calendarEvents?: Array<{
    date: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
  }>;
};

const fieldClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-[#d9c9bc] bg-white px-3 text-[#3e3e3e]";

function isAppointment(value: unknown): value is Omit<Appointment, "id"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "customerName" in value &&
    typeof value.customerName === "string" &&
    "customerPhone" in value &&
    typeof value.customerPhone === "string" &&
    (!("remindersDisabled" in value) || typeof value.remindersDisabled === "boolean") &&
    "service" in value &&
    typeof value.service === "string" &&
    "price" in value &&
    typeof value.price === "string" &&
    "durationMinutes" in value &&
    typeof value.durationMinutes === "number" &&
    "professionalId" in value &&
    typeof value.professionalId === "string" &&
    "professionalName" in value &&
    typeof value.professionalName === "string" &&
    "date" in value &&
    typeof value.date === "string" &&
    "startTime" in value &&
    typeof value.startTime === "string" &&
    "endTime" in value &&
    typeof value.endTime === "string" &&
    "slotIds" in value &&
    Array.isArray(value.slotIds) &&
    value.slotIds.every((slotId) => typeof slotId === "string") &&
    "status" in value &&
    (value.status === "pending" ||
      value.status === "confirmed" ||
      value.status === "cancelled") &&
    (!("statusNoticeId" in value) || value.statusNoticeId === null || typeof value.statusNoticeId === "string")
  );
}

function parseAppointment(id: string, value: unknown): Appointment | null {
  if (!isAppointment(value)) return null;
  return { ...value, id };
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isAvailability(value: unknown): value is Availability {
  if (
    typeof value !== "object" ||
    value === null ||
    !("professionals" in value) ||
    !Array.isArray(value.professionals)
  ) {
    return false;
  }
  return value.professionals.every(
    (professional) =>
      typeof professional === "object" &&
      professional !== null &&
      "id" in professional &&
      typeof professional.id === "string" &&
      "days" in professional &&
      Array.isArray(professional.days) &&
      professional.days.every(
        (day: unknown) => typeof day === "number" && day >= 0 && day <= 6,
      ) &&
      "startTime" in professional &&
      isTime(professional.startTime) &&
      "endTime" in professional &&
      isTime(professional.endTime) &&
      "breakStart" in professional &&
      (professional.breakStart === "" || isTime(professional.breakStart)) &&
      "breakEnd" in professional &&
      (professional.breakEnd === "" || isTime(professional.breakEnd)) &&
      (!("weeklySchedule" in professional) ||
        (typeof professional.weeklySchedule === "object" &&
          professional.weeklySchedule !== null &&
          Object.keys(professional.weeklySchedule).length === 7 &&
          Object.keys(professional.weeklySchedule).every((day) =>
            /^[0-6]$/.test(day),
          ) &&
          Object.values(professional.weeklySchedule).every(
            (schedule) =>
              typeof schedule === "object" &&
              schedule !== null &&
              "open" in schedule &&
              typeof schedule.open === "boolean" &&
              "startTime" in schedule &&
              isTime(schedule.startTime) &&
              "endTime" in schedule &&
              isTime(schedule.endTime) &&
              "breakStart" in schedule &&
              (schedule.breakStart === "" || isTime(schedule.breakStart)) &&
              "breakEnd" in schedule &&
              (schedule.breakEnd === "" || isTime(schedule.breakEnd)),
          ))),
  ) &&
    (!("dateOverrides" in value) ||
      (typeof value.dateOverrides === "object" &&
        value.dateOverrides !== null &&
        Object.entries(value.dateOverrides).every(
          ([date, override]) =>
            /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            typeof override === "object" &&
            override !== null &&
            "closed" in override &&
            typeof override.closed === "boolean" &&
            (!("closedPeriod" in override) ||
              override.closedPeriod === "morning" ||
              override.closedPeriod === "afternoon" ||
              override.closedPeriod === "evening"),
        ))) &&
    (!("calendarEvents" in value) ||
      (Array.isArray(value.calendarEvents) &&
        value.calendarEvents.every(
          (event) =>
            typeof event === "object" &&
            event !== null &&
            "date" in event &&
            typeof event.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
            "allDay" in event &&
            typeof event.allDay === "boolean" &&
            "startTime" in event &&
            typeof event.startTime === "string" &&
            "endTime" in event &&
            typeof event.endTime === "string" &&
            (event.allDay ||
              (isTime(event.startTime) &&
                isTime(event.endTime) &&
                event.startTime < event.endTime)),
        )));
}

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function makeSlotId(professionalId: string, date: string, time: string) {
  return `${professionalId}_${date}_${time}`;
}

function getLockTimes(start: number, duration: number) {
  return Array.from({ length: duration / 5 }, (_, index) => {
    const time = start + index * 5;
    return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
  });
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && otherStart < end;
}

function getRescheduleWhatsAppUrl(
  appointment: Appointment,
  date: string,
  startTime: string,
) {
  const phone = appointment.customerPhone.replace(/\D/g, "");
  const message = `Ola ${appointment.customerName}! Seu agendamento de ${appointment.service} foi alterado para ${formatDate(date)} as ${startTime}. Aguardamos voce!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function formatDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWhatsAppUrl(appointment: Appointment) {
  const phone = appointment.customerPhone.replace(/\D/g, "");
  const message = `Ola ${appointment.customerName}! Estou entrando em contato sobre seu pedido de horario para ${appointment.service}, no dia ${formatDate(appointment.date)} as ${appointment.startTime}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getStatusWhatsAppUrl(
  appointment: Appointment,
  status: "confirmed" | "cancelled",
) {
  const phone = appointment.customerPhone.replace(/\D/g, "");
  const message =
    status === "confirmed"
      ? `Olá ${appointment.customerName}! Seu agendamento de ${appointment.service} está confirmado para ${formatDate(appointment.date)} às ${appointment.startTime}. Aguardamos você!`
      : `Olá ${appointment.customerName}! Seu agendamento de ${appointment.service} para ${formatDate(appointment.date)} às ${appointment.startTime} foi cancelado. Pedimos desculpas pelo transtorno. Se desejar, fale conosco para escolher outro horário.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getReminderWhatsAppUrl(appointment: Appointment) {
  const phone = appointment.customerPhone.replace(/\D/g, "");
  const message = `Ola ${appointment.customerName}! Passando para lembrar do seu agendamento de ${appointment.service} no dia ${formatDate(appointment.date)} as ${appointment.startTime}, com ${appointment.professionalName}. Se precisar falar comigo, responda por aqui. Ate la!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function AppointmentsPanel({ onAppointmentsChange, onLoadStateChange }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [whatsAppFallback, setWhatsAppFallback] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [notices, setNotices] = useState<StatusNotice[]>([]);
  const [noticeError, setNoticeError] = useState("");
  const [noticeBusy, setNoticeBusy] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [robotState, setRobotState] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editingId, setEditingId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!firestore) return;
    const unsubscribeSettings = onSnapshot(doc(firestore, "settings", "reminders"), { includeMetadataChanges: true },
      (snapshot) => setAutoEnabled(!snapshot.metadata.fromCache && snapshot.data()?.automation?.statusNotices === true),
      () => { setAutoEnabled(false); setNoticeError("Não foi possível verificar as configurações do robô."); });
    const unsubscribeRobot = onSnapshot(doc(firestore, "botSessions", "whatsapp"), { includeMetadataChanges: true },
      (snapshot) => setRobotState(snapshot.metadata.fromCache ? null : snapshot.data()),
      () => { setRobotState(null); setNoticeError("Não foi possível verificar a conexão do robô."); });
    const unsubscribeNotices = onSnapshot(
      query(collection(firestore, "statusNotices"), where("status", "in", ["queued", "sending", "uncertain", "needs_manual", "manual"])),
      { includeMetadataChanges: true },
      (snapshot) => {
        const entries: StatusNotice[] = [];
        for (const item of snapshot.docs) {
          if (item.metadata.hasPendingWrites) continue;
          const value = item.data();
          if (!isStatusNotice(value)) {
            setNoticeError("Há um aviso de reserva inválido. Consulte o suporte.");
            return;
          }
          entries.push({ id: item.id, ...value });
        }
        setNotices(entries);
      },
      () => setNoticeError("Não foi possível verificar os avisos automáticos de reservas."),
    );
    return () => { unsubscribeSettings(); unsubscribeRobot(); unsubscribeNotices(); };
  }, []);

  useEffect(() => {
    if (!firestore) return;
    return onSnapshot(
      collection(firestore, "appointments"),
      (snapshot) => {
        const parsedAppointments = snapshot.docs.map((appointment) =>
          parseAppointment(appointment.id, appointment.data()),
        );
        const loadedAppointments = parsedAppointments
          .filter((appointment): appointment is Appointment => appointment !== null)
          .sort((left, right) =>
            `${left.date} ${left.startTime}`.localeCompare(
              `${right.date} ${right.startTime}`,
            ),
          );
        setAppointments(loadedAppointments);
        onAppointmentsChange(loadedAppointments);
        onLoadStateChange(
          loadedAppointments.length === snapshot.docs.length ? "ready" : "error",
        );
        setErrorMessage(
          loadedAppointments.length === snapshot.docs.length
            ? ""
            : "Existe uma reserva com formato invalido. Ela nao foi exibida; revise o documento no Firestore.",
        );
        setLoading(false);
      },
      () => {
        onLoadStateChange("error");
        setErrorMessage(
          "Nao foi possivel carregar as reservas. Confira sua conexao e as regras do Firestore.",
        );
        setLoading(false);
      },
    );
  }, [onAppointmentsChange, onLoadStateChange]);

  async function toggleReminders(appointment: Appointment) {
    const db = firestore;
    if (!db) return;
    const enable = appointment.remindersDisabled === true;
    if (!window.confirm(enable ? "Reativar lembretes automáticos desta reserva?" : "Desativar lembretes automáticos desta reserva?")) return;
    setSavingId(appointment.id);
    setErrorMessage("");
    try {
      await updateDoc(doc(db, "appointments", appointment.id), { remindersDisabled: !enable });
    } catch {
      setErrorMessage("Não foi possível atualizar os lembretes. Verifique a conexão e tente novamente.");
    } finally {
      setSavingId("");
    }
  }

  async function updateStatus(
    appointment: Appointment,
    status: "confirmed" | "cancelled",
  ) {
    const db = firestore;
    if (!db) return;
    const expectAutomatic = autoEnabled && robotReady(robotState, Date.now());
    const whatsappWindow = expectAutomatic ? null : window.open("about:blank", "_blank");
    if (whatsappWindow) whatsappWindow.opener = null;
    setSavingId(appointment.id);
    setErrorMessage("");
    setWhatsAppFallback("");
    setNoticeMessage("");
    try {
      const appointmentRef = doc(db, "appointments", appointment.id);
      const noticeRef = doc(collection(db, "statusNotices"));
      const result = await runTransaction(db, async (transaction) => {
        const [currentSnapshot, settingsSnapshot, robotSnapshot] = await Promise.all([
          transaction.get(appointmentRef),
          transaction.get(doc(db, "settings", "reminders")),
          transaction.get(doc(db, "botSessions", "whatsapp")),
        ]);
        const current = currentSnapshot.exists() ? parseAppointment(appointment.id, currentSnapshot.data()) : null;
        if (!current || current.status === "cancelled" ||
            (status === "confirmed" && current.status !== "pending")) throw new Error("APPOINTMENT_NOT_ACTIVE");
        const previousRef = current.statusNoticeId ? doc(db, "statusNotices", current.statusNoticeId) : null;
        const previous = previousRef ? await transaction.get(previousRef) : null;
        if (previousRef && !previous?.exists()) throw new Error("NOTICE_MISSING");
        if (previous?.data()?.status === "sending") throw new Error("NOTICE_SENDING");
        const slotRefs = status === "cancelled" ? current.slotIds.map((id) => doc(db, "bookingSlots", id)) : [];
        const slots = await Promise.all(slotRefs.map((ref) => transaction.get(ref)));
        const automatic = settingsSnapshot.data()?.automation?.statusNotices === true &&
          robotReady(robotSnapshot.data(), Date.now());
        if (previousRef && ["queued", "needs_manual", "manual"].includes(previous?.data()?.status)) {
          transaction.update(previousRef, { status: "obsolete", updatedAt: serverTimestamp() });
        }
        slots.forEach((slot, index) => { if (slot.exists()) transaction.delete(slotRefs[index]); });
        transaction.update(appointmentRef, { status, statusNoticeId: automatic ? noticeRef.id : null });
        if (automatic) transaction.set(noticeRef, {
          appointmentId: current.id, kind: status, date: current.date, startTime: current.startTime,
          status: "queued", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        return { automatic, appointment: current };
      });
      if (result.automatic) {
        whatsappWindow?.close();
        setNoticeMessage("Reserva atualizada. Acompanhe abaixo os avisos pendentes do robô.");
        return;
      }
      const whatsappUrl = getStatusWhatsAppUrl(result.appointment, status);
      if (whatsappWindow && !whatsappWindow.closed) {
        try {
          whatsappWindow.location.replace(whatsappUrl);
          return;
        } catch {
          whatsappWindow.close();
        }
      }
      setWhatsAppFallback(whatsappUrl);
    } catch (error) {
      whatsappWindow?.close();
      setErrorMessage(
        error instanceof Error && error.message === "NOTICE_SENDING"
          ? "O robô está enviando um aviso desta reserva. Aguarde o resultado antes de alterá-la."
          : "Nao foi possivel atualizar esta reserva. Atualize a pagina e tente novamente.",
      );
    } finally {
      setSavingId("");
    }
  }

  async function handleNotice(item: StatusNotice, action: "manual" | "reviewed" | "obsolete") {
    const db = firestore;
    if (!db || noticeBusy) return;
    if ((item.status === "uncertain" || item.status === "sending") &&
        !window.confirm("O resultado é incerto. Confira a conversa no WhatsApp antes de continuar para evitar mensagens duplicadas.")) return;
    setNoticeBusy(item.id);
    setNoticeError("");
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "statusNotices", item.id);
        const [snapshot, appointmentSnapshot] = await Promise.all([
          transaction.get(ref), transaction.get(doc(db, "appointments", item.appointmentId)),
        ]);
        const current = snapshot.data();
        if (!snapshot.exists() || !isStatusNotice(current) || current.status !== item.status) throw new Error("NOTICE_CHANGED");
        const appointment = appointmentSnapshot.data();
        const matchesCurrent = appointmentSnapshot.exists() && isAppointment(appointment) &&
          appointment.statusNoticeId === item.id && appointment.status === item.kind &&
          appointment.date === item.date && appointment.startTime === item.startTime;
        if (action === "manual") {
          if (!matchesCurrent) throw new Error("NOTICE_OBSOLETE");
        }
        if (action === "obsolete" && matchesCurrent) throw new Error("NOTICE_CHANGED");
        transaction.update(ref, { status: action, updatedAt: serverTimestamp() });
      });
    } catch (error) {
      setNoticeError(error instanceof Error && error.message === "NOTICE_OBSOLETE"
        ? "A reserva mudou. Este aviso não pode ser enviado; descarte-o."
        : "Não foi possível atualizar o aviso. Aguarde e tente novamente.");
    } finally {
      setNoticeBusy("");
    }
  }

  function startEditing(appointment: Appointment) {
    setEditingId(appointment.id);
    setEditDate(appointment.date);
    setEditTime(appointment.startTime);
    setErrorMessage("");
    setWhatsAppFallback("");
  }

  async function saveReschedule(appointment: Appointment) {
    const db = firestore;
    if (!db) return;
    const start = isTime(editTime) ? minutes(editTime) : -1;
    const end = start + appointment.durationMinutes;
    const [year, month, day] = editDate.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day, 12);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(editDate) ||
      Number.isNaN(selectedDate.getTime()) ||
      getLocalDateKey(selectedDate) !== editDate ||
      editDate < getLocalDateKey() ||
      start < 0 ||
      start % 5 !== 0 ||
      end > 24 * 60 ||
      appointment.durationMinutes <= 0 ||
      appointment.durationMinutes % 5 !== 0
    ) {
      setErrorMessage("Informe uma data e horario validos em intervalos de 5 minutos.");
      return;
    }

    const newSlotTimes = getLockTimes(start, appointment.durationMinutes);
    const newSlotIds = newSlotTimes.map((time) =>
      makeSlotId(appointment.professionalId, editDate, time),
    );
    const appointmentRef = doc(db, "appointments", appointment.id);
    const availabilityRef = doc(db, "settings", "availability");
    const existingSlotRefs = appointment.slotIds.map((slotId) =>
      doc(db, "bookingSlots", slotId),
    );
    const newSlotRefs = newSlotIds.map((slotId) =>
      doc(db, "bookingSlots", slotId),
    );
    const allSlotRefs = new Map(
      [...existingSlotRefs, ...newSlotRefs].map((slotRef) => [slotRef.id, slotRef]),
    );
    const whatsappWindow = window.open("about:blank", "_blank");
    if (whatsappWindow) whatsappWindow.opener = null;

    setSavingId(appointment.id);
    setErrorMessage("");
    setWhatsAppFallback("");
    try {
      await runTransaction(db, async (transaction) => {
        const [currentAppointmentSnapshot, availabilitySnapshot] =
          await Promise.all([
            transaction.get(appointmentRef),
            transaction.get(availabilityRef),
          ]);
        if (!currentAppointmentSnapshot.exists()) {
          throw new Error("APPOINTMENT_MISSING");
        }
        const currentAppointment = parseAppointment(
          appointment.id,
          currentAppointmentSnapshot.data(),
        );
        if (!currentAppointment || currentAppointment.status === "cancelled") {
          throw new Error("APPOINTMENT_NOT_ACTIVE");
        }
        const previousNoticeRef = currentAppointment.statusNoticeId
          ? doc(db, "statusNotices", currentAppointment.statusNoticeId) : null;
        const previousNotice = previousNoticeRef ? await transaction.get(previousNoticeRef) : null;
        if (previousNoticeRef && !previousNotice?.exists()) throw new Error("NOTICE_MISSING");
        if (previousNotice?.data()?.status === "sending") throw new Error("NOTICE_SENDING");
        const availabilityData: unknown = availabilitySnapshot.data();
        if (!availabilitySnapshot.exists() || !isAvailability(availabilityData)) {
          throw new Error("SCHEDULE_INVALID");
        }

        const professional = availabilityData.professionals.find(
          (item) => item.id === currentAppointment.professionalId,
        );
        if (!professional) throw new Error("PROFESSIONAL_MISSING");
        const schedule =
          professional.weeklySchedule?.[selectedDate.getDay()] ?? {
            open: professional.days.includes(selectedDate.getDay()),
            startTime: professional.startTime,
            endTime: professional.endTime,
            breakStart: professional.breakStart,
            breakEnd: professional.breakEnd,
          };
        const dateOverride = availabilityData.dateOverrides?.[editDate];
        const blockedByOverride =
          dateOverride?.closed ||
          (dateOverride?.closedPeriod === "morning" &&
            overlaps(start, end, 0, 12 * 60)) ||
          (dateOverride?.closedPeriod === "afternoon" &&
            overlaps(start, end, 12 * 60, 18 * 60)) ||
          (dateOverride?.closedPeriod === "evening" && end > 18 * 60);
        const blockedByEvent = (availabilityData.calendarEvents ?? []).some(
          (event) => {
            if (event.date !== editDate) return false;
            if (event.allDay) return true;
            if (!isTime(event.startTime) || !isTime(event.endTime)) return false;
            return overlaps(
              start,
              end,
              minutes(event.startTime),
              minutes(event.endTime),
            );
          },
        );
        if (
          !schedule.open ||
          start < minutes(schedule.startTime) ||
          end > minutes(schedule.endTime) ||
          (schedule.breakStart &&
            schedule.breakEnd &&
            overlaps(
              start,
              end,
              minutes(schedule.breakStart),
              minutes(schedule.breakEnd),
            )) ||
          blockedByOverride ||
          blockedByEvent
        ) {
          throw new Error("SCHEDULE_UNAVAILABLE");
        }

        const slotSnapshots = new Map(
          await Promise.all(
            [...allSlotRefs.entries()].map(async ([slotId, slotRef]) => [
              slotId,
              await transaction.get(slotRef),
            ] as const),
          ),
        );
        if (
          newSlotIds.some((slotId) => {
            const slot = slotSnapshots.get(slotId);
            return (
              slot?.exists() &&
              slot.data().appointmentId !== currentAppointment.id
            );
          })
        ) {
          throw new Error("SLOT_TAKEN");
        }

        const nextEndTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
        if (previousNoticeRef && ["queued", "needs_manual", "manual"].includes(previousNotice?.data()?.status)) {
          transaction.update(previousNoticeRef, { status: "obsolete", updatedAt: serverTimestamp() });
        }
        transaction.update(appointmentRef, {
          date: editDate,
          startTime: editTime,
          endTime: nextEndTime,
          slotIds: newSlotIds,
          statusNoticeId: null,
        });
        for (const [slotId, slotRef] of allSlotRefs) {
          if (newSlotIds.includes(slotId)) {
            transaction.set(slotRef, {
              appointmentId: currentAppointment.id,
              professionalId: currentAppointment.professionalId,
              date: editDate,
              time: slotId.slice(slotId.lastIndexOf("_") + 1),
            });
          } else if (slotSnapshots.get(slotId)?.exists()) {
            transaction.delete(slotRef);
          }
        }
      });

      setEditingId("");
      const whatsappUrl = getRescheduleWhatsAppUrl(
        appointment,
        editDate,
        editTime,
      );
      if (whatsappWindow && !whatsappWindow.closed) {
        try {
          whatsappWindow.location.replace(whatsappUrl);
          return;
        } catch {
          whatsappWindow.close();
        }
      }
      setWhatsAppFallback(whatsappUrl);
    } catch (error) {
      whatsappWindow?.close();
      const message =
        error instanceof Error ? error.message : "RESCHEDULE_FAILED";
      setErrorMessage(
        message === "SLOT_TAKEN"
          ? "Esse horario ja foi reservado para essa profissional. Escolha outro."
          : message === "SCHEDULE_UNAVAILABLE"
            ? "A profissional nao atende nesse horario ou a agenda esta bloqueada."
            : message === "NOTICE_SENDING"
              ? "O robô está enviando um aviso desta reserva. Aguarde o resultado antes de alterá-la."
            : "Nao foi possivel alterar a reserva. Atualize a pagina e tente novamente.",
      );
    } finally {
      setSavingId("");
    }
  }

  const activeAppointments = appointments.filter(
    (appointment) => appointment.status !== "cancelled",
  );

  return (
    <section className="mt-6 rounded-2xl border border-[#e5d7cb] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Reservas dos clientes</h2>
          <p className="mt-1 text-sm text-[#6b625b]">
            Pedidos recebidos pelos cards de serviços.
          </p>
        </div>
        <p className="text-xs text-[#6b625b]">Atualiza automaticamente</p>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-lg bg-[#fff1ec] p-3 text-sm text-[#8c3d2c]" role="alert">
          {errorMessage}
        </p>
      )}
      {noticeMessage && <p className="mt-4 rounded-lg bg-[#edf8f0] p-3 text-sm text-[#176d3e]" role="status">{noticeMessage}</p>}
      {noticeError && <p className="mt-4 rounded-lg bg-[#fff1ec] p-3 text-sm text-[#8c3d2c]" role="alert">{noticeError}</p>}
      {notices.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Avisos de confirmação e cancelamento</strong>
          <p className="mt-1">Na fila não significa enviado. Se o resultado for incerto, confira a conversa antes de enviar manualmente.</p>
          <ul className="mt-2 space-y-3">
            {notices.map((item) => {
              const appointment = appointments.find((entry) => entry.id === item.appointmentId);
              const matches = appointment && appointment.statusNoticeId === item.id &&
                appointment.status === item.kind && appointment.date === item.date && appointment.startTime === item.startTime;
              const canPrepare = item.status === "queued" || item.status === "needs_manual" ||
                item.status === "uncertain" || (item.status === "sending" && now - item.updatedAt.toMillis() > 125000);
              return (
                <li key={item.id}>
                  <span>{item.kind === "confirmed" ? "Confirmação" : "Cancelamento"} — {appointment?.customerName ?? "reserva indisponível"} — {formatDate(item.date)} às {item.startTime}:{" "}
                    {item.status === "queued" ? "na fila" : item.status === "sending" ? "em processamento" :
                      item.status === "uncertain" ? "resultado incerto" : item.status === "needs_manual" ? "precisa de envio manual" : "aguardando envio manual"}
                  </span>
                  {canPrepare && matches && <button className="ml-2 min-h-10 font-semibold underline disabled:opacity-60" disabled={!!noticeBusy} onClick={() => void handleNotice(item, "manual")} type="button">Preparar envio manual</button>}
                  {item.status === "manual" && matches && <a className="ml-2 font-semibold underline" href={getStatusWhatsAppUrl(appointment, item.kind)} rel="noopener noreferrer" target="_blank">Abrir mensagem no WhatsApp</a>}
                  {(item.status === "manual" || item.status === "uncertain") && <button className="ml-2 min-h-10 font-semibold underline disabled:opacity-60" disabled={!!noticeBusy} onClick={() => void handleNotice(item, "reviewed")} type="button">Já conferi</button>}
                  {!matches && item.status !== "sending" && item.status !== "uncertain" && <button className="ml-2 min-h-10 font-semibold underline disabled:opacity-60" disabled={!!noticeBusy} onClick={() => void handleNotice(item, "obsolete")} type="button">Descartar aviso antigo</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {whatsAppFallback && (
        <p className="mt-4 rounded-lg bg-[#edf8f0] p-3 text-sm text-[#176d3e]" role="status">
          Avise a cliente pelo WhatsApp:{" "}
          <a
            className="font-semibold underline"
            href={whatsAppFallback}
            rel="noopener noreferrer"
            target="_blank"
          >
            toque aqui para abrir a mensagem
          </a>
          .
        </p>
      )}
      {loading ? (
        <p className="mt-5 text-sm text-[#6b625b]" role="status">
          Carregando reservas...
        </p>
      ) : activeAppointments.length === 0 ? (
        <p className="mt-5 rounded-xl bg-[#fffaf5] p-4 text-sm text-[#6b625b]">
          Ainda nao ha reservas de clientes.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {activeAppointments.map((appointment) => (
            <li
              className="rounded-xl border border-[#e8ddd4] bg-[#fffaf5] p-4"
              key={appointment.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#321f18]">
                    {appointment.customerName}
                  </p>
                  <p className="mt-1 text-sm text-[#6b625b]">
                    {appointment.service} · {appointment.price} ·{" "}
                    {appointment.durationMinutes} min
                  </p>
                  <p className="mt-1 text-sm text-[#6b625b]">
                    WhatsApp: +{appointment.customerPhone}
                  </p>
                  <p className="mt-1 text-xs text-[#6b625b]">
                    Lembretes automáticos: {appointment.remindersDisabled === true ? "desativados para esta reserva" : "disponíveis para esta reserva"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#5c4a3f]">
                    {formatDate(appointment.date)} · {appointment.startTime}–{appointment.endTime}
                  </p>
                  <p className="mt-1 text-xs text-[#6b625b]">
                    {appointment.professionalName} ·{" "}
                    {appointment.status === "pending"
                      ? "Aguardando contato"
                      : "Confirmado"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                      className="min-h-10 rounded-lg border border-[#7a6a5a] px-3 text-sm font-medium hover:bg-white disabled:opacity-60"
                      disabled={savingId === appointment.id}
                      onClick={() => void toggleReminders(appointment)}
                      type="button"
                    >
                      {appointment.remindersDisabled === true ? "Reativar lembretes" : "Desativar lembretes"}
                    </button>
                  <a
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#218c52] px-3 text-sm font-semibold text-white hover:bg-[#176d3e]"
                    href={getWhatsAppUrl(appointment)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    WhatsApp
                  </a>
                  {appointment.status === "confirmed" && (
                    <>
                      <a
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#218c52] px-3 text-sm font-semibold text-[#176d3e] hover:bg-[#edf8f0]"
                        href={getReminderWhatsAppUrl(appointment)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Enviar lembrete
                      </a>
                      <button
                        className="min-h-10 rounded-lg border border-[#7a6a5a] px-3 text-sm font-medium hover:bg-white disabled:opacity-60"
                        disabled={savingId === appointment.id}
                        onClick={() => startEditing(appointment)}
                        type="button"
                      >
                        Alterar data/horario
                      </button>
                    </>
                  )}
                  {appointment.status === "pending" && (
                    <button
                      className="min-h-10 rounded-lg border border-[#7a6a5a] px-3 text-sm font-medium hover:bg-white disabled:opacity-60"
                      disabled={savingId === appointment.id}
                      onClick={() => void updateStatus(appointment, "confirmed")}
                      type="button"
                    >
                      {autoEnabled && robotReady(robotState, now) ? "Confirmar e avisar pelo robô" : "Confirmar e avisar"}
                    </button>
                  )}
                  <button
                    className="min-h-10 rounded-lg border border-[#a34c38] px-3 text-sm font-medium text-[#8c3d2c] hover:bg-[#fff1ec] disabled:opacity-60"
                    disabled={savingId === appointment.id}
                    onClick={() => void updateStatus(appointment, "cancelled")}
                    type="button"
                  >
                    {savingId === appointment.id
                      ? "Salvando..."
                      : autoEnabled && robotReady(robotState, now) ? "Cancelar e avisar pelo robô" : "Cancelar e avisar"}
                  </button>
                </div>
              </div>
              {editingId === appointment.id && (
                <form
                  className="mt-4 grid gap-3 rounded-lg border border-[#e8ddd4] bg-white p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveReschedule(appointment);
                  }}
                >
                  <label className="text-sm font-medium text-[#5c4a3f]">
                    Nova data
                    <input
                      className={fieldClassName}
                      min={getLocalDateKey()}
                      onChange={(event) => setEditDate(event.target.value)}
                      required
                      type="date"
                      value={editDate}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#5c4a3f]">
                    Novo horario
                    <input
                      className={fieldClassName}
                      onChange={(event) => setEditTime(event.target.value)}
                      required
                      step={300}
                      type="time"
                      value={editTime}
                    />
                  </label>
                  <button
                    className="min-h-11 rounded-lg bg-[#7a6a5a] px-4 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={savingId === appointment.id}
                    type="submit"
                  >
                    {savingId === appointment.id ? "Salvando..." : "Salvar alteracao"}
                  </button>
                  <button
                    className="min-h-11 rounded-lg border border-[#d9c9bc] px-4 text-sm font-medium disabled:opacity-60"
                    disabled={savingId === appointment.id}
                    onClick={() => setEditingId("")}
                    type="button"
                  >
                    Voltar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
