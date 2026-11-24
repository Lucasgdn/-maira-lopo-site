import { MAIRA_WHATSAPP_NUMBER } from "../lib/site-config";

type Props = {
  area: "site" | "admin";
};

export default function HelpSupport({ area }: Props) {
  const isAdmin = area === "admin";
  const message = isAdmin
    ? "Olá Maira! Estou com uma dúvida ou problema no painel administrativo. Preciso de ajuda com: "
    : "Olá Maira! Estou com uma dúvida ou problema no site/agendamento. Preciso de ajuda com: ";
  const whatsappUrl = `https://wa.me/${MAIRA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <details className="mx-auto mt-8 max-w-2xl rounded-xl border border-[#e5d7cb] bg-white p-4 text-left shadow-sm">
      <summary className="cursor-pointer font-semibold text-[#5c4a3f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a6a5a]">
        Ajuda e suporte
      </summary>
      {isAdmin ? (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#6b625b]">
          <p>Entre com sua conta para acessar a agenda e as reservas.</p>
          <p>
            Em <strong>Profissionais e horários</strong>, ajuste os dias e horários de
            atendimento e salve. Na <strong>Agenda</strong>, use <strong>Novo evento</strong>
            para bloquear um dia ou período.
          </p>
          <p>
            Nas reservas, confirme ou cancele o pedido. A ação atualiza a agenda e abre uma
            mensagem pronta no WhatsApp para você revisar e enviar à cliente.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#6b625b]">
          <p>
            Escolha um procedimento e toque em <strong>Agendar</strong>. Depois selecione
            uma data e um horário disponíveis.
          </p>
          <p>
            Informe seu nome e WhatsApp para enviar o pedido. A Maira entrará em contato
            para confirmar seu horário.
          </p>
        </div>
      )}
      <a
        className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#218c52] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176d3e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176d3e]"
        href={whatsappUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        Relatar um problema pelo WhatsApp
      </a>
    </details>
  );
}
