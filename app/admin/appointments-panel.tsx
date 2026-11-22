"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";

export type Appointment = {
  id: string;
  customerName: string;
  customerPhone: string;
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
};

type Props = {
  onAppointmentsChange: (appointments: Appointment[]) => void;
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
      value.status === "cancelled")
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

export default function AppointmentsPanel({ onAppointmentsChange }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [whatsAppFallback, setWhatsAppFallback] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

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
        setErrorMessage(
          loadedAppointments.length === snapshot.docs.length
            ? ""
            : "Existe uma reserva com formato invalido. Ela nao foi exibida; revise o documento no Firestore.",
        );
        setLoading(false);
      },
      () => {
        setErrorMessage(
          "Nao foi possivel carregar as reservas. Confira sua conexao e as regras do Firestore.",
        );
        setLoading(false);
      },
    );
  }, [onAppointmentsChange]);

  async function updateStatus(
    appointment: Appointment,
    status: "confirmed" | "cancelled",
  ) {
    const db = firestore;
    if (!db) return;
    const whatsappWindow = window.open("about:blank", "_blank");
    if (whatsappWindow) whatsappWindow.opener = null;
    setSavingId(appointment.id);
    setErrorMessage("");
    setWhatsAppFallback("");
    try {
      if (status === "cancelled") {
        const appointmentRef = doc(db, "appointments", appointment.id);
        await runTransaction(db, async (transaction) => {
          const currentAppointment = await transaction.get(appointmentRef);
          if (!currentAppointment.exists()) {
            throw new Error("APPOINTMENT_MISSING");
          }
          const currentData = parseAppointment(
            appointment.id,
            currentAppointment.data(),
          );
          if (!currentData || currentData.status === "cancelled") {
            throw new Error("APPOINTMENT_NOT_ACTIVE");
          }
          const slotRefs = currentData.slotIds.map((slotId) =>
            doc(db, "bookingSlots", slotId),
          );
          const currentSlots = await Promise.all(
            slotRefs.map((slotRef) => transaction.get(slotRef)),
          );
          currentSlots.forEach((slot, index) => {
            if (slot.exists()) transaction.delete(slotRefs[index]);
          });
          transaction.update(appointmentRef, { status: "cancelled" });
        });
      } else {
        await updateDoc(doc(db, "appointments", appointment.id), {
          status,
        });
      }
    } catch {
      whatsappWindow?.close();
      setErrorMessage(
        "Nao foi possivel atualizar esta reserva. Atualize a pagina e tente novamente.",
      );
      return;
    } finally {
      setSavingId("");
    }

    const whatsappUrl = getStatusWhatsAppUrl(appointment, status);
    if (whatsappWindow && !whatsappWindow.closed) {
      try {
        whatsappWindow.location.replace(whatsappUrl);
        return;
      } catch {
        whatsappWindow.close();
      }
    }
    setWhatsAppFallback(whatsappUrl);
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
        transaction.update(appointmentRef, {
          date: editDate,
          startTime: editTime,
          endTime: nextEndTime,
          slotIds: newSlotIds,
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
      {whatsAppFallback && (
        <p className="mt-4 rounded-lg bg-[#edf8f0] p-3 text-sm text-[#176d3e]" role="status">
          Horario alterado. Avise a cliente pelo WhatsApp:{" "}
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
                      Confirmar e avisar
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
                      : "Cancelar e avisar"}
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
