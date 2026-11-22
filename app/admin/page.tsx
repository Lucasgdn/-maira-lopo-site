"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import AppointmentsPanel, { type Appointment } from "./appointments-panel";
import { firebaseAuth, firebaseConfigured, firestore } from "../lib/firebase";
import HelpSupport from "../components/help-support";
import { SITE_VERSION } from "../lib/site-config";

type ProfessionalSchedule = {
  id: string;
  name: string;
  days: number[];
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  weeklySchedule: Record<number, DaySchedule>;
};

type DaySchedule = {
  open: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
};

type DateOverride = {
  closed: boolean;
  label: string;
  closedPeriod?: "morning" | "afternoon" | "evening";
};

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
};

type DisplayCalendarEvent = CalendarEvent & {
  booking?: true;
};

const weekdayNames = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-[#d9c9bc] bg-white px-3 text-[#3e3e3e] outline-none focus:border-[#7a6a5a] focus:ring-2 focus:ring-[#7a6a5a]/20";

function isDaySchedule(value: unknown): value is DaySchedule {
  return (
    typeof value === "object" &&
    value !== null &&
    "open" in value &&
    typeof value.open === "boolean" &&
    "startTime" in value &&
    typeof value.startTime === "string" &&
    "endTime" in value &&
    typeof value.endTime === "string" &&
    "breakStart" in value &&
    typeof value.breakStart === "string" &&
    "breakEnd" in value &&
    typeof value.breakEnd === "string"
  );
}

function isProfessionalSchedule(value: unknown): value is Omit<ProfessionalSchedule, "weeklySchedule"> & {
  weeklySchedule?: Record<number, DaySchedule>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "days" in value &&
    Array.isArray(value.days) &&
    value.days.every((day: unknown) => typeof day === "number") &&
    "startTime" in value &&
    typeof value.startTime === "string" &&
    "endTime" in value &&
    typeof value.endTime === "string" &&
    "breakStart" in value &&
    typeof value.breakStart === "string" &&
    "breakEnd" in value &&
    typeof value.breakEnd === "string" &&
    (!("weeklySchedule" in value) ||
      (typeof value.weeklySchedule === "object" &&
        value.weeklySchedule !== null &&
        Object.keys(value.weeklySchedule).length === 7 &&
        Object.keys(value.weeklySchedule).every((day) => /^[0-6]$/.test(day)) &&
        Object.values(value.weeklySchedule).every(isDaySchedule)))
  );
}

function isDateOverrideMap(value: unknown): value is Record<string, DateOverride> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.entries(value).every(
      ([date, override]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        typeof override === "object" &&
        override !== null &&
        "closed" in override &&
        typeof override.closed === "boolean" &&
        "label" in override &&
        typeof override.label === "string" &&
        (!("closedPeriod" in override) ||
          override.closedPeriod === "morning" ||
          override.closedPeriod === "afternoon" ||
          override.closedPeriod === "evening"),
    )
  );
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "date" in value &&
    typeof value.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    "startTime" in value &&
    typeof value.startTime === "string" &&
    (value.startTime === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime)) &&
    "endTime" in value &&
    typeof value.endTime === "string" &&
    (value.endTime === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value.endTime)) &&
    "allDay" in value &&
    typeof value.allDay === "boolean"
  );
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  return start;
}

function getEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getBrazilianNationalHolidays(year: number) {
  const holidays: Record<string, string> = {
    [`${year}-01-01`]: "Confraternizacao Universal",
    [`${year}-04-21`]: "Tiradentes",
    [`${year}-05-01`]: "Dia do Trabalho",
    [`${year}-09-07`]: "Independencia do Brasil",
    [`${year}-10-12`]: "Nossa Senhora Aparecida",
    [`${year}-11-02`]: "Finados",
    [`${year}-11-15`]: "Proclamacao da Republica",
    [`${year}-11-20`]: "Dia da Consciencia Negra",
    [`${year}-12-25`]: "Natal",
  };
  const goodFriday = getEasterSunday(year);
  goodFriday.setDate(goodFriday.getDate() - 2);
  const goodFridayKey = `${goodFriday.getFullYear()}-${String(goodFriday.getMonth() + 1).padStart(2, "0")}-${String(goodFriday.getDate()).padStart(2, "0")}`;
  holidays[goodFridayKey] = "Paixao de Cristo";
  return holidays;
}

