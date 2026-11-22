"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { firestore } from "./firebase";

type Service = {
  servico: string;
  preco: string;
  duracao: string;
  duracaoMinutos: number;
  imagem: string;
};

type DaySchedule = {
  open: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
};

type Professional = {
  id: string;
  name: string;
  days: number[];
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  weeklySchedule?: Record<number, DaySchedule>;
};

type Availability = {
  professionals: Professional[];
  dateOverrides?: Record<
    string,
    { closed: boolean; closedPeriod?: "morning" | "afternoon" | "evening" }
  >;
  calendarEvents?: Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
  }>;
};

type Props = {
  service: Service;
  onClose: () => void;
};

const LOCK_INTERVAL_MINUTES = 5;

const modalInputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-[#dfc6b4] bg-white px-4 text-base text-[#3e3e3e] outline-none focus:border-[#a36f5a] focus:ring-2 focus:ring-[#a36f5a]/20";

function isTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidSchedule(value: unknown): value is DaySchedule {
  return (
    typeof value === "object" &&
    value !== null &&
    "open" in value &&
    typeof value.open === "boolean" &&
    "startTime" in value &&
    isTime(value.startTime) &&
    "endTime" in value &&
    isTime(value.endTime) &&
    "breakStart" in value &&
    (value.breakStart === "" || isTime(value.breakStart)) &&
    "breakEnd" in value &&
    (value.breakEnd === "" || isTime(value.breakEnd))
  );
}

function isValidDateOverrides(value: unknown): value is Availability["dateOverrides"] {
  return (
    value === undefined ||
    (typeof value === "object" &&
      value !== null &&
      Object.entries(value).every(
        ([key, override]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(key) &&
          typeof override === "object" &&
          override !== null &&
          "closed" in override &&
          typeof override.closed === "boolean" &&
          (!("closedPeriod" in override) ||
            override.closedPeriod === "morning" ||
            override.closedPeriod === "afternoon" ||
            override.closedPeriod === "evening"),
      ))
  );
}

function isValidCalendarEvents(value: unknown): value is Availability["calendarEvents"] {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (event) =>
          typeof event === "object" &&
          event !== null &&
          "id" in event &&
          typeof event.id === "string" &&
          "title" in event &&
          typeof event.title === "string" &&
          "date" in event &&
          typeof event.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
          "startTime" in event &&
          typeof event.startTime === "string" &&
          "endTime" in event &&
          typeof event.endTime === "string" &&
          "allDay" in event &&
          typeof event.allDay === "boolean" &&
          (event.allDay ||
            (isTime(event.startTime) &&
              isTime(event.endTime) &&
              event.startTime < event.endTime)),
      ))
  );
}

function isAvailability(value: unknown): value is Availability {
  return (
    typeof value === "object" &&
    value !== null &&
    "professionals" in value &&
    Array.isArray(value.professionals) &&
    value.professionals.every(
      (professional) =>
        typeof professional === "object" &&
        professional !== null &&
        "id" in professional &&
        typeof professional.id === "string" &&
        "name" in professional &&
        typeof professional.name === "string" &&
        "days" in professional &&
        Array.isArray(professional.days) &&
        professional.days.every(
          (day: unknown) =>
            typeof day === "number" && day >= 0 && day <= 6,
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
            Object.values(professional.weeklySchedule).every(isValidSchedule))),
    ) &&
    (!("dateOverrides" in value) ||
      isValidDateOverrides(value.dateOverrides)) &&
    (!("calendarEvents" in value) ||
      isValidCalendarEvents(value.calendarEvents))
  );
}

function getSchedule(professional: Professional, date: Date): DaySchedule {
  return (
    professional.weeklySchedule?.[date.getDay()] ?? {
      open: professional.days.includes(date.getDay()),
      startTime: professional.startTime,
      endTime: professional.endTime,
      breakStart: professional.breakStart,
      breakEnd: professional.breakEnd,
    }
  );
}

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && otherStart < end;
}

function makeSlotId(professionalId: string, date: string, time: string) {
  return `${professionalId}_${date}_${time}`;
}

