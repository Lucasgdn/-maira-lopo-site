"use client";

import { useEffect, useState, type FormEvent } from "react";
import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { firestore } from "../lib/firebase";
import {
  isSavedReminderSettings,
  normalizeRecipientPhone,
  validateReminderSettings,
  type CustomerReminder,
  type ReminderSettings,
  type SummarySchedule,
} from "../lib/reminder-settings";

const fieldClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[#d9c9bc] bg-white px-3 text-[#3e3e3e]";
const buttonClass = "min-h-11 rounded-lg border border-[#9a6b55] px-4 py-2 text-sm font-semibold text-[#754a38] hover:bg-[#fff8f2]";
const defaultAutomation = {
  timeZone: "America/Sao_Paulo",
  lateMinutes: "always",
  newBookings: false,
  summaries: false,
  customers: false,
  newText: "Novo pedido de agendamento: {cliente}, {servico}, {data} às {hora}, com {profissional}. Aguardando confirmação.",
  summaryText: "Resumo da agenda:",
  customerText: "Olá {cliente}! Lembramos do seu agendamento de {servico} em {data} às {hora}, com {profissional}.",
};
const emptySettings: ReminderSettings = { recipientPhone: "", summaries: [], customerReminders: [], automation: defaultAutomation };

export default function ReminderSettingsPanel() {
  const [settings, setSettings] = useState<ReminderSettings>(emptySettings);
  const [revision, setRevision] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firestore) {
        setLoadError("O Firebase não está configurado.");
        setLoading(false);
        return;
      }
      try {
        const snapshot = await getDocFromServer(doc(firestore, "settings", "reminders"));
        if (!active) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (!isSavedReminderSettings(data)) {
            setLoadError("As configurações salvas estão inválidas. Não é possível editá-las com segurança.");
            return;
          }
          setSettings({
            recipientPhone: data.recipientPhone,
            summaries: data.summaries,
            customerReminders: data.customerReminders,
            automation: { ...(data.automation ?? defaultAutomation), timeZone: "America/Sao_Paulo", lateMinutes: "always" },
          });
          setRevision(data.revision);
        }
      } catch {
        if (active) setLoadError("Não foi possível carregar as configurações. Verifique a conexão e tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  function updateSummary(index: number, changes: Partial<SummarySchedule>) {
    setSettings((current) => ({
      ...current,
      summaries: current.summaries.map((item, i) => i === index ? { ...item, ...changes } : item),
    }));
    setMessage("");
  }

  function updateReminder(index: number, changes: Partial<CustomerReminder>) {
    setSettings((current) => ({
      ...current,
      customerReminders: current.customerReminders.map((item, i) => i === index ? { ...item, ...changes } : item),
    }));
    setMessage("");
  }

  function updateAutomation(changes: Partial<typeof defaultAutomation>) {
    setSettings((current) => ({ ...current, automation: { ...(current.automation ?? defaultAutomation), ...changes } }));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = firestore;
    if (!db || busy) return;
    setError("");
    setMessage("");
    const validationError = validateReminderSettings(settings);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const ref = doc(db, "settings", "reminders");
      const nextRevision = crypto.randomUUID();
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        let current: Record<string, unknown> | undefined;
        if (snapshot.exists()) {
          current = snapshot.data();
          if (!isSavedReminderSettings(current) || current.revision !== revision) {
            throw new Error("As configurações foram alteradas em outra sessão. Reabra esta tela antes de salvar.");
          }
        } else if (revision !== null) {
          throw new Error("As configurações foram removidas em outra sessão. Reabra esta tela antes de salvar.");
        }
        const old = current && isSavedReminderSettings(current) ? current : null;
        const oldSummarySince = current && "summariesSince" in current ? current.summariesSince : null;
        const oldCustomerSince = current && "customersSince" in current ? current.customersSince : null;
        transaction.set(ref, {
          ...settings,
          recipientPhone: normalizeRecipientPhone(settings.recipientPhone),
          revision: nextRevision,
          updatedAt: serverTimestamp(),
          newBookingsSince: settings.automation?.newBookings
            ? old?.automation?.newBookings && current &&
                "newBookingsSince" in current && current.newBookingsSince instanceof Timestamp
              ? current.newBookingsSince
              : serverTimestamp()
            : null,
          summariesSince: settings.automation?.summaries
            ? old?.automation?.summaries &&
                JSON.stringify(old.summaries) === JSON.stringify(settings.summaries) &&
                oldSummarySince instanceof Timestamp ? oldSummarySince : serverTimestamp()
            : null,
          customersSince: settings.automation?.customers
            ? old?.automation?.customers &&
                JSON.stringify(old.customerReminders) === JSON.stringify(settings.customerReminders) &&
                oldCustomerSince instanceof Timestamp ? oldCustomerSince : serverTimestamp()
            : null,
        });
      });
      setRevision(nextRevision);
      setMessage("Configurações salvas. Os envios ativados dependem do robô conectado e ligado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar as configurações.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-[#e8ddd4] bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-[#5c4a3f]">Configurar lembretes</h2>
      <p className="mt-2 text-sm text-[#6b625b]">
        O WhatsApp conectado do salão será o remetente. As configurações são privadas; ative apenas os envios que deseja usar.
      </p>
      {loading ? <p className="mt-4 text-sm">Carregando configurações...</p> : loadError ? (
        <p className="mt-4 text-sm text-red-700" role="alert">{loadError}</p>
      ) : (
        <form className="mt-5 space-y-6" onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
            <div>
              <h3 className="font-semibold text-[#5c4a3f]">Envios automáticos</h3>
              <p className="mt-1 text-sm text-[#6b625b]">O robô precisa estar ligado. Por padrão, todos os envios ficam desligados.</p>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm"><input checked={settings.automation?.newBookings ?? false} onChange={(event) => updateAutomation({ newBookings: event.target.checked })} type="checkbox" /> Avisar meu número quando chegar um novo pedido</label>
                <label className="flex items-center gap-2 text-sm"><input checked={settings.automation?.summaries ?? false} onChange={(event) => updateAutomation({ summaries: event.target.checked })} type="checkbox" /> Enviar resumos da agenda</label>
                <label className="flex items-center gap-2 text-sm"><input checked={settings.automation?.customers ?? false} onChange={(event) => updateAutomation({ customers: event.target.checked })} type="checkbox" /> Enviar lembretes às clientes</label>
              </div>
              {settings.automation?.newBookings && <label className="mt-3 block text-sm font-medium">Texto de novos pedidos
                <textarea className={`${fieldClass} py-2`} onChange={(event) => updateAutomation({ newText: event.target.value })} rows={3} value={settings.automation.newText} />
              </label>}
              {settings.automation?.summaries && <label className="mt-3 block text-sm font-medium">Texto inicial do resumo
                <textarea className={`${fieldClass} py-2`} onChange={(event) => updateAutomation({ summaryText: event.target.value })} rows={2} value={settings.automation.summaryText} />
              </label>}
              {settings.automation?.customers && <label className="mt-3 block text-sm font-medium">Texto do lembrete para clientes
                <textarea className={`${fieldClass} py-2`} onChange={(event) => updateAutomation({ customerText: event.target.value })} rows={3} value={settings.automation.customerText} />
              </label>}
              <p className="mt-2 text-xs text-[#6b625b]">Nos textos de pedidos e clientes, use {"{cliente}"}, {"{servico}"}, {"{data}"}, {"{hora}"} e {"{profissional}"} para inserir os dados.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[#5c4a3f]">Resumo da agenda</h3>
              <p className="mt-1 text-sm text-[#6b625b]">O resumo será enviado ao seu número particular e incluirá os atendimentos das profissionais no período escolhido.</p>
              <label className="mt-4 block max-w-sm text-sm font-medium">
                Seu WhatsApp particular com DDD
                <input autoComplete="tel" className={fieldClass} onChange={(event) => {
                  setSettings((current) => ({ ...current, recipientPhone: event.target.value }));
                  setMessage("");
                }} placeholder="(19) 99999-9999" type="tel" value={settings.recipientPhone} />
              </label>
              <div className="mt-4 space-y-4">
                {settings.summaries.map((summary, index) => (
                  <div className="rounded-xl border border-[#e8ddd4] p-4" key={index}>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-semibold">Resumo {index + 1}</h4>
                      <button className="text-sm font-semibold text-red-700" onClick={() => {
                        setSettings((current) => ({ ...current, summaries: current.summaries.filter((_, i) => i !== index) }));
                        setMessage("");
                      }} type="button">Remover</button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-sm font-medium">Enviar às
                        <input className={fieldClass} onChange={(event) => updateSummary(index, { sendTime: event.target.value })} required type="time" value={summary.sendTime} />
                      </label>
                      <label className="text-sm font-medium">Agenda de
                        <select className={fieldClass} onChange={(event) => updateSummary(index, { day: event.target.value === "tomorrow" ? "tomorrow" : "today" })} value={summary.day}>
                          <option value="today">Hoje</option>
                          <option value="tomorrow">Amanhã</option>
                        </select>
                      </label>
                      {summary.includeConfirmed !== false && <label className="text-sm font-medium">Atendimentos a partir de
                        <input className={fieldClass} onChange={(event) => updateSummary(index, { startTime: event.target.value })} required type="time" value={summary.startTime} />
                      </label>}
                      {summary.includeConfirmed !== false && <label className="text-sm font-medium">Atendimentos até
                        <input className={fieldClass} onChange={(event) => updateSummary(index, { endTime: event.target.value })} required type="time" value={summary.endTime} />
                      </label>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-2"><input checked={summary.includeConfirmed !== false} onChange={(event) => updateSummary(index, { includeConfirmed: event.target.checked })} type="checkbox" /> Confirmados do período</label>
                      <label className="flex items-center gap-2"><input checked={summary.includePending ?? false} onChange={(event) => updateSummary(index, { includePending: event.target.checked })} type="checkbox" /> Pendentes do dia inteiro</label>
                      <label className="flex items-center gap-2"><input checked={summary.sendWhenEmpty ?? false} onChange={(event) => updateSummary(index, { sendWhenEmpty: event.target.checked })} type="checkbox" /> Avisar se não houver reservas</label>
                    </div>
                  </div>
                ))}
              </div>
              <button className={`${buttonClass} mt-4`} onClick={() => {
                setSettings((current) => ({ ...current, summaries: [...current.summaries, { sendTime: "", day: "today", startTime: "", endTime: "" }] }));
                setMessage("");
              }} type="button">Adicionar resumo</button>
            </div>
            <div>
              <h3 className="font-semibold text-[#5c4a3f]">Lembretes para as clientes</h3>
              <p className="mt-1 text-sm text-[#6b625b]">Escolha quantas horas ou dias antes do atendimento cada lembrete será enviado.</p>
              <div className="mt-4 space-y-4">
                {settings.customerReminders.map((reminder, index) => (
                  <div className="rounded-xl border border-[#e8ddd4] p-4" key={index}>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-semibold">Lembrete {index + 1}</h4>
                      <button className="text-sm font-semibold text-red-700" onClick={() => {
                        setSettings((current) => ({ ...current, customerReminders: current.customerReminders.filter((_, i) => i !== index) }));
                        setMessage("");
                      }} type="button">Remover</button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">Quantidade
                        <input className={fieldClass} min="1" onChange={(event) => updateReminder(index, { amount: event.target.value })} required step="1" type="number" value={reminder.amount} />
                      </label>
                      <label className="text-sm font-medium">Antes do atendimento
                        <select className={fieldClass} onChange={(event) => updateReminder(index, {
                          unit: event.target.value === "days" ? "days" : "hours",
                          mode: "elapsed",
                          sendTime: "",
                        })} value={reminder.unit}>
                          <option value="hours">Horas</option>
                          <option value="days">Dias</option>
                        </select>
                      </label>
                    </div>
                    {reminder.unit === "days" && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-medium">Como calcular os dias
                          <select className={fieldClass} onChange={(event) => updateReminder(index, { mode: event.target.value === "calendar" ? "calendar" : "elapsed" })} value={reminder.mode ?? "elapsed"}>
                            <option value="elapsed">24 horas para cada dia</option>
                            <option value="calendar">Nos dias anteriores, em horário escolhido</option>
                          </select>
                        </label>
                        {reminder.mode === "calendar" && (
                          <label className="text-sm font-medium">Enviar às
                            <input className={fieldClass} onChange={(event) => updateReminder(index, { sendTime: event.target.value })} required type="time" value={reminder.sendTime ?? ""} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className={`${buttonClass} mt-4`} onClick={() => {
                setSettings((current) => ({ ...current, customerReminders: [...current.customerReminders, { amount: "", unit: "hours" }] }));
                setMessage("");
              }} type="button">Adicionar lembrete</button>
            </div>
            <button className="min-h-11 rounded-lg bg-[#754a38] px-5 py-2 font-semibold text-white hover:bg-[#5c392c]" type="submit">
              {busy ? "Salvando..." : "Salvar configurações"}
            </button>
          </fieldset>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          {message && <p className="text-sm text-green-700" role="status">{message}</p>}
        </form>
      )}
    </section>
  );
}
