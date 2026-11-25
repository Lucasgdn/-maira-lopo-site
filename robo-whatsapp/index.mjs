import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase/app";
import { disconnectWhatsApp } from "./disconnect.mjs";
import { createReminderWorker } from "./reminders.mjs";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const directory = path.dirname(fileURLToPath(import.meta.url));
const required = [
  "BOT_FIREBASE_API_KEY",
  "BOT_FIREBASE_PROJECT_ID",
  "BOT_FIREBASE_AUTH_DOMAIN",
  "BOT_EMAIL",
  "BOT_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Configuracao ausente: ${missing.join(", ")}.`);
  process.exitCode = 1;
} else {
  await main();
}

async function main() {
  const app = initializeApp({
    apiKey: process.env.BOT_FIREBASE_API_KEY,
    projectId: process.env.BOT_FIREBASE_PROJECT_ID,
    authDomain: process.env.BOT_FIREBASE_AUTH_DOMAIN,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const sessionRef = doc(db, "botSessions", "whatsapp");
  const commandRef = doc(db, "botCommands", "whatsapp");
  const runId = randomUUID();
  let state = { runId, status: "starting", qr: null, qrAt: null, deliveryError: null };
  let client;
  let stopping = false;
  let connected = false;
  let heartbeat;
  let reminders;
  let heartbeatRunning = false;
  let unsubscribe;
  let confirmLogoutQr;
  let queue = Promise.resolve();

  async function writeState(next, claim = false) {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(sessionRef);
      const current = snapshot.data();
      if (claim) {
        const updated = current?.updatedAt?.toMillis();
        if (current && current.status !== "offline" && current.status !== "error" &&
            typeof updated === "number" && Date.now() - updated < 60000) {
          throw new Error("Outro robo parece estar ativo. Encerre-o antes de iniciar outro.");
        }
      } else if (!current || current.runId !== runId) {
        throw new Error("A sessao do robo foi substituida por outra instancia.");
      }
      transaction.set(sessionRef, { ...next, updatedAt: serverTimestamp() });
    });
  }

  function publish(changes) {
    queue = queue.catch((error) => {
      console.error("Falha anterior ao atualizar o painel:", error.message);
    }).then(async () => {
      const next = { ...state, ...changes };
      await writeState(next);
      state = next;
    });
    return queue;
  }

  async function stop(status, logout = false) {
    if (stopping) return;
    stopping = true;
    clearInterval(heartbeat);
    unsubscribe?.();
    try {
      if (logout) {
        await publish({ status: "disconnecting", qr: null, qrAt: null });
        let refreshError;
        const disconnectHeartbeat = setInterval(() => {
          void publish({}).catch((error) => {
            refreshError = error;
            console.error("Falha ao atualizar o estado da desconexao:", error.message);
          });
        }, 15000);
        try {
          await reminders?.stop();
          if (!client) {
            throw new Error("O WhatsApp nao confirmou a desconexao.");
          }
          const pairingScreen = new Promise((resolve) => {
            confirmLogoutQr = resolve;
          });
          await disconnectWhatsApp(client, pairingScreen);
        } finally {
          clearInterval(disconnectHeartbeat);
          confirmLogoutQr = undefined;
        }
        await queue;
        if (refreshError) throw refreshError;
      } else {
        await reminders?.stop();
      }
      if (client) {
        await client.close();
        client = null;
      }
      await publish({ status, qr: null, qrAt: null });
    } catch (error) {
      console.error("Falha ao encerrar o robo:", error.message);
      process.exitCode = 1;
      try {
        await publish({ status: "error", qr: null, qrAt: null });
      } catch {
        console.error("Nao foi possivel atualizar o estado no painel.");
      }
    } finally {
      if (client) {
        try {
          await client.close();
        } catch (error) {
          console.error("Nao foi possivel fechar o navegador:", error.message);
          process.exitCode = 1;
        }
      }
      await signOut(auth);
      await deleteApp(app);
    }
  }

  try {
    await signInWithEmailAndPassword(auth, process.env.BOT_EMAIL, process.env.BOT_PASSWORD);
    await writeState(state, true);
    heartbeat = setInterval(() => {
      if (heartbeatRunning || stopping) return;
      heartbeatRunning = true;
      void (async () => {
        if (connected && client && !(await client.isConnected())) {
          throw new Error("O WhatsApp perdeu a conexao.");
        }
        await publish({});
      })().catch((error) => {
        console.error("Falha na comunicacao do robo:", error.message);
        process.exitCode = 1;
        void stop("error");
      }).finally(() => {
        heartbeatRunning = false;
      });
    }, 15000);

    unsubscribe = onSnapshot(commandRef, (snapshot) => {
      const command = snapshot.data();
      if (command?.runId === runId && connected && !stopping) {
        void stop("offline", true);
      }
    }, (error) => {
      console.error("Nao foi possivel receber comandos:", error.message);
      process.exitCode = 1;
      void stop("error");
    });

    const { default: wppconnect } = await import("@wppconnect-team/wppconnect");
    client = await wppconnect.create({
      session: "esmalteria",
      folderNameToken: path.join(directory, ".wppconnect"),
      useChrome: false,
      logQR: false,
      disableWelcome: true,
      updatesLog: false,
      disableGoogleAnalytics: true,
      autoClose: 120000,
      catchQR: (image) => {
        if (stopping && confirmLogoutQr) {
          if (typeof image === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) &&
              image.length <= 150000) {
            confirmLogoutQr();
          }
          return;
        }
        if (connected || stopping) return;
        if (typeof image !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) ||
            image.length > 150000) {
          console.error("O WhatsApp retornou um QR code invalido.");
          process.exitCode = 1;
          void stop("error");
          return;
        }
        void publish({ status: "qr", qr: image, qrAt: Timestamp.now() }).catch((error) => {
          console.error("Nao foi possivel atualizar o QR no painel:", error.message);
          process.exitCode = 1;
          void stop("error");
        });
      },
      statusFind: (status) => {
        if (!stopping && (status === "browserClose" || status === "serverClose")) {
          console.error("O navegador do WhatsApp foi desconectado.");
          process.exitCode = 1;
          void stop("error");
        }
      },
    });
    if (stopping) {
      await client.close();
      return;
    }
    connected = true;
    await publish({ status: "connected", qr: null, qrAt: null });
    client.onStateChange((status) => {
      if (!stopping && ["UNPAIRED", "UNPAIRED_IDLE", "CONFLICT", "TOS_BLOCK",
        "SMB_TOS_BLOCK", "DEPRECATED_VERSION"].includes(status)) {
        console.error("A sessao do WhatsApp nao esta mais conectada.");
        process.exitCode = 1;
        void stop("error");
      }
    });
    reminders = createReminderWorker({
      db, client, isRunning: () => connected && !stopping,
      onStatus: async (deliveryError) => {
        if (!stopping && state.deliveryError !== deliveryError) await publish({ deliveryError });
      },
    });
    reminders.start();
    console.log("WhatsApp conectado. Envios dependem das configuracoes do painel.");
    process.once("SIGINT", () => void stop("offline"));
    process.once("SIGTERM", () => void stop("offline"));
  } catch (error) {
    console.error("Nao foi possivel iniciar o robo:", error.message);
    process.exitCode = 1;
    if (heartbeat) await stop("error");
    else {
      await signOut(auth);
      await deleteApp(app);
    }
  }
}
