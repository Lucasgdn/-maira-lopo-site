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

function formatDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
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

export default function AppointmentsPanel({ onAppointmentsChange }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [whatsAppFallback, setWhatsAppFallback] = useState("");

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
        const slotRefs = appointment.slotIds.map((slotId) =>
          doc(db, "bookingSlots", slotId),
        );
        await runTransaction(db, async (transaction) => {
          const currentAppointment = await transaction.get(appointmentRef);
          if (!currentAppointment.exists()) {
            throw new Error("APPOINTMENT_MISSING");
          }
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
          Reserva atualizada. Se o WhatsApp nao abriu,{" "}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
