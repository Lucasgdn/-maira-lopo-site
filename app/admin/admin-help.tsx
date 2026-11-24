"use client";

import { useEffect, useRef, useState } from "react";
import { MAIRA_WHATSAPP_NUMBER } from "../lib/site-config";
import type { AdminSection } from "./admin-navigation";

type HelpSection = AdminSection | "login";

const help: Record<HelpSection, { title: string; tips: string[] }> = {
  login: {
    title: "Entrar no painel",
    tips: [
      "Entre com o e-mail e a senha da conta autorizada para administrar a agenda.",
      "Se esqueceu a senha, use o botão Esqueci minha senha. Nunca compartilhe sua senha.",
    ],
  },
  inicio: {
    title: "Resumo do dia",
    tips: [
      "Os atendimentos de hoje incluem reservas pendentes e confirmadas, mas não incluem bloqueios manuais.",
      "Pedidos aguardando contato conta as reservas pendentes de todas as datas.",
      "Toque nos cartões para abrir a agenda, as reservas ou a conexão do WhatsApp.",
    ],
  },
  agenda: {
    title: "Agenda semanal",
    tips: [
      "Use Hoje e as setas para navegar entre as semanas. Se houver mais de uma profissional, filtre a agenda pelo nome.",
      "Toque em Novo evento para bloquear um dia inteiro ou um horário. Bloqueios aparecem em roxo e reservas em verde.",
      "Para remover um bloqueio manual, use o botão de exclusão no próprio evento.",
    ],
  },
  reservas: {
    title: "Reservas",
    tips: [
      "Confira os pedidos recebidos e use as opções de cada reserva para confirmar, cancelar ou alterar o horário.",
      "Ao confirmar, cancelar ou alterar um horário, uma mensagem é preparada no WhatsApp para você revisar e enviar.",
      "O botão de lembrete também prepara uma mensagem; o envio não é automático.",
    ],
  },
  profissionais: {
    title: "Profissionais e horários",
    tips: [
      "Toque no nome da profissional para abrir ou recolher as configurações. Você também pode adicionar ou remover profissionais.",
      "Toque em um dia para editar seus horários. Abra Atalhos semanais para aplicar mudanças à equipe.",
      "Clique em Salvar disponibilidade para que as alterações entrem em vigor.",
    ],
  },
  whatsapp: {
    title: "Conexão do WhatsApp",
    tips: [
      "O robô precisa estar configurado e ligado no computador ou servidor para gerar o QR code.",
      "Quando o QR aparecer, abra Dispositivos conectados no WhatsApp e escaneie. Não compartilhe o código.",
      "Após conectar, use Desconectar para desvincular. Com o robô offline, faça isso em Dispositivos conectados no WhatsApp.",
      "A conexão não é oficial e pode sofrer bloqueios. Lembretes automáticos ainda não estão ativos.",
    ],
  },
};

export default function AdminHelp({ section }: { section: HelpSection }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const content = help[section];
  const message = `Olá Maira! Estou com uma dúvida ou problema em ${content.title} no painel administrativo. Preciso de ajuda com: `;
  const whatsappUrl = `https://wa.me/${MAIRA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative ml-auto" ref={containerRef}>
      <button
        aria-controls="admin-page-help"
        aria-expanded={open}
        aria-label={`Ajuda: ${content.title}`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d9c9bc] bg-white text-lg font-bold text-[#754a38] hover:bg-[#fff8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a6a5a]"
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        ?
      </button>
      {open && (
        <section
          aria-label={`Ajuda: ${content.title}`}
          className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-[#e8ddd4] bg-white p-5 text-left shadow-xl"
          id="admin-page-help"
        >
          <h2 className="font-semibold text-[#493a33]">{content.title}</h2>
          <ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-relaxed text-[#6b625b]">
            {content.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
          <a
            className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-[#218c52] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176d3e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176d3e]"
            href={whatsappUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Relatar um problema
          </a>
        </section>
      )}
    </div>
  );
}
