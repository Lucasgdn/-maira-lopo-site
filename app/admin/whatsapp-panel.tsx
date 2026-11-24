"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { firestore } from "../lib/firebase";

type Session = {
  runId: string;
  status: "starting" | "qr" | "connected" | "disconnecting" | "offline" | "error";
  qr: string | null;
  qrAt: Timestamp | null;
  updatedAt: Timestamp;
};

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.runId === "string" &&
    /^[a-f0-9-]{36}$/.test(data.runId) &&
    typeof data.status === "string" &&
    ["starting", "qr", "connected", "disconnecting", "offline", "error"].includes(data.status) &&
    (data.qr === null || (typeof data.qr === "string" &&
      data.qr.length <= 150000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.qr))) &&
    (data.qrAt === null || data.qrAt instanceof Timestamp) &&
    data.updatedAt instanceof Timestamp
  );
}

type Props = {
  compact?: boolean;
  onOpen?: () => void;
};

export default function WhatsAppPanel({ compact = false, onOpen }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fromCache, setFromCache] = useState(true);
  const pendingRun = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!firestore) return;
    return onSnapshot(doc(firestore, "botSessions", "whatsapp"), { includeMetadataChanges: true },
      (snapshot) => {
        setFromCache(snapshot.metadata.fromCache);
        setLoading(false);
        if (!snapshot.exists()) {
          setSession(null);
          setError("");
          return;
        }
        const data = snapshot.data();
        if (!isSession(data)) {
          setSession(null);
          setError("O estado do robo esta invalido. Verifique a configuracao.");
          return;
        }
        setSession(data);
        if (data.status !== "connected" || (pendingRun.current && pendingRun.current !== data.runId)) {
          pendingRun.current = "";
          setMessage("");
        }
        setError("");
      },
      () => {
        setLoading(false);
        setSession(null);
        setError("Nao foi possivel acessar o robo. Verifique a conexao e as regras do Firebase.");
      },
    );
  }, []);

  const fresh = !!session && !fromCache && now - session.updatedAt.toMillis() < 45000 &&
    now - session.updatedAt.toMillis() > -30000;
  const qrFresh = !!session?.qrAt && now - session.qrAt.toMillis() < 45000 &&
    now - session.qrAt.toMillis() > -30000;

  async function disconnect() {
    const db = firestore;
    if (!db || !session || !fresh || busy) return;
    if (!window.confirm("Desconectar este WhatsApp do robo?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, "botSessions", "whatsapp");
        const snapshot = await transaction.get(sessionRef);
        const current = snapshot.data();
        if (!isSession(current) || current.runId !== session.runId ||
            current.status !== "connected" || Date.now() - current.updatedAt.toMillis() >= 45000) {
          throw new Error("O robo nao esta conectado. Atualize o painel e tente novamente.");
        }
        transaction.set(doc(db, "botCommands", "whatsapp"), {
          runId: current.runId,
          requestId: crypto.randomUUID(),
          requestedAt: serverTimestamp(),
        });
      });
      pendingRun.current = session.runId;
      setMessage("Pedido enviado. Aguarde a confirmacao da desconexao.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel solicitar a desconexao.");
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    const status = loading
      ? "Verificando conexão..."
      : error
        ? "Não foi possível verificar"
        : !fresh || session?.status === "offline"
          ? "Robô offline"
          : session?.status === "connected"
            ? "Conectado"
            : session?.status === "error"
              ? "Robô com falha"
              : session?.status === "qr" && session.qr && qrFresh
                ? "Aguardando leitura do QR"
                : session?.status === "disconnecting"
                  ? "Desconectando..."
                  : "Aguardando o robô";
    return (
      <button
        className="rounded-2xl border border-[#e8ddd4] bg-white p-5 text-left shadow-sm transition hover:border-[#c5aa97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a6a5a]"
        onClick={onOpen}
        type="button"
      >
        <span className="text-sm font-medium text-[#766457]">WhatsApp</span>
        <strong className="mt-3 block text-lg text-[#493a33]">{status}</strong>
        <span className="mt-2 block text-sm font-semibold text-[#9a6b55]">Ver conexão →</span>
      </button>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-[#e8ddd4] p-4 sm:p-5">
      <h3 className="font-semibold text-[#5c4a3f]">WhatsApp do robo</h3>
      <p className="mt-2 text-sm text-[#6b625b]">
        O robo precisa estar ligado e conectado ao Firebase. A integracao com WhatsApp nao e oficial.
      </p>
      {loading ? <p className="mt-3 text-sm">Verificando conexao...</p> : error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>
      ) : !fresh || session?.status === "offline" ? (
        <p className="mt-3 text-sm">Robo offline. Inicie o processo no computador ou servidor.</p>
      ) : session?.status === "error" ? (
        <p className="mt-3 text-sm text-red-700" role="alert">O robo informou uma falha. Confira o servidor.</p>
      ) : session?.status === "qr" && session.qr && qrFresh ? (
        <div className="mt-3">
          <p className="text-sm">No WhatsApp, abra Dispositivos conectados e escaneie este QR. Nao o compartilhe.</p>
          <Image alt="QR code para conectar o WhatsApp" className="mt-3 max-w-full" height={256}
            src={session.qr} unoptimized width={256} />
        </div>
      ) : session?.status === "connected" ? (
        <div className="mt-3">
          <p className="text-sm text-green-700">WhatsApp conectado.</p>
          <button className="mt-3 min-h-10 rounded-lg border border-red-700 px-4 text-sm font-semibold text-red-700 disabled:opacity-60"
            disabled={busy || !!message} onClick={disconnect} type="button">
            {busy ? "Solicitando..." : "Desconectar"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm">
          {session?.status === "disconnecting" ? "Desconectando..." : "Aguardando o robo ou um novo QR code..."}
        </p>
      )}
      {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    </section>
  );
}
