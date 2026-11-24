import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

test("QR and disconnect commands are restricted to their intended accounts", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  const rules = await readFile(fileURLToPath(new URL("../firestore.rules", import.meta.url)), "utf8");
  const environment = await initializeTestEnvironment({
    projectId: "demo-whatsapp",
    firestore: { rules },
  });
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
    await assertFails(getDoc(doc(bot, "appointments", "private")));
    await assertFails(getDoc(doc(bot, "settings", "private")));
    await assertFails(setDoc(doc(bot, "botCommands", "whatsapp"), command));
    await assertFails(setDoc(doc(stranger, "botCommands", "whatsapp"), command));
    await assertFails(setDoc(doc(admin, "botCommands", "whatsapp"), { ...command, runId: "invalid" }));
    await assertSucceeds(setDoc(doc(admin, "botCommands", "whatsapp"), command));
    await assertSucceeds(getDoc(doc(bot, "botCommands", "whatsapp")));
  } finally {
    await environment.cleanup();
  }
});
