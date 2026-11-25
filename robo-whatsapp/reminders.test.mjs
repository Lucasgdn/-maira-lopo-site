import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from "firebase/firestore";
import { createReminderWorker, customerDue, localTime } from "./reminders.mjs";
import { createStatusNoticeWorker } from "./status-notices.mjs";

test("calculates hours and calendar days in the salon's time zone", () => {
  const appointment = { date: "2030-01-02", startTime: "11:00" };
  assert.equal(localTime("2030-01-02", "11:00", "America/Sao_Paulo"), Date.UTC(2030, 0, 2, 14));
  assert.equal(customerDue(appointment, { amount: "1", unit: "hours" }, "America/Sao_Paulo"), Date.UTC(2030, 0, 2, 13));
  assert.equal(customerDue(appointment, { amount: "1", unit: "days" }, "America/Sao_Paulo"), Date.UTC(2030, 0, 1, 14));
  assert.equal(customerDue(appointment, { amount: "1", unit: "days", mode: "calendar", sendTime: "09:00" }, "America/Sao_Paulo"), Date.UTC(2030, 0, 1, 12));
});

test("sends configured notices once and does not retry uncertain outcomes", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  const rules = await readFile(fileURLToPath(new URL("../firestore.rules", import.meta.url)), "utf8");
  const env = await initializeTestEnvironment({ projectId: "demo-reminders", firestore: { rules } });
  await env.clearFirestore();
  const now = Date.UTC(2030, 0, 2, 13);
  const time = (minutes) => Timestamp.fromMillis(now + minutes * 60000);
  const base = {
    customerName: "Cliente Simulada", customerPhone: "5511999999999",
    service: "Servico", professionalName: "Profissional", date: "2030-01-02",
    startTime: "11:00", status: "confirmed", createdAt: time(-200),
  };
  const settings = {
    revision: "revision-1", recipientPhone: "5511888888888", updatedAt: time(-30),
    newBookingsSince: time(-30), summariesSince: time(-30), customersSince: time(-30),
    automation: {
      timeZone: "America/Sao_Paulo", lateMinutes: "always",
      newBookings: true, summaries: true, customers: true,
      newText: "Novo {cliente}", summaryText: "Agenda", customerText: "Olá {cliente}, {hora}",
    },
    summaries: [{ day: "today", sendTime: "10:00", startTime: "10:00", endTime: "12:00", includePending: true }],
    customerReminders: [{ amount: "1", unit: "hours" }],
  };
  try {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "botOperators", "bot"), { active: true });
      await setDoc(doc(db, "settings", "reminders"), settings);
      await setDoc(doc(db, "appointments", "confirmed"), base);
      await setDoc(doc(db, "appointments", "pending"), { ...base, customerName: "Novo Pedido", startTime: "15:00", status: "pending", createdAt: time(-5) });
      await setDoc(doc(db, "appointments", "blocked"), { ...base, customerName: "Não enviar", remindersDisabled: true });
      await setDoc(doc(db, "appointments", "cancelled"), { ...base, status: "cancelled" });
    });
    const db = env.authenticatedContext("bot").firestore();
    const messages = [];
    const client = {
      sendText: async (recipient, text) => {
        messages.push({ recipient, text });
        if (recipient === "5511999999999@c.us") throw new Error("resultado desconhecido");
      },
    };
    const worker = createReminderWorker({ db, client, isRunning: () => true, now: () => now });
    await worker.tick();
    assert.equal(messages.length, 3);
    assert.ok(messages.some((message) => message.text.includes("Novo Novo Pedido")));
    assert.ok(messages.some((message) => message.text.includes("Aguardando confirmação") && message.text.includes("Novo Pedido")));
    assert.ok(messages.some((message) => message.text.includes("Olá Cliente Simulada, 11:00")));
    assert.ok(messages.every((message) => !message.text.includes("Não enviar") || message.text.includes("Agenda")));
    await worker.tick();
    assert.equal(messages.length, 3);
    const deliveries = (await getDocs(collection(db, "botDeliveries"))).docs.map((item) => item.data());
    assert.equal(deliveries.filter((item) => item.status === "sent").length, 2);
    assert.equal(deliveries.filter((item) => item.status === "uncertain").length, 1);
  } finally {
    await env.cleanup();
  }
});

test("sends a queued confirmation through the restricted bot account", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  const rules = await readFile(fileURLToPath(new URL("../firestore.rules", import.meta.url)), "utf8");
  const env = await initializeTestEnvironment({ projectId: "demo-status-worker", firestore: { rules } });
  await env.clearFirestore();
  try {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "botOperators", "bot"), { active: true });
      await setDoc(doc(db, "settings", "reminders"), { automation: { statusNotices: true } });
      await setDoc(doc(db, "appointments", "booking"), {
        customerName: "Cliente Simulada", customerPhone: "5511999999999", service: "Serviço",
        date: "2030-01-02", startTime: "09:00", status: "confirmed", statusNoticeId: "notice",
      });
      await setDoc(doc(db, "statusNotices", "notice"), {
        appointmentId: "booking", kind: "confirmed", date: "2030-01-02", startTime: "09:00",
        status: "queued", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
    });
    const db = env.authenticatedContext("bot").firestore();
    const messages = [];
    const worker = createStatusNoticeWorker({
      db, isRunning: () => true,
      client: { sendText: async (recipient, text) => { messages.push({ recipient, text }); } },
    });
    await worker.tick();
    await worker.tick();
    assert.equal(messages.length, 1);
    assert.match(messages[0].text, /confirmado/);
    assert.equal((await getDoc(doc(db, "statusNotices", "notice"))).data().status, "sent");
  } finally {
    await env.cleanup();
  }
});