function getLegacySchedule(professional: Omit<ProfessionalSchedule, "weeklySchedule">): Record<number, DaySchedule> {
  return Object.fromEntries(
    weekdayNames.map((_, day) => [
      day,
      {
        open: professional.days.includes(day),
        startTime: professional.startTime,
        endTime: professional.endTime,
        breakStart: professional.breakStart,
        breakEnd: professional.breakEnd,
      },
    ]),
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(firebaseConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateSaveMessage, setDateSaveMessage] = useState("");
  const [professionals, setProfessionals] = useState<ProfessionalSchedule[]>([]);
  const [dateOverrides, setDateOverrides] = useState<Record<string, DateOverride>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dateOverrideLabel, setDateOverrideLabel] = useState("");
  const [bulkMondayEndTime, setBulkMondayEndTime] = useState("12:00");
  const [todayDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(todayDate);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayDate));
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("Agenda fechada");
  const [eventDate, setEventDate] = useState(toDateKey(todayDate));
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("10:00");
  const [eventAllDay, setEventAllDay] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!popoverPosition && !eventModalOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPopoverPosition(null);
        setEventModalOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [eventModalOpen, popoverPosition]);

  useEffect(() => {
    const auth = firebaseAuth;
    const db = firestore;
    if (!auth || !db) return;

    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setAuthorized(false);

      if (!currentUser) {
        setCheckingAccess(false);
        return;
      }

      try {
        const adminSnapshot = await getDoc(doc(db, "admins", currentUser.uid));
        if (!active) return;

        if (!adminSnapshot.exists() || adminSnapshot.data().active !== true) {
          await signOut(auth);
          setMessage("Esta conta nao tem permissao para acessar o painel.");
          setIsError(true);
          setCheckingAccess(false);
          return;
        }

        setAuthorized(true);
        setIsError(false);
        setMessage("");
      } catch {
        setMessage("Nao foi possivel validar o acesso. Confira as regras do Firestore.");
        setIsError(true);
      } finally {
        if (active) setCheckingAccess(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const db = firestore;
    if (!authorized || !db) return;

    let active = true;
    getDoc(doc(db, "settings", "availability"))
      .then((snapshot) => {
        if (!active || !snapshot.exists()) return;
        const savedProfessionals = snapshot.data().professionals;
        if (Array.isArray(savedProfessionals)) {
          if (!savedProfessionals.every(isProfessionalSchedule)) {
            setMessage("Os horarios salvos estao em formato invalido. Revise-os no Firestore.");
            setIsError(true);
            return;
          }
          setProfessionals(
            savedProfessionals.map((professional) => ({
              ...professional,
              weeklySchedule:
                professional.weeklySchedule ?? getLegacySchedule(professional),
            })),
          );
        }

        const savedDateOverrides = snapshot.data().dateOverrides;
        if (savedDateOverrides !== undefined) {
          if (!isDateOverrideMap(savedDateOverrides)) {
            setMessage("As excecoes de datas estao em formato invalido. Revise-as no Firestore.");
            setIsError(true);
            return;
          }
          setDateOverrides(savedDateOverrides);
        }

        const savedEvents = snapshot.data().calendarEvents;
        if (savedEvents !== undefined) {
          if (!Array.isArray(savedEvents) || !savedEvents.every(isCalendarEvent)) {
            setMessage("Os eventos da agenda estao em formato invalido. Revise-os no Firestore.");
            setIsError(true);
            return;
          }
          setCalendarEvents(savedEvents);
        }
      })
      .catch(() => {
        if (active) {
          setMessage("Nao foi possivel carregar os horarios. Verifique a conexao e as regras.");
          setIsError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [authorized]);

  function updateProfessional(
    id: string,
    updates: Partial<ProfessionalSchedule>,
  ) {
    setProfessionals((current) =>
      current.map((professional) =>
        professional.id === id ? { ...professional, ...updates } : professional,
      ),
    );
  }

  function addProfessional() {
    setProfessionals((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        days: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "18:00",
        breakStart: "",
        breakEnd: "",
        weeklySchedule: Object.fromEntries(
          weekdayNames.map((_, day) => [
            day,
            {
              open: day >= 1 && day <= 5,
              startTime: "09:00",
              endTime: "18:00",
              breakStart: "",
              breakEnd: "",
            },
          ]),
        ),
      },
    ]);
  }

  function updateProfessionalDay(
    professionalId: string,
    day: number,
    updates: Partial<DaySchedule>,
  ) {
    setProfessionals((current) =>
      current.map((professional) => {
        if (professional.id !== professionalId) return professional;
        const currentDay = professional.weeklySchedule[day];
        const nextDay = { ...currentDay, ...updates };
        const weeklySchedule = {
          ...professional.weeklySchedule,
          [day]: nextDay,
        };
        const days = weekdayNames.flatMap((_, index) =>
          weeklySchedule[index].open ? [index] : [],
        );
        return { ...professional, weeklySchedule, days };
      }),
    );
  }

  function setWeekdayOpenForAll(day: number, open: boolean) {
    setProfessionals((current) =>
      current.map((professional) => ({
        ...professional,
        days: open
          ? [...new Set([...professional.days, day])]
          : professional.days.filter((activeDay) => activeDay !== day),
        weeklySchedule: {
          ...professional.weeklySchedule,
          [day]: { ...professional.weeklySchedule[day], open },
        },
      })),
    );
  }

  function setWeekdayEndTimeForAll(day: number, endTime: string) {
    setProfessionals((current) =>
      current.map((professional) => ({
        ...professional,
        weeklySchedule: {
          ...professional.weeklySchedule,
          [day]: { ...professional.weeklySchedule[day], endTime },
        },
      })),
    );
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (!firebaseAuth) {
      setMessage("O Firebase ainda nao esta configurado.");
      setIsError(true);
      return;
    }

    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setPassword("");
    } catch {
      setMessage("Nao foi possivel entrar. Confira o e-mail e a senha.");
      setIsError(true);
    }
  }

  async function handlePasswordReset() {
    if (!firebaseAuth || !email.trim()) {
      setMessage("Informe seu e-mail para receber o link de redefinicao.");
      setIsError(true);
      return;
    }

    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setMessage("Enviamos um link de redefinicao para o seu e-mail.");
      setIsError(false);
    } catch {
      setMessage("Nao foi possivel enviar o link. Confira o e-mail informado.");
      setIsError(true);
    }
  }

  async function handleSaveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (!firestore) {
      setMessage("O Firebase ainda nao esta configurado.");
      setIsError(true);
      return;
    }

    const invalidSchedule = professionals.some((professional) => {
      const openDays = Object.values(professional.weeklySchedule).filter(
        (schedule) => schedule.open,
      );
      return (
        !professional.name.trim() ||
        openDays.some((schedule) => {
          const hasBreak = schedule.breakStart || schedule.breakEnd;
          return (
            !schedule.startTime ||
            !schedule.endTime ||
            schedule.startTime >= schedule.endTime ||
            (hasBreak &&
              (!schedule.breakStart ||
                !schedule.breakEnd ||
                schedule.breakStart >= schedule.breakEnd ||
                schedule.breakStart < schedule.startTime ||
                schedule.breakEnd > schedule.endTime))
          );
        })
      );
    });

    if (invalidSchedule) {
      setMessage("Revise os nomes, dias, horarios de atendimento e intervalos.");
      setIsError(true);
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(firestore, "settings", "availability"), {
        professionals,
        dateOverrides,
        calendarEvents,
        updatedAt: new Date().toISOString(),
      });
      setMessage("Disponibilidade salva.");
    } catch {
      setMessage("Nao foi possivel salvar. Confira as regras do Firestore.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    setAuthorized(false);
    setProfessionals([]);
  }

  async function saveDateOverride(
    closedPeriod: DateOverride["closedPeriod"] | "all" | null,
  ) {
    if (!firestore) {
      const errorMessage = "O Firebase ainda nao esta configurado.";
      setMessage(errorMessage);
      setDateSaveMessage(errorMessage);
      setIsError(true);
      return;
    }

    if (!selectedDate) return;

    const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    const holidayName =
      getBrazilianNationalHolidays(selectedDate.getFullYear())[dateKey];
    const nextOverrides = { ...dateOverrides };
    if (closedPeriod === null) {
      delete nextOverrides[dateKey];
    } else {
      nextOverrides[dateKey] = {
        closed: closedPeriod === "all",
        ...(closedPeriod !== "all" ? { closedPeriod } : {}),
        label:
          dateOverrideLabel.trim() ||
          holidayName ||
          (closedPeriod === "all"
            ? "Agenda fechada"
            : closedPeriod === "morning"
              ? "Manha fechada"
              : closedPeriod === "afternoon"
                ? "Tarde fechada"
                : "Noite fechada"),
      };
    }

    setSaving(true);
    setDateSaveMessage("");
    setMessage("");
    setIsError(false);
    try {
      await setDoc(
        doc(firestore, "settings", "availability"),
        { dateOverrides: nextOverrides, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setDateOverrides(nextOverrides);
      setDateOverrideLabel(nextOverrides[dateKey]?.label ?? "");
      setMessage(
        closedPeriod === null
          ? "Fechamento removido. A rotina semanal voltou a valer nessa data."
          : "Alteracao da data salva.",
      );
      setDateSaveMessage(
        closedPeriod === null
          ? "Fechamento removido. A rotina semanal voltou a valer nesta data."
          : "Pronto, a alteracao desta data foi salva.",
      );
    } catch {
      const errorMessage =
        "Nao foi possivel salvar. Confira a conexao e as regras do Firestore.";
      setMessage(errorMessage);
      setDateSaveMessage(errorMessage);
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function removeDateOverride(dateKey: string) {
    if (!firestore) {
      setMessage("O Firebase ainda nao esta configurado.");
      setIsError(true);
      return;
    }

    const nextOverrides = { ...dateOverrides };
    delete nextOverrides[dateKey];
    setSaving(true);
    setDateSaveMessage("");
    setMessage("");
    setIsError(false);
    try {
      await setDoc(
        doc(firestore, "settings", "availability"),
        { dateOverrides: nextOverrides, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setDateOverrides(nextOverrides);
      setDateOverrideLabel("");
      setMessage("Fechamento removido. A rotina semanal voltou a valer nessa data.");
      setDateSaveMessage("Fechamento removido. A rotina semanal voltou a valer nessa data.");
    } catch {
      const errorMessage =
        "Nao foi possivel remover o fechamento. Confira a conexao e as regras do Firestore.";
      setMessage(errorMessage);
      setDateSaveMessage(errorMessage);
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  function openNewEvent(date: Date, startTime = "09:00") {
    const [hour, minute] = startTime.split(":").map(Number);
    const end = new Date(2000, 0, 1, hour + 1, minute);
    setEventTitle("Agenda fechada");
    setEventDate(toDateKey(date));
    setEventStartTime(startTime);
    setEventEndTime(
      `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
    );
    setEventAllDay(false);
    setEventModalOpen(true);
    setPopoverPosition(null);
  }

  function navigateWeek(offset: number) {
    const nextWeek = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + offset * 7,
    );
    setWeekStart(nextWeek);
    setSelectedDate(nextWeek);
  }

  async function saveCalendarEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firestore) {
      setMessage("O Firebase ainda nao esta configurado.");
      setIsError(true);
      return;
    }

    if (
      !eventTitle.trim() ||
      (!eventAllDay &&
        (!eventStartTime ||
          !eventEndTime ||
          eventStartTime < "08:00" ||
          eventEndTime > "20:00" ||
          eventStartTime >= eventEndTime))
    ) {
      setMessage("Informe um titulo e um horario entre 08:00 e 20:00.");
      setIsError(true);
      return;
    }

    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: eventTitle.trim(),
      date: eventDate,
      startTime: eventAllDay ? "" : eventStartTime,
      endTime: eventAllDay ? "" : eventEndTime,
      allDay: eventAllDay,
    };
    const nextEvents = [...calendarEvents, newEvent];

    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      await setDoc(
        doc(firestore, "settings", "availability"),
        { calendarEvents: nextEvents, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setCalendarEvents(nextEvents);
      setEventModalOpen(false);
      setSelectedDate(dateFromKey(eventDate));
      setWeekStart(getWeekStart(dateFromKey(eventDate)));
      setMessage("Evento salvo na agenda.");
    } catch {
      setMessage("Nao foi possivel salvar o evento. Confira a conexao e as regras.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCalendarEvent(eventId: string) {
    if (!firestore) {
      setMessage("O Firebase ainda nao esta configurado.");
      setIsError(true);
      return;
    }
    const nextEvents = calendarEvents.filter((event) => event.id !== eventId);
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      await setDoc(
        doc(firestore, "settings", "availability"),
        { calendarEvents: nextEvents, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setCalendarEvents(nextEvents);
      setMessage("Evento removido da agenda.");
    } catch {
      setMessage("Nao foi possivel remover o evento. Confira a conexao e as regras.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  function changeMonth(offset: number) {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + offset,
      1,
    );
    setCurrentMonth(nextMonth);
    setSelectedDate(
      nextMonth < new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
        ? null
        : nextMonth,
    );
  }

  function openDatePopover(date: Date, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    const popoverWidth = Math.min(352, window.innerWidth - 32);
    const popoverHeight = 500;
    const left = Math.max(
      16,
      Math.min(rect.left, window.innerWidth - popoverWidth - 16),
    );
    const top =
      rect.bottom + popoverHeight + 16 <= window.innerHeight
        ? rect.bottom + 8
        : Math.max(16, rect.top - popoverHeight - 8);

    setSelectedDate(date);
    setDateOverrideLabel(
      dateOverrides[
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      ]?.label ?? "",
    );
    setDateSaveMessage("");
    setPopoverPosition({ top, left });
  }

  const firstDayOffset = (currentMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();
  const calendarDays = Array.from(
    { length: Math.ceil((firstDayOffset + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - firstDayOffset + 1;
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      return date.getMonth() === currentMonth.getMonth() ? date : null;
    },
  );
  const selectedDaySchedules = selectedDate
    ? professionals.filter((professional) =>
        professional.weeklySchedule[selectedDate.getDay()]?.open,
      )
    : [];
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const weekRangeLabel = `${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(weekDays[0])} – ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(weekDays[6])}`;
  const compactWeekRangeLabel = `${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(weekDays[0])}–${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(weekDays[6])}${weekDays[0].getFullYear() !== weekDays[6].getFullYear() ? `/${new Intl.DateTimeFormat("pt-BR", { year: "2-digit" }).format(weekDays[6])}` : ""}`;
  const visibleHours = Array.from({ length: 13 }, (_, index) => index + 8);

  function getEventsForDay(date: Date) {
    const dateKey = toDateKey(date);
    const events: DisplayCalendarEvent[] = calendarEvents.filter(
      (event) => event.date === dateKey,
    );
    appointments
      .filter(
        (appointment) =>
          appointment.date === dateKey && appointment.status !== "cancelled",
      )
      .forEach((appointment) => {
        events.push({
          id: `appointment-${appointment.id}`,
          title: `${appointment.service} · ${appointment.customerName}`,
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          allDay: false,
          booking: true,
        });
      });
    const override = dateOverrides[dateKey];
    if (override?.closed) {
      events.push({
        id: `closed-${dateKey}`,
        title: override.label || "Agenda fechada",
        date: dateKey,
        startTime: "",
        endTime: "",
        allDay: true,
      });
    } else if (override?.closedPeriod) {
      const periodTimes = {
        morning: ["08:00", "12:00"],
        afternoon: ["12:00", "18:00"],
        evening: ["18:00", "20:00"],
      } as const;
      const [startTime, endTime] = periodTimes[override.closedPeriod];
      events.push({
        id: `closed-${dateKey}`,
        title: override.label || "Agenda fechada",
        date: dateKey,
        startTime,
        endTime,
        allDay: false,
      });
    }
    return events;
  }

  return (
    <main className="min-h-screen bg-[#f5ebe0] px-4 py-10 text-[#3e3e3e] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-[#7a6a5a] hover:underline">
          Voltar ao site
        </Link>
        <header className="mb-8 mt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#a36f5a]">
            Maira Lopo
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Painel administrativo</h1>
          <p className="mt-2 text-[#6b625b]">
            Gerencie quem atende e os horarios semanais disponiveis.
          </p>
        </header>

        <HelpSupport area="admin" />

        {!firebaseConfigured ? (
          <section className="rounded-2xl border border-[#e5d7cb] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold">Firebase ainda nao configurado</h2>
            <p className="mt-3 leading-relaxed text-[#6b625b]">
              Para ativar o login e salvar os horarios, crie o projeto Firebase e siga o
              guia <strong>FIREBASE-SETUP.md</strong>. Nenhuma senha sera armazenada neste site.
            </p>
          </section>
        ) : checkingAccess ? (
          <p role="status" className="rounded-xl bg-white p-6">Verificando acesso...</p>
        ) : !authorized ? (
          <form
            onSubmit={handleLogin}
            className="max-w-lg rounded-2xl border border-[#e5d7cb] bg-white p-6 shadow-sm sm:p-8"
          >
            <h2 className="text-xl font-semibold">Entrar</h2>
            <label className="mt-5 block text-sm font-medium" htmlFor="admin-email">
              E-mail
              <input
                autoComplete="username"
                className={inputClassName}
                id="admin-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="mt-4 block text-sm font-medium" htmlFor="admin-password">
              Senha
              <input
                autoComplete="current-password"
                className={inputClassName}
                id="admin-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button
              className="mt-6 min-h-12 w-full rounded-full bg-[#7a6a5a] px-6 py-3 font-semibold text-white hover:bg-[#655648]"
              type="submit"
            >
              Entrar no painel
            </button>
            <button
              className="mt-4 w-full py-2 text-sm font-medium text-[#7a6a5a] underline"
              onClick={handlePasswordReset}
              type="button"
            >
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <section className="rounded-2xl border border-[#e5d7cb] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col justify-between gap-4 border-b border-[#e8ddd4] pb-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold">Agenda semanal</h2>
                <p className="mt-1 text-sm text-[#6b625b]">
                  Crie eventos para bloquear um dia inteiro ou um periodo.
                </p>
              </div>
              <button
                className="min-h-11 rounded-full border border-[#7a6a5a] px-5 py-2 text-sm font-semibold text-[#5c4a3f] hover:bg-[#f5ebe0]"
                onClick={handleLogout}
                type="button"
              >
                Sair
              </button>
            </div>

            <AppointmentsPanel onAppointmentsChange={setAppointments} />

            <section className="mt-6 overflow-hidden rounded-2xl border border-[#e5d7cb] bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#e8ddd4] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <button
                  className="min-h-11 self-start rounded-lg bg-[#7a35a8] px-4 py-2 font-semibold text-white hover:bg-[#642890]"
                  onClick={() =>
                    openNewEvent(selectedDate ?? weekStart)
                  }
                  type="button"
                >
                  + Novo evento
                </button>
                <div className="flex w-full min-w-0 items-center gap-1 sm:w-auto sm:gap-2">
                  <button
                    className="min-h-10 shrink-0 rounded-lg border border-[#d9c9bc] px-3 text-sm font-medium hover:bg-[#fffaf5]"
                      onClick={() => {
                        setWeekStart(getWeekStart(todayDate));
                        setSelectedDate(todayDate);
                      }}
                    type="button"
                  >
                    Hoje
                  </button>
                  <button
                    aria-label="Semana anterior"
                    className="h-10 w-10 shrink-0 rounded-lg border border-[#d9c9bc] text-lg hover:bg-[#fffaf5]"
                    onClick={() => navigateWeek(-1)}
                    type="button"
                  >
                    ‹
                  </button>
                  <h3 className="min-w-0 flex-1 text-center text-xs font-semibold capitalize sm:min-w-40 sm:flex-none sm:text-base">
                    <span className="sm:hidden">{compactWeekRangeLabel}</span>
                    <span className="hidden sm:inline">{weekRangeLabel}</span>
                  </h3>
                  <button
                    aria-label="Proxima semana"
                    className="h-10 w-10 shrink-0 rounded-lg border border-[#d9c9bc] text-lg hover:bg-[#fffaf5]"
                    onClick={() => navigateWeek(1)}
                    type="button"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="border-b border-[#e8ddd4] md:hidden">
              <div className="grid grid-cols-7">
                {weekDays.map((date) => {
                  const isSelected =
                    selectedDate !== null &&
                    toDateKey(selectedDate) === toDateKey(date);
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-16 border-r border-[#e8ddd4] px-1 text-center ${
                        isSelected
                          ? "bg-[#f0dfcc] font-semibold text-[#3e3e3e]"
                          : "bg-white"
                      }`}
                      key={toDateKey(date)}
                      onClick={() => setSelectedDate(date)}
                      type="button"
                    >
                      <span className="block text-[10px] capitalize text-[#6b625b]">
                        {new Intl.DateTimeFormat("pt-BR", {
                          weekday: "short",
                        }).format(date)}
                      </span>
                      <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm">
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedDate && (
                <div className="border-t border-[#e8ddd4] bg-[#fffaf5] px-4 py-3">
                  <h3 className="font-semibold capitalize">
                    {new Intl.DateTimeFormat("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(selectedDate)}
                  </h3>
                  {getBrazilianNationalHolidays(selectedDate.getFullYear())[
                    toDateKey(selectedDate)
                  ] && (
                    <p className="mt-1 text-xs font-medium text-[#a34c38]">
                      {
                        getBrazilianNationalHolidays(selectedDate.getFullYear())[
                          toDateKey(selectedDate)
                        ]
                      }
                    </p>
                  )}
                  {getEventsForDay(selectedDate)
                    .filter((event) => event.allDay)
                    .map((event) => (
                      <div
                        className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#eeddf8] px-3 py-2 text-sm text-[#542478]"
                        key={event.id}
                      >
                        <span className="font-medium">{event.title}</span>
                        {event.id.startsWith("closed-") ? (
                          <button
                            className="min-h-8 rounded px-2 text-xs font-semibold underline"
                            disabled={saving}
                            onClick={() => void removeDateOverride(event.date)}
                            type="button"
                          >
                            Reabrir
                          </button>
                        ) : (
                          <button
                            aria-label={`Excluir evento ${event.title}`}
                            className="min-h-8 min-w-8 rounded-full hover:bg-white/70"
                            disabled={saving}
                            onClick={() => void deleteCalendarEvent(event.id)}
                            type="button"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  <button
                    className="mt-3 min-h-10 rounded-lg bg-[#7a35a8] px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => openNewEvent(selectedDate)}
                    type="button"
                  >
                    + Novo evento
                  </button>
                </div>
              )}
              </div>

              {selectedDate && (
              <div className="divide-y divide-[#e8ddd4] md:hidden">
                {visibleHours.slice(0, -1).map((hour) => {
                  const hourLabel = `${String(hour).padStart(2, "0")}:00`;
                  const events = getEventsForDay(selectedDate).filter(
                    (event) =>
                      !event.allDay &&
                      Number(event.startTime.slice(0, 2)) === hour,
                  );
                  return (
                    <div
                      className="grid grid-cols-[52px_1fr] gap-3 p-3"
                      key={hour}
                    >
                      <span className="pt-1 text-xs text-[#8a7b6e]">
                        {hourLabel}
                      </span>
                      <div className="min-h-12 space-y-2 border-l border-[#e8ddd4] pl-3">
                        {events.map((event) => (
                          <div
                            className={`flex items-start justify-between gap-2 rounded-lg border-l-4 p-3 text-sm ${
                              event.id.startsWith("closed-")
                                ? "border-[#c66b52] bg-[#fff1ec] text-[#8c3d2c]"
                                : event.booking
                                  ? "border-[#3d8b63] bg-[#e5f3e9] text-[#245b3a]"
                                  : "border-[#7a35a8] bg-[#eeddf8] text-[#542478]"
                            }`}
                            key={event.id}
                          >
                            <div>
                              <p className="font-semibold">{event.title}</p>
                              <p className="mt-1 text-xs">
                                {event.startTime}–{event.endTime}
                              </p>
                            </div>
                            {event.id.startsWith("closed-") ? (
                              <button
                                className="min-h-8 rounded px-2 text-xs font-semibold underline"
                                disabled={saving}
                                onClick={() => void removeDateOverride(event.date)}
                                type="button"
                              >
                                Reabrir periodo
                              </button>
                            ) : event.booking ? null : (
                              <button
                                aria-label={`Excluir evento ${event.title}`}
                                className="min-h-8 min-w-8 rounded-full hover:bg-white/70"
                                disabled={saving}
                                onClick={() => void deleteCalendarEvent(event.id)}
                                type="button"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          aria-label={`Criar evento as ${hourLabel}`}
                          className="min-h-10 w-full rounded-lg border border-dashed border-[#d9c9bc] px-3 text-left text-xs text-[#6b625b] hover:bg-[#fffaf5]"
                          onClick={() => openNewEvent(selectedDate, hourLabel)}
                          type="button"
                        >
                          + Adicionar evento
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              <div className="hidden overflow-x-auto md:block">
              <div className="overflow-x-auto">
                <div className="min-w-[1050px]">
                  <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-[#e8ddd4]">
                    <div className="border-r border-[#e8ddd4]" />
                    {weekDays.map((date) => (
                      <button
                        className={`min-h-16 border-r border-[#e8ddd4] px-2 text-center hover:bg-[#fffaf5] ${
                          toDateKey(date) === todayKey ? "bg-[#f5ebe0]" : "bg-white"
                        }`}
                        key={toDateKey(date)}
                        onClick={() => setSelectedDate(date)}
                        type="button"
                      >
                        <span className="block text-xs text-[#6b625b]">
                          {new Intl.DateTimeFormat("pt-BR", {
                            weekday: "short",
                          }).format(date)}
                        </span>
                        <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold">
                          {date.getDate()}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-[#e8ddd4]">
                    <div className="flex items-center justify-end border-r border-[#e8ddd4] pr-2 text-[10px] text-[#8a7b6e]">
                      Dia todo
                    </div>
                    {weekDays.map((date) => {
                      const allDayEvents = getEventsForDay(date).filter(
                        (event) => event.allDay,
                      );
                      const holiday = getBrazilianNationalHolidays(
                        date.getFullYear(),
                      )[toDateKey(date)];
                      return (
                        <div
                          className="min-h-12 space-y-1 border-r border-[#e8ddd4] p-1"
                          key={toDateKey(date)}
                        >
                          {holiday && (
                            <div className="truncate rounded bg-[#fff1ec] px-2 py-1 text-[10px] text-[#8c3d2c]">
                              {holiday}
                            </div>
                          )}
                          {allDayEvents.map((event) => (
                            <div
                              className="flex items-center justify-between gap-1 rounded bg-[#eeddf8] px-2 py-1 text-[10px] text-[#542478]"
                              key={event.id}
                            >
                              <span className="truncate">{event.title}</span>
                              {event.id.startsWith("closed-") ? (
                                <button
                                  aria-label={`Reabrir agenda em ${event.date}`}
                                  className="shrink-0 underline"
                                  disabled={saving}
                                  onClick={() => void removeDateOverride(event.date)}
                                  type="button"
                                >
                                  Reabrir
                                </button>
                              ) : (
                                <button
                                  aria-label={`Excluir evento ${event.title}`}
                                  className="shrink-0"
                                  disabled={saving}
                                  onClick={() => deleteCalendarEvent(event.id)}
                                  type="button"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                    {visibleHours.slice(0, -1).map((hour) => (
                      <div className="contents" key={hour}>
                        <div className="h-16 border-r border-b border-[#e8ddd4] pr-2 pt-1 text-right text-xs text-[#8a7b6e]">
                          {String(hour).padStart(2, "0")}:00
                        </div>
                        {weekDays.map((date) => (
                          <div
                            className="relative h-16 border-r border-b border-[#e8ddd4] bg-white"
                            key={`${toDateKey(date)}-${hour}`}
                          >
                            <button
                              aria-label={`Criar evento ${String(hour).padStart(2, "0")}:00 em ${toDateKey(date)}`}
                              className="absolute inset-0 w-full hover:bg-[#f5ebe0]/70"
                              onClick={() => {
                                setSelectedDate(date);
                                openNewEvent(date, `${String(hour).padStart(2, "0")}:00`);
                              }}
                              type="button"
                            />
                            {getEventsForDay(date)
                              .filter((event) => !event.allDay)
                              .filter((event) => {
                                const startHour = Number(event.startTime.slice(0, 2));
                                return startHour === hour;
                              })
                              .map((event) => {
                                const startMinutes =
                                  Number(event.startTime.slice(0, 2)) * 60 +
                                  Number(event.startTime.slice(3, 5));
                                const endMinutes =
                                  Number(event.endTime.slice(0, 2)) * 60 +
                                  Number(event.endTime.slice(3, 5));
                                const top =
                                  ((startMinutes - hour * 60) / 60) * 64;
                                const height = Math.max(
                                  24,
                                  ((endMinutes - startMinutes) / 60) * 64,
                                );
                                return (
                                  <div
                                    className={`absolute left-1 right-1 z-10 overflow-hidden rounded border-l-4 px-2 py-1 text-xs ${
                                      event.id.startsWith("closed-")
                                        ? "border-[#c66b52] bg-[#fff1ec] text-[#8c3d2c]"
                                        : event.booking
                                          ? "border-[#3d8b63] bg-[#e5f3e9] text-[#245b3a]"
                                          : "border-[#7a35a8] bg-[#eeddf8] text-[#542478]"
                                    }`}
                                    key={event.id}
                                    style={{ top, height }}
                                  >
                                    <div className="flex justify-between gap-1">
                                      <span className="truncate font-medium">
                                        {event.title}
                                      </span>
                                      {event.id.startsWith("closed-") ? (
                                        <button
                                          className="shrink-0 text-[10px] underline"
                                          disabled={saving}
                                          onClick={(clickEvent) => {
                                            clickEvent.stopPropagation();
                                            void removeDateOverride(event.date);
                                          }}
                                          type="button"
                                        >
                                          Reabrir
                                        </button>
                                      ) : event.booking ? null : (
                                        <button
                                          aria-label={`Excluir evento ${event.title}`}
                                          className="shrink-0"
                                          disabled={saving}
                                          onClick={(clickEvent) => {
                                            clickEvent.stopPropagation();
                                            void deleteCalendarEvent(event.id);
                                          }}
                                          type="button"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                    <span className="text-[10px]">
                                      {event.startTime}–{event.endTime}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="border-t border-[#e8ddd4] bg-[#fffaf5] p-3 text-xs text-[#6b625b]">
                Eventos roxos sao bloqueios manuais. Reservas de clientes aparecem em verde.
              </p>
              </div>
            </section>

            <div className="hidden">
            <section
              aria-labelledby="calendar-title"
              className="mt-6 overflow-hidden rounded-2xl border border-[#e8ddd4] bg-[#fffaf5]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[#e8ddd4] px-4 py-4 sm:px-6">
                <button
                  aria-label="Mes anterior"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e2d5ca] bg-white text-xl text-[#5c4a3f] hover:bg-[#f5ebe0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a6a5a]"
                  onClick={() => changeMonth(-1)}
                  type="button"
                >
                  ‹
                </button>
                <div className="text-center">
                  <h3
                    className="text-lg font-semibold capitalize sm:text-xl"
                    id="calendar-title"
                  >
                    {new Intl.DateTimeFormat("pt-BR", {
                      month: "long",
                      year: "numeric",
                    }).format(currentMonth)}
                  </h3>
                  <p className="mt-1 text-xs text-[#6b625b]">
                    Toque em um dia para abrir as opcoes junto a data
                  </p>
                </div>
                <button
                  aria-label="Proximo mes"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e2d5ca] bg-white text-xl text-[#5c4a3f] hover:bg-[#f5ebe0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a6a5a]"
                  onClick={() => changeMonth(1)}
                  type="button"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 border-b border-[#e8ddd4] bg-white text-center text-xs font-semibold text-[#8a7b6e] sm:text-sm">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((day) => (
                  <div className="py-3" key={day}>
                    {day}
                  </div>
                ))}
              </div>

              <div
                aria-label="Calendario mensal"
                className="grid grid-cols-7 gap-px bg-[#e8ddd4]"
              >
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return (
                      <div
                        aria-hidden="true"
                        className="min-h-16 bg-white sm:min-h-24"
                        key={`empty-${index}`}
                      />
                    );
                  }

                  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const isSelected =
                    selectedDate?.getFullYear() === date.getFullYear() &&
                    selectedDate?.getMonth() === date.getMonth() &&
                    selectedDate?.getDate() === date.getDate();
                  const isPast = dateKey < todayKey;
                  const holidayName =
                    getBrazilianNationalHolidays(date.getFullYear())[dateKey];
                  const isDateClosed = dateOverrides[dateKey]?.closed === true;
                    const hasDateOverride = Boolean(dateOverrides[dateKey]);
                  const hasAvailability =
                    !isDateClosed &&
                    professionals.some(
                      (professional) =>
                        professional.weeklySchedule[date.getDay()]?.open,
                    );
                  const monthName = new Intl.DateTimeFormat("pt-BR", {
                    month: "long",
                  }).format(date);
                  const label = `${date.getDate()} de ${monthName}${holidayName ? `, feriado: ${holidayName}` : ""}${dateOverrides[dateKey]?.label ? `, ${dateOverrides[dateKey].label}` : ""}${hasAvailability ? ", atende" : ", nao atende"}${dateKey === todayKey ? ", hoje" : ""}`;

                  return (
                    <button
                      aria-label={label}
                      aria-pressed={isSelected}
                      className={`flex min-h-16 flex-col items-center justify-center gap-1 bg-white px-1 py-2 text-sm transition-colors sm:min-h-24 sm:gap-2 sm:text-base ${
                        isSelected
                          ? "z-10 bg-[#f0dfcc] font-bold text-[#3e3e3e] ring-2 ring-inset ring-[#a36f5a]"
                          : isPast
                            ? "cursor-not-allowed text-[#c2b9b1]"
                            : "text-[#3e3e3e] hover:bg-[#f5ebe0]"
                      } ${!hasAvailability && !isSelected ? "text-[#a99d93]" : ""}`}
                      disabled={isPast}
                      key={dateKey}
                      onClick={(event) => openDatePopover(date, event.currentTarget)}
                      type="button"
                    >
                      <span>{date.getDate()}</span>
                      {(hasAvailability || holidayName || hasDateOverride) && (
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${
                            isSelected
                              ? "bg-[#a36f5a]"
                              : holidayName || hasDateOverride
                                ? "bg-[#c66b52]"
                                : "bg-[#8a9b70]"
                          }`}
                        />
                      )}
                      {holidayName && (
                        <span className="max-w-full truncate text-[9px] font-medium text-[#a34c38] sm:text-[10px]">
                          Feriado
                        </span>
                      )}
                      {dateKey === todayKey && (
                        <span className="text-[10px] font-medium sm:text-xs">
                          Hoje
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e8ddd4] bg-white px-4 py-3 text-xs text-[#6b625b] sm:px-6">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#8a9b70]" />
                  Dia de atendimento
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#d9c9bc]" />
                  Dia sem atendimento
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#c66b52]" />
                  Feriado ou agenda fechada
                </span>
                <span>Feriados nacionais do Brasil; feriados locais podem ser marcados ao selecionar a data.</span>
              </div>
              {selectedDate && popoverPosition && (
                <section
                  aria-labelledby="selected-date-title"
                  aria-modal="false"
                  aria-live="polite"
                  className="fixed z-50 max-h-[calc(100vh-2rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[#dccabb] bg-[#fffaf5] p-4 shadow-2xl sm:p-5"
                  role="dialog"
                  style={{
                    left: popoverPosition.left,
                    top: popoverPosition.top,
                  }}
                >
                {(() => {
                  const selectedDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
                  const holidayName =
                    getBrazilianNationalHolidays(selectedDate.getFullYear())[
                      selectedDateKey
                    ];
                  const override = dateOverrides[selectedDateKey];
                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold capitalize sm:text-lg" id="selected-date-title">
                      {new Intl.DateTimeFormat("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }).format(selectedDate)}
                    </h3>
                    <p className="mt-1 text-xs text-[#6b625b]">
                      Edite a disponibilidade desta data
                    </p>
                  </div>
                  <button
                    aria-label="Fechar opcoes da data"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-[#5c4a3f] hover:bg-[#f0dfcc]"
                    onClick={() => setPopoverPosition(null)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                {(holidayName || override) && (
                  <p className="mt-2 text-sm font-medium text-[#a34c38]">
                    {override?.label || holidayName}
                    {override?.closedPeriod &&
                      ` · ${override.closedPeriod === "morning" ? "manha fechada" : override.closedPeriod === "afternoon" ? "tarde fechada" : "noite fechada"}`}
                    {override?.closed && " · dia inteiro fechado"}
                  </p>
                )}
                {override?.closed ? (
                  <p className="mt-3 rounded-lg bg-[#fff1ec] p-3 text-sm font-medium text-[#8c3d2c]">
                    Dia inteiro fechado.
                  </p>
                ) : selectedDaySchedules.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {selectedDaySchedules.map((professional) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f5ebe0] px-3 py-3 text-sm"
                        key={professional.id}
                      >
                        <span className="font-medium">
                          {professional.name || "Profissional"}
                        </span>
                        <span>
                          {professional.weeklySchedule[selectedDate.getDay()].startTime} as {professional.weeklySchedule[selectedDate.getDay()].endTime}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[#6b625b]">
                    Nao ha atendimento configurado para este dia.
                  </p>
                )}
                <div className="mt-5 border-t border-[#e8ddd4] pt-4">
                  <p className="font-semibold">O que deseja fazer nesta data?</p>
                  <p className="mt-1 text-xs text-[#6b625b]">
                    Manha: ate 12h. Tarde: 12h–18h. Noite: apos 18h.
                  </p>
                  <label className="block text-sm font-medium">
                    Motivo ou feriado (opcional)
                    <input
                      className={inputClassName}
                      maxLength={60}
                      onChange={(event) => setDateOverrideLabel(event.target.value)}
                      placeholder={holidayName || "Ex.: feriado municipal"}
                      value={dateOverrideLabel}
                    />
                  </label>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      className="min-h-12 rounded-xl border border-[#a34c38] bg-white px-4 py-3 text-left text-sm font-semibold text-[#8c3d2c] hover:bg-[#fff1ec] disabled:opacity-60"
                      disabled={saving}
                      onClick={() => saveDateOverride("all")}
                      type="button"
                    >
                      Fechar o dia inteiro
                    </button>
                    <button
                      className="min-h-12 rounded-xl border border-[#d9c9bc] bg-white px-4 py-3 text-left text-sm font-semibold text-[#5c4a3f] hover:bg-[#f5ebe0] disabled:opacity-60"
                      disabled={saving}
                      onClick={() => saveDateOverride("morning")}
                      type="button"
                    >
                      Fechar a manha (ate 12h)
                    </button>
                    <button
                      className="min-h-12 rounded-xl border border-[#d9c9bc] bg-white px-4 py-3 text-left text-sm font-semibold text-[#5c4a3f] hover:bg-[#f5ebe0] disabled:opacity-60"
                      disabled={saving}
                      onClick={() => saveDateOverride("afternoon")}
                      type="button"
                    >
                      Fechar a tarde (12h–18h)
                    </button>
                    <button
                      className="min-h-12 rounded-xl border border-[#d9c9bc] bg-white px-4 py-3 text-left text-sm font-semibold text-[#5c4a3f] hover:bg-[#f5ebe0] disabled:opacity-60"
                      disabled={saving}
                      onClick={() => saveDateOverride("evening")}
                      type="button"
                    >
                      Fechar a noite (apos 18h)
                    </button>
                  </div>
                  {override && (
                    <button
                      className="mt-3 min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-[#5c4a3f] underline hover:bg-white disabled:opacity-60"
                      disabled={saving}
                      onClick={() => saveDateOverride(null)}
                      type="button"
                    >
                      Reabrir o dia e remover excecao
                    </button>
                  )}
                  {saving && (
                    <p className="mt-3 text-sm text-[#6b625b]" role="status">
                      Salvando alteracao...
                    </p>
                  )}
                  {dateSaveMessage && !saving && (
                    <p
                      aria-live="polite"
                      className={`mt-3 text-sm ${isError ? "text-red-700" : "text-green-800"}`}
                      role={isError ? "alert" : "status"}
                    >
                      {dateSaveMessage}
                    </p>
                  )}
                </div>
                    </>
                  );
                })()}
                </section>
              )}
            </section>
            </div>

            {eventModalOpen && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setEventModalOpen(false);
                  }
                }}
              >
                <form
                  aria-labelledby="new-event-title"
                  className="w-full max-w-xl overflow-hidden rounded-xl border border-[#d8d8d8] bg-white shadow-2xl"
                  onSubmit={saveCalendarEvent}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between bg-[#f3f2f1] px-5 py-4">
                    <h2 className="text-lg font-semibold" id="new-event-title">
                      Novo evento
                    </h2>
                    <button
                      aria-label="Fechar novo evento"
                      className="rounded px-2 py-1 text-xl hover:bg-[#e6e3e1]"
                      onClick={() => setEventModalOpen(false)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <div className="space-y-5 p-5">
                    <label className="block text-sm font-medium">
                      Titulo do evento
                      <input
                        autoFocus
                        className={inputClassName}
                        maxLength={80}
                        onChange={(event) => setEventTitle(event.target.value)}
                        placeholder="Ex.: Agenda fechada"
                        required
                        value={eventTitle}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Data
                      <input
                        className={inputClassName}
                        onChange={(event) => setEventDate(event.target.value)}
                        required
                        type="date"
                        value={eventDate}
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                      <input
                        checked={eventAllDay}
                        onChange={(event) => setEventAllDay(event.target.checked)}
                        type="checkbox"
                      />
                      Dia inteiro
                    </label>
                    {!eventAllDay && (
                      <div className="grid grid-cols-2 gap-4">
                        <label className="text-sm font-medium">
                          Inicio
                          <input
                            className={inputClassName}
                            onChange={(event) => setEventStartTime(event.target.value)}
                            required
                            type="time"
                            value={eventStartTime}
                          />
                        </label>
                        <label className="text-sm font-medium">
                          Fim
                          <input
                            className={inputClassName}
                            onChange={(event) => setEventEndTime(event.target.value)}
                            required
                            type="time"
                            value={eventEndTime}
                          />
                        </label>
                      </div>
                    )}
                    <p className="rounded-lg bg-[#fff8ed] p-3 text-xs text-[#6b625b]">
                      Este evento bloqueia um periodo na agenda da Maira. Ele nao e um
                      agendamento de cliente.
                    </p>
                  </div>
                  <div className="flex justify-end gap-3 border-t border-[#e8ddd4] bg-[#fffaf5] px-5 py-4">
                    <button
                      className="min-h-11 rounded-lg border border-[#d9c9bc] px-4 font-medium hover:bg-white"
                      onClick={() => setEventModalOpen(false)}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      className="min-h-11 rounded-lg bg-[#7a35a8] px-5 font-semibold text-white hover:bg-[#642890] disabled:opacity-60"
                      disabled={saving}
                      type="submit"
                    >
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <aside
              aria-labelledby="booking-status-title"
              className="mt-4 rounded-xl border border-[#e7cda9] bg-[#fff8ed] p-4 sm:p-5"
            >
              <h3 className="font-semibold text-[#6b4d2e]" id="booking-status-title">
                Este calendario mostra apenas os dias de atendimento
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6b625b]">
                As reservas de clientes ainda nao estao ativadas. Por isso, ele nao mostra
                horarios ocupados nem confirma horarios livres para agendamento.
              </p>
            </aside>

            <details className="mt-6 rounded-xl border border-[#e8ddd4] bg-white">
              <summary className="cursor-pointer rounded-xl px-4 py-4 font-semibold text-[#5c4a3f] hover:bg-[#fffaf5] sm:px-5">
                Editar horarios de atendimento
              </summary>
              <form
                className="border-t border-[#e8ddd4] p-4 sm:p-5"
                onSubmit={handleSaveSchedule}
              >
              <div className="mb-5 rounded-xl bg-[#fffaf5] p-4">
                <h3 className="font-semibold">Atalhos semanais</h3>
                <p className="mt-1 text-sm text-[#6b625b]">
                  Feche domingos de uma vez. Para fechar so a tarde de segunda, ajuste o
                  fim do atendimento de segunda para 12:00.
                </p>
                <p className="mt-1 text-sm font-medium text-[#6b625b]">
                  As mudancas semanais so entram em vigor depois de clicar em “Salvar disponibilidade”.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="min-h-10 rounded-full border border-[#d9c9bc] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f5ebe0]"
                    onClick={() => setWeekdayOpenForAll(0, false)}
                    type="button"
                  >
                    Fechar todos os domingos
                  </button>
                  <button
                    className="min-h-10 rounded-full border border-[#d9c9bc] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f5ebe0]"
                    onClick={() => setWeekdayOpenForAll(0, true)}
                    type="button"
                  >
                    Abrir domingos
                  </button>
                  <label className="flex items-center gap-2 text-sm">
                    Segunda ate
                    <input
                      aria-label="Horario para encerrar as segundas-feiras"
                      className="min-h-10 rounded-lg border border-[#d9c9bc] bg-white px-2"
                      onChange={(event) => setBulkMondayEndTime(event.target.value)}
                      type="time"
                      value={bulkMondayEndTime}
                    />
                    <button
                      className="min-h-10 rounded-full border border-[#d9c9bc] bg-white px-4 py-2 font-medium hover:bg-[#f5ebe0]"
                      onClick={() => setWeekdayEndTimeForAll(1, bulkMondayEndTime)}
                      type="button"
                    >
                      Aplicar a todas
                    </button>
                  </label>
                </div>
              </div>
              {professionals.length === 0 ? (
                <p className="rounded-xl bg-[#fffaf5] p-5 text-sm text-[#6b625b]">
                  Ainda nao ha profissionais cadastradas. Adicione uma para configurar os
                  horarios.
                </p>
              ) : (
                <div className="space-y-6">
                  {professionals.map((professional, index) => (
                    <fieldset
                      className="rounded-xl border border-[#e8ddd4] p-4 sm:p-5"
                      key={professional.id}
                    >
                      <legend className="px-2 font-semibold">
                        Profissional {index + 1}
                      </legend>
                      <label className="block text-sm font-medium">
                        Nome
                        <input
                          className={inputClassName}
                          onChange={(event) =>
                            updateProfessional(professional.id, { name: event.target.value })
                          }
                          required
                          value={professional.name}
                        />
                      </label>

                      <div className="mt-5 space-y-3">
                        <h3 className="text-sm font-semibold">Rotina que se repete toda semana</h3>
                        {weekdayNames.map((day, dayIndex) => {
                          const schedule = professional.weeklySchedule[dayIndex];
                          return (
                            <fieldset
                              className="rounded-xl border border-[#eee4dc] p-3 sm:p-4"
                              key={day}
                            >
                              <legend className="px-1 text-sm font-semibold">{day}</legend>
                              <label className="flex min-h-10 items-center gap-2 text-sm">
                                <input
                                  checked={schedule.open}
                                  onChange={(event) =>
                                    updateProfessionalDay(professional.id, dayIndex, {
                                      open: event.target.checked,
                                    })
                                  }
                                  type="checkbox"
                                />
                                Atender neste dia
                              </label>
                              {schedule.open && (
                                <div className="mt-2 grid grid-cols-2 gap-3">
                                  <label className="text-xs font-medium sm:text-sm">
                                    Abre
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        updateProfessionalDay(professional.id, dayIndex, {
                                          startTime: event.target.value,
                                        })
                                      }
                                      required
                                      type="time"
                                      value={schedule.startTime}
                                    />
                                  </label>
                                  <label className="text-xs font-medium sm:text-sm">
                                    Fecha
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        updateProfessionalDay(professional.id, dayIndex, {
                                          endTime: event.target.value,
                                        })
                                      }
                                      required
                                      type="time"
                                      value={schedule.endTime}
                                    />
                                  </label>
                                  <label className="text-xs font-medium sm:text-sm">
                                    Inicio do intervalo (opcional)
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        updateProfessionalDay(professional.id, dayIndex, {
                                          breakStart: event.target.value,
                                        })
                                      }
                                      type="time"
                                      value={schedule.breakStart}
                                    />
                                  </label>
                                  <label className="text-xs font-medium sm:text-sm">
                                    Fim do intervalo
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        updateProfessionalDay(professional.id, dayIndex, {
                                          breakEnd: event.target.value,
                                        })
                                      }
                                      type="time"
                                      value={schedule.breakEnd}
                                    />
                                  </label>
                                </div>
                              )}
                            </fieldset>
                          );
                        })}
                      </div>
                      <button
                        className="mt-4 text-sm font-medium text-red-700 underline"
                        onClick={() =>
                          setProfessionals((current) =>
                            current.filter((item) => item.id !== professional.id),
                          )
                        }
                        type="button"
                      >
                        Remover profissional
                      </button>
                    </fieldset>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  className="min-h-12 rounded-full border border-[#7a6a5a] px-6 py-3 font-semibold text-[#5c4a3f] hover:bg-[#f5ebe0]"
                  onClick={addProfessional}
                  type="button"
                >
                  Adicionar profissional
                </button>
                <button
                  className="min-h-12 rounded-full bg-[#7a6a5a] px-6 py-3 font-semibold text-white hover:bg-[#655648] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving || professionals.length === 0}
                  type="submit"
                >
                  {saving ? "Salvando..." : "Salvar disponibilidade"}
                </button>
              </div>
              </form>
            </details>
          </section>
        )}

        {message && (
          <p
            aria-live="polite"
            className={`mt-5 rounded-xl p-4 text-sm ${
              isError ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"
            }`}
            role={isError ? "alert" : "status"}
          >
            {message}
          </p>
        )}

        {user && authorized && (
          <p className="mt-6 text-center text-xs text-[#8a7b6e]">
            Conectado como {user.email}
          </p>
        )}
        <p className="mt-8 text-center text-xs text-[#8a7b6e]">
          Versão {SITE_VERSION}
        </p>
      </div>
    </main>
  );
}
