import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from "firebase/firestore";

test("QR and disconnect commands are restricted to their intended accounts", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  const rules = await readFile(fileURLToPath(new URL("../firestore.rules", import.meta.url)), "utf8");
  const environment = await initializeTestEnvironment({
    projectId: "demo-whatsapp",
    firestore: { rules },
  });
  await environment.clearFirestore();

  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "admins", "admin"), { active: true });
      await setDoc(doc(context.firestore(), "botOperators", "bot"), { active: true });
      await setDoc(doc(context.firestore(), "admins", "inactive-admin"), { active: false });
      await setDoc(doc(context.firestore(), "botOperators", "inactive-bot"), { active: false });
    });

    const admin = environment.authenticatedContext("admin").firestore();
    const bot = environment.authenticatedContext("bot").firestore();
    const stranger = environment.authenticatedContext("stranger").firestore();
    const anonymous = environment.unauthenticatedContext().firestore();
    const inactiveAdmin = environment.authenticatedContext("inactive-admin").firestore();
    const inactiveBot = environment.authenticatedContext("inactive-bot").firestore();
    const runId = "12345678-1234-1234-1234-123456789abc";
    const session = {
      runId,
      status: "qr",
      qr: "data:image/png;base64,AAAA",
      qrAt: null,
      updatedAt: serverTimestamp(),
    };
    const command = {
      runId,
      requestId: "87654321-4321-4321-4321-cba987654321",
      requestedAt: serverTimestamp(),
    };

    await assertFails(setDoc(doc(admin, "botSessions", "whatsapp"), session));
    await assertSucceeds(setDoc(doc(bot, "botSessions", "whatsapp"), session));
    await assertSucceeds(getDoc(doc(admin, "botSessions", "whatsapp")));
    await assertFails(getDoc(doc(stranger, "botSessions", "whatsapp")));
    await assertFails(getDoc(doc(anonymous, "botSessions", "whatsapp")));
    await assertFails(getDoc(doc(inactiveAdmin, "botSessions", "whatsapp")));
    await assertFails(setDoc(doc(inactiveBot, "botSessions", "whatsapp"), session));
    await assertSucceeds(getDoc(doc(bot, "appointments", "private")));
    await assertFails(getDoc(doc(bot, "settings", "private")));
    const reminderSettings = doc(admin, "settings", "reminders");
    await assertSucceeds(setDoc(reminderSettings, { recipientPhone: "5511999999999" }));
    await assertSucceeds(getDoc(reminderSettings));
    await assertFails(getDoc(doc(anonymous, "settings", "reminders")));
    await assertFails(getDoc(doc(stranger, "settings", "reminders")));
    await assertSucceeds(getDoc(doc(bot, "settings", "reminders")));
    await assertFails(setDoc(doc(stranger, "settings", "reminders"), { recipientPhone: "" }));
    async function createBooking(id, extraField) {
      const batch = writeBatch(anonymous);
      const slotId = `professional_2030-01-01_${id}`;
      const appointment = {
        customerName: "Cliente Teste",
        customerPhone: "5511999999999",
        service: "Servico",
        price: "R$ 10",
        durationMinutes: 5,
        professionalId: "professional",
        professionalName: "Profissional",
        date: "2030-01-01",
        startTime: id,
        endTime: id === "09:00" ? "09:05" : id === "10:00" ? "10:05" : "11:05",
        slotIds: [slotId],
        status: "pending",
        createdAt: serverTimestamp(),
      };
      if (extraField !== undefined) appointment.remindersDisabled = extraField;
      batch.set(doc(anonymous, "appointments", id), appointment);
      batch.set(doc(anonymous, "bookingSlots", slotId), {
        appointmentId: id,
        professionalId: "professional",
        date: "2030-01-01",
        time: id,
      });
      return batch.commit();
    }
    await assertSucceeds(createBooking("09:00", undefined));
    await assertSucceeds(createBooking("10:00", undefined));
    await assertFails(createBooking("11:00", "sim"));
    await assertSucceeds(setDoc(doc(admin, "appointments", "10:00"), { remindersDisabled: true }, { merge: true }));
    assert.equal((await getDoc(doc(admin, "appointments", "10:00"))).data().remindersDisabled, true);
    await assertFails(setDoc(doc(bot, "botCommands", "whatsapp"), command));
    await assertFails(setDoc(doc(stranger, "botCommands", "whatsapp"), command));
    await assertFails(setDoc(doc(admin, "botCommands", "whatsapp"), { ...command, runId: "invalid" }));
    await assertSucceeds(setDoc(doc(admin, "botCommands", "whatsapp"), command));
    await assertSucceeds(getDoc(doc(bot, "botCommands", "whatsapp")));
  } finally {
    await environment.cleanup();
  }
});

test("status notice queue limits access and prevents racing manual sends", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  const rules = await readFile(fileURLToPath(new URL("../firestore.rules", import.meta.url)), "utf8");
  const environment = await initializeTestEnvironment({ projectId: "demo-status-notices", firestore: { rules } });
  await environment.clearFirestore();
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "admins", "admin"), { active: true });
      await setDoc(doc(db, "botOperators", "bot"), { active: true });
      await setDoc(doc(db, "appointments", "booking"), { status: "pending" });
    });
    const admin = environment.authenticatedContext("admin").firestore();
    const bot = environment.authenticatedContext("bot").firestore();
    const stranger = environment.authenticatedContext("stranger").firestore();
    const data = {
      appointmentId: "booking", kind: "confirmed", date: "2030-01-02", startTime: "09:00",
      status: "queued", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    const notice = doc(admin, "statusNotices", "notice");
    await assertFails(setDoc(notice, data));
    const batch = writeBatch(admin);
    batch.update(doc(admin, "appointments", "booking"), { status: "confirmed", statusNoticeId: "notice" });
    batch.set(notice, data);
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(stranger, "statusNotices", "notice")));
    await assertFails(setDoc(doc(bot, "statusNotices", "other"), data));
    await assertSucceeds(updateDoc(doc(bot, "statusNotices", "notice"), { status: "sending", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(notice, { status: "manual", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(bot, "statusNotices", "notice"), { status: "uncertain", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(notice, { status: "manual", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(bot, "statusNotices", "notice"), { status: "sent", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(notice, { status: "reviewed", updatedAt: serverTimestamp() }));
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "statusNotices", "notice"), {
        status: "sending", updatedAt: Timestamp.fromMillis(Date.now() - 180000),
      });
    });
    await assertSucceeds(updateDoc(notice, { status: "manual", updatedAt: serverTimestamp() }));
  } finally {
    await environment.cleanup();
  }
});
