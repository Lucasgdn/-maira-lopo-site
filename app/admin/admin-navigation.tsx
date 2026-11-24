"use client";

import { useEffect } from "react";
import Link from "next/link";

export type AdminSection = "inicio" | "agenda" | "reservas" | "profissionais" | "whatsapp";

const items: { id: AdminSection; label: string; icon: string }[] = [
  { id: "inicio", label: "Início", icon: "⌂" },
  { id: "agenda", label: "Agenda", icon: "▦" },
  { id: "reservas", label: "Reservas", icon: "☷" },
  { id: "profissionais", label: "Profissionais e horários", icon: "◷" },
  { id: "whatsapp", label: "WhatsApp", icon: "◌" },
];

type Props = {
  active: AdminSection;
  open: boolean;
  onSelect: (section: AdminSection) => void;
  onClose: () => void;
  onLogout: () => void;
  email: string | null;
};

export default function AdminNavigation({ active, open, onSelect, onClose, onLogout, email }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] flex-col border-r border-[#e8ddd4] bg-white px-5 py-6 shadow-xl md:flex md:w-64 md:shadow-none`}
        id="admin-navigation"
      >
        <div className="flex items-start justify-between gap-3 px-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a36f5a]">Maira Lopo</p>
            <p className="mt-1 text-lg font-semibold text-[#493a33]">Painel administrativo</p>
          </div>
          <button aria-label="Fechar menu" className="min-h-10 min-w-10 text-xl md:hidden" onClick={onClose} type="button">×</button>
        </div>
        <p className="mb-3 mt-9 px-3 text-xs font-semibold uppercase tracking-wider text-[#a29489]">Menu</p>
        <nav aria-label="Navegação do painel" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <button
              aria-current={active === item.id ? "page" : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${
                active === item.id
                  ? "bg-[#f5ebe0] font-semibold text-[#754a38]"
                  : "text-[#6b625b] hover:bg-[#fff8f2]"
              }`}
              key={item.id}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              <span aria-hidden="true" className="w-6 text-center text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="space-y-3 border-t border-[#eee5dd] px-2 pt-4 text-sm">
          {email && <p className="break-all text-xs text-[#8a7b6e]">{email}</p>}
          <div className="flex flex-wrap gap-4">
            <Link className="font-medium text-[#7a6a5a] underline" href="/">Ver site</Link>
            <button className="font-medium text-[#7a6a5a] underline" onClick={onLogout} type="button">Sair</button>
          </div>
        </div>
      </aside>
    </>
  );
}
