"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Hit = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  form_name: string | null;
  form_slug: string;
  status: string;
  tier: string | null;
  created_at: string;
};

const P = {
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM16.5 16.5L21 21",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 12v6M7 15h6",
  user: "M12 11a4 4 0 100-8 4 4 0 000 8zM4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6M19 8v6M16 11h6",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 3l1.6 2.6 3-.4.8 2.9 2.6 1.5-1 2.8 1 2.8-2.6 1.5-.8 2.9-3-.4L12 21l-1.6-2.6-3 .4-.8-2.9L4 14.4l1-2.8-1-2.8 2.6-1.5.8-2.9 3 .4z",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4",
  moon: "M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z",
};
const Ico = ({ d }: { d: string }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

function ago(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return min < 1 ? "agora" : `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `há ${d} d` : new Date(iso).toLocaleDateString("pt-BR");
}

/** Menu lateral da home: busca de leads, novo formulário, novo cliente, configurações e tema. */
export function AdminDock({ role }: { role: "master" | "client" }) {
  const router = useRouter();
  const path = usePathname() || "";
  const [dark, setDark] = useState(false);
  const [finder, setFinder] = useState(false);
  const [client, setClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const master = role === "master";

  // tema: lê o atual e acompanha mudanças feitas pelo menu do usuário
  useEffect(() => {
    const read = () => setDark(document.querySelector<HTMLElement>(".gl-admin")?.dataset.theme === "dark");
    read();
    window.addEventListener("hf-theme", read);
    return () => window.removeEventListener("hf-theme", read);
  }, []);
  function toggleTheme() {
    const next = dark ? "light" : "dark";
    const el = document.querySelector<HTMLElement>(".gl-admin");
    if (el) el.dataset.theme = next;
    try {
      localStorage.setItem("hf-admin-theme", next);
    } catch {
      /* sem storage: vale na sessão */
    }
    setDark(next === "dark");
    window.dispatchEvent(new Event("hf-theme"));
  }

  // ⌘K / Ctrl+K abre a busca
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFinder((f) => !f);
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  function flash(msg: string) {
    setNote(msg);
    setTimeout(() => setNote(""), 3500);
  }

  async function createForm() {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.id) router.push(`/admin/forms/${data.id}`);
    else if (data.error === "selecione_workspace") flash("Selecione um cliente no seletor de cliente antes de criar o formulário.");
    else flash("Não foi possível criar o formulário.");
  }

  const items = [
    { key: "search", label: "Buscar leads (⌘K)", icon: P.search, onClick: () => setFinder(true), show: true },
    { key: "form", label: "Novo formulário", icon: P.doc, onClick: createForm, show: master },
    { key: "client", label: "Novo cliente", icon: P.user, onClick: () => setClient(true), show: master },
  ].filter((i) => i.show);

  return (
    <>
      <nav className="ga-dock ga-dock--home" aria-label="Ações rápidas">
        {items.map((i) => (
          <button key={i.key} type="button" className="ga-dock__btn" aria-label={i.label} onClick={i.onClick} disabled={busy && i.key === "form"}>
            <Ico d={i.icon} />
            <span className="ga-dock__tip">{i.label}</span>
          </button>
        ))}
        <span className="ga-dock__sep" aria-hidden="true" />
        {master && (
          <Link href="/admin/workspaces" className="ga-dock__btn" aria-label="Configurações" aria-current={path.startsWith("/admin/workspaces") ? "page" : undefined} data-active={path.startsWith("/admin/workspaces")}>
            <Ico d={P.gear} />
            <span className="ga-dock__tip">Clientes</span>
          </Link>
        )}
        <button type="button" className="ga-dock__btn" aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} onClick={toggleTheme}>
          <Ico d={dark ? P.sun : P.moon} />
          <span className="ga-dock__tip">{dark ? "Tema claro" : "Tema escuro"}</span>
        </button>
      </nav>

      {note && (
        <div className="ga-toast" role="status">
          {note}
        </div>
      )}
      {finder && <LeadFinder onClose={() => setFinder(false)} />}
      {client && (
        <ClientDialog
          onClose={() => setClient(false)}
          onCreated={(id) => {
            setClient(false);
            router.push(`/admin/workspaces/${id}`);
          }}
          onError={flash}
        />
      )}
    </>
  );
}

function LeadFinder({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  // busca com pequena espera (debounce) para não consultar a cada tecla
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/leads/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal, cache: "no-store" });
        const d = await r.json();
        setHits(d.items ?? []);
        setSel(0);
      } catch {
        /* busca cancelada ou sem rede */
      }
      setLoading(false);
    }, 220);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  function open(h?: Hit) {
    if (!h) return;
    onClose();
    router.push(`/admin/${h.id}`);
  }

  return (
    <div className="ga-finder-overlay" onClick={onClose}>
      <div className="ga-finder" role="dialog" aria-modal="true" aria-label="Buscar leads" onClick={(e) => e.stopPropagation()}>
        <div className="ga-finder__bar">
          <Ico d={P.search} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar leads por nome, e-mail ou telefone…"
            aria-label="Buscar leads"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => (hits.length ? (s + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                open(hits[sel]);
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul className="ga-finder__list" role="listbox" aria-label="Resultados">
          {q.trim().length < 2 && <li className="ga-finder__empty">Digite pelo menos 2 letras para buscar em todos os leads.</li>}
          {q.trim().length >= 2 && !loading && hits.length === 0 && <li className="ga-finder__empty">Nenhum lead encontrado para “{q.trim()}”.</li>}
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === sel} className="ga-finder__opt" onPointerMove={() => setSel(i)} onClick={() => open(h)}>
              <span className="ga-feed__av">{(h.nome || h.email || "?").trim()[0]?.toUpperCase()}</span>
              <span className="ga-pop__txt">
                <b>{h.nome || h.email || "Lead"}</b>
                <small>
                  {[h.email, h.telefone].filter(Boolean).join(" · ") || "—"} · {h.form_name || h.form_slug} · {ago(h.created_at)}
                </small>
              </span>
              {h.status !== "complete" ? <span className="ga-finder__tag">Parcial</span> : h.tier ? <span className="ga-finder__tag">{h.tier}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ClientDialog({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (id: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const res = await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && d.id) onCreated(d.id);
    else onError("Não foi possível criar o cliente.");
  }

  return (
    <div className="ga-finder-overlay" onClick={onClose}>
      <form className="ga-modal" role="dialog" aria-modal="true" aria-label="Novo cliente" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Novo cliente</h2>
        <p className="ga-pop__sub">Cada cliente tem seus próprios formulários, leads e logins.</p>
        <input className="ld-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" aria-label="Nome do cliente" />
        <div className="ld-actions">
          <button type="button" className="ld-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="ld-btn ld-btn--accent" disabled={!name.trim() || saving}>
            {saving ? "Criando…" : "Criar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
