"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  nome: string | null;
  email: string | null;
  form_name: string | null;
  form_slug: string;
  status: string;
  tier: string | null;
  qualified: boolean | null;
  gads_status: string | null;
  created_at: string;
};
type Theme = "light" | "dark" | "system";
const THEME_KEY = "hf-admin-theme";
const SEEN_KEY = "hf-admin-seen";

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const el = document.querySelector<HTMLElement>(".gl-admin");
  if (el) el.dataset.theme = dark ? "dark" : "light";
}
function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "system" ? t : "light";
  } catch {
    return "light";
  }
}
function ago(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `há ${d} d` : new Date(iso).toLocaleDateString("pt-BR");
}
function initialsOf(email: string) {
  if (!email) return "AD"; // sessão sem e-mail (login legado): "AD" de admin
  const local = (email.split("@")[0] || "").trim();
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  const raw = parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return (raw || "?").toUpperCase();
}
const leadName = (i: Item) => i.nome || i.email || "Lead";

const ICON = {
  inbox: "M4 13.5L6.3 6a2 2 0 011.9-1.5h7.6A2 2 0 0117.7 6l2.3 7.5V18a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 13.5h4.5l1.5 2.5h4l1.5-2.5H20",
  bell: "M6 16v-5a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4",
  moon: "M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z",
  device: "M7 2.5h10a1.5 1.5 0 011.5 1.5v16a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 20V4A1.5 1.5 0 017 2.5zM11 18.5h2",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 3l1.6 2.6 3-.4.8 2.9 2.6 1.5-1 2.8 1 2.8-2.6 1.5-.8 2.9-3-.4L12 21l-1.6-2.6-3 .4-.8-2.9L4 14.4l1-2.8-1-2.8 2.6-1.5.8-2.9 3 .4z",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  out: "M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
};
const Ico = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Atividade, notificações e menu do usuário (tema, navegação, sair) — canto superior direito. */
export function AdminTools({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [user, setUser] = useState({ email: "", role: "client" as "master" | "client" });
  const [panel, setPanel] = useState<null | "activity" | "notif" | "me">(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [seen, setSeen] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/activity", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items ?? []);
      setUser(d.user ?? { email: "", role: "client" });
    } catch {
      /* sem rede: mantém o que já tinha */
    }
  }, []);

  useEffect(() => {
    // estado inicial vindo do navegador (tema e "visto até") + primeira carga
    setTheme(readTheme());
    setSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // tema "seguir o sistema" reage à troca do sistema
  useEffect(() => {
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);

  // fecha ao clicar fora / Esc
  useEffect(() => {
    if (panel !== "notif" && panel !== "me") return;
    const down = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setPanel(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [panel]);

  // notificações: leads qualificados/quentes e falhas de envio ao Google Ads
  const notices = items
    .filter((i) => (i.status === "complete" && (i.qualified || i.tier === "quente")) || i.gads_status === "failed")
    .slice(0, 12);
  const unread = notices.filter((n) => new Date(n.created_at).getTime() > seen).length;

  function pickTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignora */
    }
  }
  function openNotif() {
    setPanel(panel === "notif" ? null : "notif");
    const now = Date.now();
    setSeen(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* ignora */
    }
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="ga-tools" ref={root}>
      {children}
      <button type="button" className="ga-ibtn" aria-label="Atividade" title="Atividade" onClick={() => setPanel(panel === "activity" ? null : "activity")}>
        <Ico d={ICON.inbox} />
      </button>

      <div className="ga-pop-wrap">
        <button type="button" className="ga-ibtn" aria-label={unread ? `Notificações, ${unread} novas` : "Notificações"} title="Notificações" aria-haspopup="dialog" aria-expanded={panel === "notif"} onClick={openNotif}>
          <Ico d={ICON.bell} />
          {unread > 0 && <span className="ga-dot-badge" />}
        </button>
        {panel === "notif" && (
          <div className="ga-pop ga-pop--wide" role="dialog" aria-label="Notificações">
            <div className="ga-pop__head">
              <span>Notificações</span>
              <span className="ga-pop__sub">{notices.length ? `${notices.length} recentes` : ""}</span>
            </div>
            <div className="ga-pop__list">
              {notices.length === 0 && <p className="ga-pop__empty">Tudo em dia por aqui.</p>}
              {notices.map((n) => (
                <Link key={n.id} href={`/admin/${n.id}`} className="ga-pop__row" onClick={() => setPanel(null)}>
                  <span className={`ga-pop__ico${n.gads_status === "failed" ? " is-bad" : ""}`}>
                    <Ico d={n.gads_status === "failed" ? ICON.close : ICON.check} size={15} />
                  </span>
                  <span className="ga-pop__txt">
                    <b>
                      {n.gads_status === "failed" ? `Falha no envio ao Google Ads · ${leadName(n)}` : `Lead ${n.tier === "quente" ? "quente" : "qualificado"} · ${leadName(n)}`}
                    </b>
                    <small>
                      {n.form_name || n.form_slug} · {ago(n.created_at)}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="ga-pop-wrap">
        <button type="button" className="ga-me" aria-label="Menu da conta" aria-haspopup="menu" aria-expanded={panel === "me"} onClick={() => setPanel(panel === "me" ? null : "me")}>
          {initialsOf(user.email)}
        </button>
        {panel === "me" && (
          <div className="ga-pop ga-pop--menu" role="menu">
            <div className="ga-pop__who">
              <b>{user.email || "Conta"}</b>
              <span className="ga-pop__role">{user.role === "master" ? "Master" : "Cliente"}</span>
            </div>
            <Link role="menuitem" href="/admin/forms" className="ga-menu__item" onClick={() => setPanel(null)}>
              <Ico d={ICON.doc} /> Formulários
            </Link>
            {user.role === "master" && (
              <Link role="menuitem" href="/admin/workspaces" className="ga-menu__item" onClick={() => setPanel(null)}>
                <Ico d={ICON.gear} /> Clientes e workspaces
              </Link>
            )}
            <hr className="ga-menu__sep" />
            {(
              [
                ["light", "Claro", ICON.sun],
                ["dark", "Escuro", ICON.moon],
                ["system", "Seguir o sistema", ICON.device],
              ] as const
            ).map(([t, label, d]) => (
              <button key={t} type="button" role="menuitemradio" aria-checked={theme === t} className="ga-menu__item" onClick={() => pickTheme(t)}>
                <Ico d={d} /> {label}
                {theme === t && <span className="ga-menu__check"><Ico d={ICON.check} size={16} /></span>}
              </button>
            ))}
            <hr className="ga-menu__sep" />
            <button type="button" role="menuitem" className="ga-menu__item is-danger" onClick={logout}>
              <Ico d={ICON.out} /> Sair
            </button>
          </div>
        )}
      </div>

      {panel === "activity" && (
        <div className="ld-overlay" onClick={() => setPanel(null)}>
          <aside className="ld-panel" role="dialog" aria-modal="true" aria-label="Atividade" onClick={(e) => e.stopPropagation()}>
            <div className="ld-top">
              <h2 className="ga-act__title">Atividade</h2>
              <button type="button" className="ld-close" onClick={() => setPanel(null)} aria-label="Fechar">
                <Ico d={ICON.close} />
              </button>
            </div>
            <p className="ga-pop__sub" style={{ marginTop: -6 }}>Leads e envios mais recentes, do mais novo ao mais antigo.</p>
            <ol className="ga-act">
              {items.length === 0 && <li className="ga-pop__empty">Nenhuma atividade ainda.</li>}
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={`/admin/${i.id}`} className="ga-act__row" onClick={() => setPanel(null)}>
                    <span className="ga-feed__av">{leadName(i)[0]?.toUpperCase()}</span>
                    <span className="ga-pop__txt">
                      <b>
                        {leadName(i)} <span className="ga-act__what">{i.status === "complete" ? "concluiu" : "iniciou"} {i.form_name || i.form_slug}</span>
                      </b>
                      <small>
                        {ago(i.created_at)}
                        {i.status === "complete" && i.tier ? ` · ${i.tier}` : ""}
                        {i.gads_status === "sent" ? " · enviado ao Google Ads" : i.gads_status === "failed" ? " · falha no Google Ads" : ""}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
