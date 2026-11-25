import assert from "node:assert/strict";
import { mock, test } from "node:test";

test("status notices send once, reject obsolete requests and preserve uncertain outcomes", async () => {
  const records = new Map();
  const ref = (collection, id) => ({ key: `${collection}/${id}`, id });
  let onRead;
  const snapshot = (reference) => ({
    ref: reference,
    exists: () => records.has(reference.key),
    data: () => records.get(reference.key),
  });
  const timestamp = () => ({ toMillis: () => Date.now() });
  mock.module("firebase/firestore", { exports: {
    collection: (_db, name) => name,
    doc: (_db, name, id) => ref(name, id),
    query: (name) => name,
    where: () => ({}),
    serverTimestamp: timestamp,
    getDocsFromServer: async () => ({
      docs: [...records.entries()].filter(([key, value]) => key.startsWith("statusNotices/") && value.status === "queued")
        .map(([key]) => snapshot(ref("statusNotices", key.split("/")[1]))),
    }),
    getDocFromServer: async (reference) => {
      onRead?.(reference);
      return snapshot(reference);
    },
    updateDoc: async (reference, update) => records.set(reference.key, { ...records.get(reference.key), ...update }),
    runTransaction: async (_db, callback) => callback({
      get: async (reference) => snapshot(reference),
      update: (reference, update) => records.set(reference.key, { ...records.get(reference.key), ...update }),
    }),
  } });
  try {
    const { createStatusNoticeWorker } = await import("./status-notices.mjs");
    records.set("settings/reminders", { automation: { statusNotices: true } });
    const appointment = {
      customerName: "Cliente Simulada", customerPhone: "5511999999999", service: "Serviço",
      date: "2030-01-02", startTime: "09:00", status: "confirmed", statusNoticeId: "first",
    };
    const notice = { appointmentId: "appointment", kind: "confirmed", date: appointment.date, startTime: appointment.startTime, status: "queued" };
    records.set("appointments/appointment", appointment);
    records.set("statusNotices/first", notice);
    const messages = [];
    const worker = createStatusNoticeWorker({
      db: {}, isRunning: () => true,
      client: { sendText: async (recipient, text) => { messages.push({ recipient, text }); } },
    });
    await worker.tick();
    await worker.tick();
    assert.equal(messages.length, 1);
    assert.match(messages[0].text, /confirmado para 02\/01\/2030 às 09:00/);
    assert.equal(records.get("statusNotices/first").status, "sent");

    records.set("appointments/appointment", { ...appointment, status: "cancelled", statusNoticeId: "cancel" });
    records.set("statusNotices/cancel", { ...notice, kind: "cancelled", status: "queued" });
    await worker.tick();
    assert.equal(messages.length, 2);
    assert.match(messages[1].text, /foi cancelado/);
    assert.equal(records.get("statusNotices/cancel").status, "sent");

    records.set("statusNotices/old", { ...notice, status: "queued" });
    await worker.tick();
    assert.equal(records.get("statusNotices/old").status, "obsolete");
    assert.equal(messages.length, 2);

    records.set("appointments/appointment", { ...appointment, statusNoticeId: "disabled" });
    records.set("statusNotices/disabled", { ...notice, status: "queued" });
    records.set("settings/reminders", { automation: { statusNotices: false } });
    await worker.tick();
    assert.equal(records.get("statusNotices/disabled").status, "needs_manual");

    records.set("settings/reminders", { automation: { statusNotices: true } });
    records.set("appointments/appointment", { ...appointment, statusNoticeId: "manual" });
    records.set("statusNotices/manual", { ...notice, status: "queued" });
    onRead = (reference) => {
      if (reference.key === "statusNotices/manual") {
        records.set(reference.key, { ...records.get(reference.key), status: "manual" });
      }
    };
    await worker.tick();
    onRead = undefined;
    assert.equal(records.get("statusNotices/manual").status, "manual");
    assert.equal(messages.length, 2);

    records.set("appointments/appointment", { ...appointment, status: "cancelled", statusNoticeId: "uncertain" });
    records.set("statusNotices/uncertain", { ...notice, kind: "cancelled", status: "queued" });
    let attempts = 0;
    const failing = createStatusNoticeWorker({
      db: {}, isRunning: () => true,
      client: { sendText: async () => { attempts++; throw new Error("falha simulada"); } },
    });
    await failing.tick();
    await failing.tick();
    assert.equal(attempts, 1);
    assert.equal(records.get("statusNotices/uncertain").status, "uncertain");
  } finally {
    mock.reset();
  }
});
