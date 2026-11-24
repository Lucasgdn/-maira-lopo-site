import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { disconnectWhatsApp } from "./disconnect.mjs";

test("confirms logout after navigation only when the pairing screen appears", async () => {
  const navigationError = new Error("Execution context was destroyed, most likely because of a navigation.");
  let observed = false;
  await disconnectWhatsApp({
    logout: async () => { throw navigationError; },
    waPage: { waitForFunction: async (_check, options) => {
      assert.equal(options.timeout, 90000);
      observed = true;
    } },
  });
  assert.equal(observed, true);

  await assert.rejects(disconnectWhatsApp({
    logout: async () => { throw navigationError; },
    waPage: { waitForFunction: async () => { throw new Error("timeout"); } },
  }), /nao confirmou a desconexao/);
  await assert.rejects(disconnectWhatsApp({
    logout: async () => { throw new Error("outra falha"); },
  }), /outra falha/);
});

test("publishes the QR and disconnects only the current session", async () => {
  const previous = {};
  for (const name of ["BOT_FIREBASE_API_KEY", "BOT_FIREBASE_PROJECT_ID",
    "BOT_FIREBASE_AUTH_DOMAIN", "BOT_EMAIL", "BOT_PASSWORD"]) {
    previous[name] = process.env[name];
    process.env[name] = "test";
  }
  let state;
  const statuses = [];
  let onCommand;
  let logouts = 0;
  let closes = 0;
  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  const fakeTime = { toMillis: () => Date.now() };
  const fakeClient = {
    logout: async () => { logouts++; return true; },
    close: async () => { closes++; },
    isConnected: async () => true,
    onStateChange: () => {},
  };
  const initialSigint = process.listeners("SIGINT");
  const initialSigterm = process.listeners("SIGTERM");

  mock.module("firebase/app", { exports: {
    initializeApp: () => ({}),
    deleteApp: async () => { finish(); },
  } });
  mock.module("firebase/auth", { exports: {
    getAuth: () => ({}),
    signInWithEmailAndPassword: async () => {},
    signOut: async () => {},
  } });
  mock.module("firebase/firestore", { exports: {
    getFirestore: () => ({}),
    doc: (_db, collection) => collection,
    onSnapshot: (_ref, callback) => { onCommand = callback; return () => {}; },
    serverTimestamp: () => fakeTime,
    Timestamp: { now: () => fakeTime },
    runTransaction: async (_db, callback) => callback({
      get: async () => ({ data: () => state }),
      set: (_ref, next) => { state = next; statuses.push(next); },
    }),
  } });
  mock.module("@wppconnect-team/wppconnect", { exports: { default: {
    create: async (options) => {
      options.catchQR("data:image/png;base64,AAAA");
      await new Promise((resolve) => setImmediate(resolve));
      return fakeClient;
    },
  } } });

  try {
    await import("./index.mjs");
    assert.ok(statuses.some((entry) => entry.status === "qr" && entry.qr));
    assert.equal(state.status, "connected");
    assert.equal(state.qr, null);
    onCommand({ data: () => ({ runId: "another-session" }) });
    assert.equal(logouts, 0);
    onCommand({ data: () => ({ runId: state.runId }) });
    await finished;
    assert.equal(logouts, 1);
    assert.equal(closes, 1);
    assert.equal(state.status, "offline");
    assert.equal(state.qr, null);
  } finally {
    mock.reset();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    for (const listener of process.listeners("SIGINT")) {
      if (!initialSigint.includes(listener)) process.removeListener("SIGINT", listener);
    }
    for (const listener of process.listeners("SIGTERM")) {
      if (!initialSigterm.includes(listener)) process.removeListener("SIGTERM", listener);
    }
  }
});
