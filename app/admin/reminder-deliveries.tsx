"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { firestore } from "../lib/firebase";

type Delivery = {
  id: string;
  kind: "new" | "summary" | "customer";
  date: string;
  status: "sending" | "uncertain";
  updatedAt: Timestamp;
};

function isDelivery(value: unknown): value is Omit<Delivery, "id"> {
  return typeof value === "object" && value !== null &&
    "kind" in value && (value.kind === "new" || value.kind === "summary" || value.kind === "customer") &&
    "date" in value && typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    "status" in value && (value.status === "sending" || value.status === "uncertain") &&
    "updatedAt" in value && value.updatedAt instanceof Timestamp;
}

export default function ReminderDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!firestore) return;
    return onSnapshot(query(collection(firestore, "botDeliveries"), where("status", "in", ["sending", "uncertain"])),
      (snapshot) => {
        const entries: Delivery[] = [];
        for (const item of snapshot.docs) {
          const value = item.data();
          if (!isDelivery(value)) {
            setError("Há um registro de envio inválido. Consulte o suporte.");
            return;
          }
          entries.push({ id: item.id, ...value });
        }
        setDeliveries(entries);
        setError("");
      },
      () => setError("Não foi possível verificar os resultados dos envios."),
    );
  }, []);

  async function review(item: Delivery) {
    const db = firestore;
    if (!db || busy || !window.confirm("Você conferiu a conversa no WhatsApp? Este envio não será repetido automaticamente.")) return;
    setBusy(item.id);
    setError("");
    try {
      await updateDoc(doc(db, "botDeliveries", item.id), { status: "reviewed", updatedAt: serverTimestamp() });
    } catch {
      setError("Não foi possível registrar a conferência. Aguarde e tente novamente.");
    } finally {
      setBusy("");
    }
  }

  if (!deliveries.length && !error) return null;
  return (
    <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      {error ? <p>{error}</p> : (
        <>
          <strong>Envios em processamento ou com resultado incerto</strong>
          <p className="mt-1">Confira as conversas no WhatsApp antes de enviar novamente. O robô não repete esses envios automaticamente.</p>
          <ul className="mt-2 list-disc pl-5">
            {deliveries.map((item) => (
              <li key={item.id}>
                {item.kind === "new" ? "Novo pedido" : item.kind === "summary" ? "Resumo" : "Lembrete de cliente"} — {item.date.split("-").reverse().join("/")}
                {(item.status === "uncertain" || now - item.updatedAt.toMillis() > 125000) ? (
                  <button className="ml-2 min-h-10 font-semibold underline disabled:opacity-60" disabled={!!busy} onClick={() => void review(item)} type="button">Já conferi</button>
                ) : <span> — em processamento</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