function getLockTimes(start: number, duration: number) {
  return Array.from(
    { length: duration / LOCK_INTERVAL_MINUTES },
    (_, index) => {
      const time = start + index * LOCK_INTERVAL_MINUTES;
      return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
    },
  );
}

function phoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function BookingModal({ service, onClose }: Props) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityError, setAvailabilityError] = useState(
    () => (firestore ? "" : "O agendamento ainda nao esta configurado."),
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());
  const [loadedSlotsKey, setLoadedSlotsKey] = useState("");
  const [slotsRefreshCount, setSlotsRefreshCount] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const dates = useMemo(() => {
    const result: Date[] = [];
    for (let offset = 0; offset < 21; offset += 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      result.push(date);
    }
    return result;
  }, []);

  useEffect(() => {
    if (!firestore) return;

    let active = true;
    getDoc(doc(firestore, "settings", "availability"))
      .then((snapshot) => {
        if (!active) return;
        if (!snapshot.exists()) {
          setAvailabilityError("A agenda ainda nao tem horarios configurados.");
          return;
        }
        const data: unknown = snapshot.data();
        if (!isAvailability(data)) {
          setAvailabilityError("A agenda ainda nao tem horarios configurados.");
          return;
        }
        setAvailability(data);
      })
      .catch(() => {
        if (active) {
          setAvailabilityError(
            "Nao foi possivel carregar os horarios. Tente novamente mais tarde.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const openDates = useMemo(
    () =>
      availability
        ? dates.filter((date) => {
            const key = dateKey(date);
            if (availability.dateOverrides?.[key]?.closed) return false;
            if (availability.calendarEvents?.some((event) => event.date === key && event.allDay)) {
              return false;
            }
            return availability.professionals.some((professional) => {
              const schedule = getSchedule(professional, date);
              return schedule.open && schedule.startTime < schedule.endTime;
            });
          })
        : [],
    [availability, dates],
  );

  const effectiveSelectedDate =
    selectedDate || (openDates.length > 0 ? dateKey(openDates[0]) : "");

  useEffect(() => {
    if (!firestore || !effectiveSelectedDate) return;

    let active = true;
    getDocs(
      query(
        collection(firestore, "bookingSlots"),
        where("date", "==", effectiveSelectedDate),
      ),
    )
      .then((snapshot) => {
        if (!active) return;
        setBookedSlotIds(new Set(snapshot.docs.map((slot) => slot.id)));
        setLoadedSlotsKey(`${effectiveSelectedDate}:${slotsRefreshCount}`);
      })
      .catch(() => {
        if (active) {
          setErrorMessage(
            "Nao foi possivel consultar os horarios ocupados. Atualize e tente novamente.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [effectiveSelectedDate, slotsRefreshCount]);

  const slotsLoaded =
    loadedSlotsKey === `${effectiveSelectedDate}:${slotsRefreshCount}`;

  const availableSlots = (() => {
    if (!availability || !effectiveSelectedDate) return [];
    const date = dateFromKey(effectiveSelectedDate);
    const professionalsForDate = availability.professionals.filter((professional) =>
      getSchedule(professional, date).open,
    );
    const blockedPeriods: Array<[number, number]> = [];
    const override = availability.dateOverrides?.[effectiveSelectedDate];
    if (override?.closed) return [];
    if (override?.closedPeriod === "morning") blockedPeriods.push([0, 12 * 60]);
    if (override?.closedPeriod === "afternoon") blockedPeriods.push([12 * 60, 18 * 60]);
    if (override?.closedPeriod === "evening") blockedPeriods.push([18 * 60, 24 * 60]);
    for (const event of availability.calendarEvents ?? []) {
      if (event.date !== effectiveSelectedDate) continue;
      if (event.allDay) return [];
      blockedPeriods.push([minutes(event.startTime), minutes(event.endTime)]);
    }

    const now = new Date();
    return Array.from({ length: 96 }, (_, index) => index * 15)
      .map((start) => ({
        start,
        label: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
      }))
      .filter(({ start }) =>
        professionalsForDate.some((professional) => {
          const schedule = getSchedule(professional, date);
          const end = start + service.duracaoMinutos;
          if (start < minutes(schedule.startTime) || end > minutes(schedule.endTime)) {
            return false;
          }
          if (
            schedule.breakStart &&
            schedule.breakEnd &&
            overlaps(start, end, minutes(schedule.breakStart), minutes(schedule.breakEnd))
          ) {
            return false;
          }
          if (blockedPeriods.some(([from, to]) => overlaps(start, end, from, to))) {
            return false;
          }
          const slotDateTime = new Date(`${effectiveSelectedDate}T${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}:00`);
          if (slotDateTime.getTime() <= now.getTime()) return false;
          const slotTimes = getLockTimes(start, service.duracaoMinutos);
          return slotTimes.every(
            (time) =>
              !bookedSlotIds.has(makeSlotId(professional.id, effectiveSelectedDate, time)),
          );
        }),
      );
  })();

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    if (
      !firestore ||
      !availability ||
      !effectiveSelectedDate ||
      !selectedStartTime
    ) {
      setErrorMessage("Escolha um dia e horario disponivel.");
      return;
    }
    const db = firestore;
    if (
      !Number.isInteger(service.duracaoMinutos) ||
      service.duracaoMinutos <= 0 ||
      service.duracaoMinutos % LOCK_INTERVAL_MINUTES !== 0
    ) {
      setErrorMessage("A duracao deste servico esta configurada incorretamente.");
      return;
    }
    const normalizedName = customerName.trim().replace(/\s+/g, " ");
    const normalizedPhone = phoneDigits(customerPhone);
    if (
      normalizedName.length < 2 ||
      normalizedName.length > 100 ||
      normalizedPhone.length < 12 ||
      normalizedPhone.length > 13
    ) {
      setErrorMessage("Informe seu nome e um numero de celular com DDD.");
      return;
    }

    const date = dateFromKey(effectiveSelectedDate);
    const professionalsForDate = availability.professionals.filter((candidate) =>
      getSchedule(candidate, date).open,
    );
    const start = minutes(selectedStartTime);
    const end = start + service.duracaoMinutos;
    const professional = professionalsForDate.find((candidate) => {
      const schedule = getSchedule(candidate, date);
      if (start < minutes(schedule.startTime) || end > minutes(schedule.endTime)) return false;
      if (
        schedule.breakStart &&
        schedule.breakEnd &&
        overlaps(start, end, minutes(schedule.breakStart), minutes(schedule.breakEnd))
      ) {
        return false;
      }
      return getLockTimes(start, service.duracaoMinutos).map((time) => {
        return !bookedSlotIds.has(makeSlotId(candidate.id, effectiveSelectedDate, time));
      }).every(Boolean);
    });
    if (!professional) {
      setErrorMessage("Esse horario acabou de ser ocupado. Escolha outro horario.");
      return;
    }

    const slotTimes = getLockTimes(start, service.duracaoMinutos);
    const appointmentRef = doc(collection(db, "appointments"));
    const slotRefs = slotTimes.map((time) =>
      doc(db, "bookingSlots", makeSlotId(professional.id, effectiveSelectedDate, time)),
    );
    const endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;

    setSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const availabilitySnapshot = await transaction.get(
          doc(db, "settings", "availability"),
        );
        const liveAvailabilityData: unknown = availabilitySnapshot.data();
        if (
          !availabilitySnapshot.exists() ||
          !isAvailability(liveAvailabilityData)
        ) {
          throw new Error("SCHEDULE_CHANGED");
        }
        const liveAvailability = liveAvailabilityData;
        const liveProfessional = liveAvailability.professionals.find(
          (candidate) => candidate.id === professional.id,
        );
        const liveSchedule = liveProfessional
          ? getSchedule(liveProfessional, date)
          : null;
        const blockedByOverride =
          liveAvailability.dateOverrides?.[effectiveSelectedDate]?.closed ||
          (liveAvailability.dateOverrides?.[effectiveSelectedDate]?.closedPeriod === "morning" &&
            overlaps(start, end, 0, 12 * 60)) ||
          (liveAvailability.dateOverrides?.[effectiveSelectedDate]?.closedPeriod === "afternoon" &&
            overlaps(start, end, 12 * 60, 18 * 60)) ||
          (liveAvailability.dateOverrides?.[effectiveSelectedDate]?.closedPeriod === "evening" &&
            end > 18 * 60);
        const blockedByEvent = (liveAvailability.calendarEvents ?? []).some((calendarEvent) => {
          if (calendarEvent.date !== effectiveSelectedDate) return false;
          if (calendarEvent.allDay) return true;
          return overlaps(
            start,
            end,
            minutes(calendarEvent.startTime),
            minutes(calendarEvent.endTime),
          );
        });
        if (
          !liveProfessional ||
          !liveSchedule?.open ||
          start < minutes(liveSchedule.startTime) ||
          end > minutes(liveSchedule.endTime) ||
          (liveSchedule.breakStart &&
            liveSchedule.breakEnd &&
            overlaps(start, end, minutes(liveSchedule.breakStart), minutes(liveSchedule.breakEnd))) ||
          blockedByOverride ||
          blockedByEvent
        ) {
          throw new Error("SCHEDULE_CHANGED");
        }
        const slotSnapshots = await Promise.all(slotRefs.map((slotRef) => transaction.get(slotRef)));
        if (slotSnapshots.some((slotSnapshot) => slotSnapshot.exists())) {
          throw new Error("SLOT_TAKEN");
        }
        slotRefs.forEach((slotRef, index) => {
          transaction.set(slotRef, {
            appointmentId: appointmentRef.id,
            professionalId: professional.id,
            date: effectiveSelectedDate,
            time: slotTimes[index],
          });
        });
        transaction.set(appointmentRef, {
          customerName: normalizedName,
          customerPhone: normalizedPhone,
          service: service.servico,
          price: service.preco,
          durationMinutes: service.duracaoMinutos,
          professionalId: professional.id,
          professionalName: professional.name,
          date: effectiveSelectedDate,
          startTime: selectedStartTime,
          endTime,
          slotIds: slotRefs.map((slotRef) => slotRef.id),
          status: "pending",
          createdAt: serverTimestamp(),
        });
      });
      setBookingComplete(true);
    } catch (error) {
      if (error instanceof Error && error.message === "SLOT_TAKEN") {
        setErrorMessage("Esse horario acabou de ser reservado. Escolha outro.");
        setSlotsRefreshCount((count) => count + 1);
      } else if (error instanceof Error && error.message === "SCHEDULE_CHANGED") {
        setErrorMessage("A agenda foi atualizada. Feche e escolha um novo horario.");
      } else {
        setErrorMessage("Nao foi possivel enviar seu pedido. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedDateObject = effectiveSelectedDate
    ? dateFromKey(effectiveSelectedDate)
    : null;
  const endMinute = selectedStartTime
    ? minutes(selectedStartTime) + service.duracaoMinutos
    : 0;
  const selectedEndTime = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
  const chosenDateLabel =
    selectedDateObject && selectedStartTime
      ? `${new Intl.DateTimeFormat("pt-BR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(selectedDateObject)} · ${selectedStartTime}–${selectedEndTime}`
      : "";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="booking-title"
        aria-modal="true"
        className="flex max-h-[92dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-[1.5rem] bg-[#f7eee8] shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between border-b border-[#dfc6b4] px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#321f18]" id="booking-title">
              {service.servico}
            </h2>
            <p className="mt-1 text-sm text-[#8e6d59]">
              {service.duracao} · {service.preco}
            </p>
          </div>
          <button
            aria-label="Fechar agendamento"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfc6b4] bg-white text-lg"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {bookingComplete ? (
            <div className="py-8 text-center">
              <h3 className="text-xl font-semibold text-[#321f18]">
                Pedido de horario enviado!
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6b625b]">
                A Maira vai confirmar o agendamento pelo WhatsApp. Seu horario fica
                reservado enquanto ela responde.
              </p>
              <button
                className="mt-6 min-h-12 w-full rounded-xl bg-[#a87551] px-5 font-semibold text-white"
                onClick={onClose}
                type="button"
              >
                Concluir
              </button>
            </div>
          ) : availabilityError ? (
            <p className="rounded-xl bg-white p-4 text-sm text-[#8c3d2c]" role="alert">
              {availabilityError}
            </p>
          ) : !availability ? (
            <p className="py-8 text-center text-sm text-[#6b625b]" role="status">
              Carregando dias e horarios disponiveis...
            </p>
          ) : (
            <>
              {!selectedStartTime ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a87551]">
                    Escolha o dia e o horario
                  </p>
                  {openDates.length === 0 ? (
                    <p className="mt-4 rounded-xl bg-white p-4 text-sm text-[#6b625b]">
                      Ainda nao ha datas abertas para agendamento.
                    </p>
                  ) : (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                      {openDates.map((openDate) => {
                        const key = dateKey(openDate);
                        const isSelected = effectiveSelectedDate === key;
                        return (
                          <button
                            aria-pressed={isSelected}
                            className={`min-w-[4.5rem] rounded-2xl border px-3 py-3 text-center ${
                              isSelected
                                ? "border-[#321f18] bg-[#321f18] text-white"
                                : "border-[#dfc6b4] bg-white text-[#321f18]"
                            }`}
                            key={key}
                            onClick={() => {
                              setSelectedStartTime("");
                              setErrorMessage("");
                              setSelectedDate(key);
                            }}
                            type="button"
                          >
                            <span className="block text-[10px] uppercase">
                              {new Intl.DateTimeFormat("pt-BR", {
                                weekday: "short",
                              }).format(openDate)}
                            </span>
                            <span className="mt-1 block font-serif text-xl font-bold">
                              {openDate.getDate()}
                            </span>
                            <span className="block text-[10px]">
                              {new Intl.DateTimeFormat("pt-BR", {
                                month: "short",
                              }).format(openDate)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {effectiveSelectedDate && (
                    <>
                      <p className="mt-4 text-sm font-medium capitalize text-[#6b625b]">
                        {new Intl.DateTimeFormat("pt-BR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        }).format(dateFromKey(effectiveSelectedDate))}
                      </p>
                      {!slotsLoaded ? (
                        <p className="mt-4 text-sm text-[#6b625b]" role="status">
                          Conferindo horarios...
                        </p>
                      ) : availableSlots.length > 0 ? (
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {availableSlots.map((slot) => (
                            <button
                              className="min-h-12 rounded-xl border border-[#dfc6b4] bg-white px-2 font-semibold text-[#3e3e3e] hover:border-[#a87551] hover:bg-[#fffaf5]"
                              key={slot.label}
                              onClick={() => setSelectedStartTime(slot.label)}
                              type="button"
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl bg-white p-4 text-sm text-[#6b625b]">
                          Nao ha horarios livres nesta data. Escolha outro dia.
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : (
                <form className="space-y-4" onSubmit={submitBooking}>
                  <div className="rounded-xl border border-[#dfc6b4] bg-white px-4 py-3 font-semibold capitalize text-[#321f18]">
                    {chosenDateLabel}
                  </div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#765b4a]">
                    Nome completo
                    <input
                      autoComplete="name"
                      className={modalInputClass}
                      maxLength={100}
                      minLength={2}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Seu nome"
                      required
                      value={customerName}
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#765b4a]">
                    WhatsApp / telefone
                    <input
                      autoComplete="tel"
                      className={modalInputClass}
                      inputMode="tel"
                      maxLength={20}
                      minLength={10}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="(16) 99999-9999"
                      required
                      type="tel"
                      value={customerPhone}
                    />
                  </label>
                  {errorMessage && (
                    <p className="text-sm text-red-700" role="alert">
                      {errorMessage}
                    </p>
                  )}
                  <button
                    className="min-h-13 w-full rounded-xl bg-[#a87551] px-5 py-3 font-semibold text-white hover:bg-[#916444] disabled:opacity-60"
                    disabled={saving}
                    type="submit"
                  >
                    {saving ? "Enviando pedido..." : "Enviar pedido de agendamento"}
                  </button>
                  <button
                    className="min-h-11 w-full text-sm text-[#765b4a] underline"
                    onClick={() => setSelectedStartTime("")}
                    type="button"
                  >
                    ← Escolher outro horario
                  </button>
                </form>
              )}
              {errorMessage && !selectedStartTime && (
                <p className="mt-4 text-sm text-red-700" role="alert">
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
