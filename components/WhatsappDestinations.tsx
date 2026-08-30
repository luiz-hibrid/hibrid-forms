"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================
// Seletor de destinos de alerta no WhatsApp.
//
// Um destino é um número com DDI ou um JID de grupo. O valor sai daqui como
// lista separada por vírgula — o mesmo formato do campo de e-mails.
// Usado na aba Ajustes do formulário e na página do cliente (workspace).
// ============================================================

const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--acc2)] focus:shadow-[0_0_0_3px_var(--ring-accent)]";

interface Group {
  id: string;
  name: string;
  participants?: number;
}

/** Mesma validação do servidor (lib/whatsapp.ts) — evita salvar destino torto. */
function normalize(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes("@")) {
    const jid = v.toLowerCase();
    return /^\d{10,25}@g\.us$/.test(jid) ? jid : null;
  }
  let d = v.replace(/\D/g, "");
  if (!d) return null;
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) d = "55" + d;
  return /^\d{10,15}$/.test(d) ? d : null;
}

function parseList(raw: string): string[] {
  const out = raw
    .split(",")
    .map((p) => normalize(p))
    .filter((p): p is string => Boolean(p));
  return Array.from(new Set(out));
}

function prettyNumber(d: string): string {
  const n = d.startsWith("55") ? d.slice(2) : d;
  if (n.length === 11) return `+55 (${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `+55 (${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `+${d}`;
}

export default function WhatsappDestinations({
  value,
  onChange,
  placeholderHint,
}: {
  /** Lista separada por vírgula. */
  value: string;
  onChange: (next: string) => void;
  /** Texto extra abaixo do campo (varia entre formulário e workspace). */
  placeholderHint?: string;
}) {
  const [mode, setMode] = useState<"number" | "group">("number");
  const [draft, setDraft] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsState, setGroupsState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const destinos = parseList(value);

  const setDestinos = useCallback(
    (list: string[]) => onChange(Array.from(new Set(list)).join(", ")),
    [onChange]
  );

  const loadGroups = useCallback(async () => {
    setGroupsState("loading");
    setGroupsError(null);
    try {
      const res = await fetch("/api/admin/whatsapp", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) {
        setGroups(j.groups ?? []);
        setGroupsState("ok");
      } else {
        setGroupsError(j.error || "não foi possível listar os grupos");
        setGroupsState("error");
      }
    } catch {
      setGroupsError("falha de rede ao listar os grupos");
      setGroupsState("error");
    }
  }, []);

  // Só busca os grupos quando o usuário realmente entra no modo grupo.
  useEffect(() => {
    if (mode === "group" && groupsState === "idle") void loadGroups();
  }, [mode, groupsState, loadGroups]);

  function add(raw: string) {
    const norm = normalize(raw);
    if (!norm) return;
    setDestinos([...destinos, norm]);
    setDraft("");
    setTestResult(null);
  }

  function remove(dest: string) {
    setDestinos(destinos.filter((d) => d !== dest));
    setTestResult(null);
  }

  async function runTest() {
    if (!destinos.length) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: destinos.join(", ") }),
      });
      const j = await res.json();
      setTestResult(
        j.ok
          ? {
              ok: true,
              msg:
                j.failed > 0
                  ? `Enviado para ${j.sent} de ${j.sent + j.failed} destinos. Falha: ${j.error}`
                  : `Mensagem de teste enviada para ${j.sent} destino${j.sent > 1 ? "s" : ""}.`,
            }
          : { ok: false, msg: j.error || "falha ao enviar" }
      );
    } catch {
      setTestResult({ ok: false, msg: "falha de rede" });
    } finally {
      setTesting(false);
    }
  }

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name;
  const draftValid = Boolean(normalize(draft));

  return (
    <div>
      {/* destinos já escolhidos */}
      {destinos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {destinos.map((d) => {
            const isGroup = d.endsWith("@g.us");
            return (
              <span
                key={d}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] py-1 pl-3 pr-1 text-[0.78rem] text-[var(--text)]"
              >
                <span aria-hidden="true">{isGroup ? "👥" : "📱"}</span>
                <span>
                  {isGroup ? groupName(d) || "Grupo" : prettyNumber(d)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  aria-label={`Remover ${isGroup ? groupName(d) || "grupo" : prettyNumber(d)}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text3)] transition hover:bg-[var(--border)] hover:text-[var(--text)]"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* alternador número / grupo */}
      <div className="mb-2 inline-flex rounded-full border border-[var(--border)] p-0.5">
        {(["number", "group"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setDraft("");
            }}
            className={`rounded-full px-3 py-1 text-[0.72rem] transition ${
              mode === m
                ? "bg-[var(--text)] text-[var(--card)]"
                : "text-[var(--text2)] hover:text-[var(--text)]"
            }`}
          >
            {m === "number" ? "Número" : "Grupo"}
          </button>
        ))}
      </div>

      {mode === "number" ? (
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder="(11) 99999-8888"
          />
          <button
            type="button"
            onClick={() => add(draft)}
            disabled={!draftValid}
            className="shrink-0 rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--card)] transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
      ) : (
        <div>
          {groupsState === "loading" && (
            <p className="mono text-[0.72rem] text-[var(--text3)]">Carregando grupos…</p>
          )}

          {groupsState === "ok" && (
            <select
              className={inputCls}
              value=""
              onChange={(e) => {
                if (e.target.value) add(e.target.value);
              }}
            >
              <option value="">
                {groups.length ? "Escolha um grupo…" : "Nenhum grupo encontrado"}
              </option>
              {groups
                .filter((g) => !destinos.includes(g.id))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.participants ? ` (${g.participants})` : ""}
                  </option>
                ))}
            </select>
          )}

          {groupsState === "error" && (
            <div>
              <p className="mb-2 text-[0.72rem] text-[var(--red)]">
                {groupsError} — cole o ID do grupo manualmente:
              </p>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="120363xxxxxxxxx@g.us"
                />
                <button
                  type="button"
                  onClick={() => add(draft)}
                  disabled={!draftValid}
                  className="shrink-0 rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--card)] transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Adicionar
                </button>
              </div>
              <button
                type="button"
                onClick={() => void loadGroups()}
                className="mono mt-2 text-[0.68rem] text-[var(--text3)] underline transition hover:text-[var(--text)]"
              >
                Tentar listar de novo
              </button>
            </div>
          )}
        </div>
      )}

      {/* teste */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={testing || !destinos.length}
          className="rounded-full border border-[var(--border)] px-4 py-1.5 text-[0.75rem] font-semibold text-[var(--text)] transition hover:border-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testing ? "Enviando…" : "Enviar teste"}
        </button>
        {testResult && (
          <span
            className={`text-[0.72rem] ${
              testResult.ok ? "text-[var(--text2)]" : "text-[var(--red)]"
            }`}
          >
            {testResult.ok ? "✓ " : "✕ "}
            {testResult.msg}
          </span>
        )}
      </div>

      {placeholderHint && (
        <p className="mono mt-2 text-[0.68rem] text-[var(--text3)]">{placeholderHint}</p>
      )}
    </div>
  );
}
