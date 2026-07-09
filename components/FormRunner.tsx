"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Field, FormConfig, EndScreen as EndScreenType } from "@/lib/types";
import { END_STEP } from "@/lib/types";
import { computeScore, scorePct } from "@/lib/scoring";
import { normalizeEnds, resolveEndScreen, END_PREFIX } from "@/lib/ends";
import { MediaView } from "@/components/MediaView";

type Answers = Record<string, string | string[]>;
type NextTarget = { kind: "step"; index: number } | { kind: "end"; endId?: string };

const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
];

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function FormRunner({ form }: { form: FormConfig }) {
  // Histórico de índices visitados (suporta fluxo condicional e "Voltar")
  const [history, setHistory] = useState<number[]>([0]);
  const index = history[history.length - 1];
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resolvedEnd, setResolvedEnd] = useState<EndScreenType | null>(null);
  const trackingRef = useRef<Record<string, string>>({});
  const startedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function track(type: "view" | "start") {
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: form.slug, type }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
  function pushDL(obj: Record<string, unknown>) {
    try {
      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push(obj);
    } catch {}
  }
  function fireStart() {
    if (startedRef.current) return;
    startedRef.current = true;
    track("start");
    pushDL({ event: "form_start", form_slug: form.slug });
  }

  const total = form.steps.length;
  const step = form.steps[index];
  const progress = Math.round(((index + (done ? 1 : 0)) / total) * 100);

  const ends = useMemo(() => normalizeEnds(form), [form]);

  // Resolve o destino a partir de uma opção (fluxo condicional / tela final)
  function targetFromOption(opt?: { next?: string }): NextTarget {
    if (!opt?.next) return { kind: "step", index: index + 1 };
    if (opt.next === END_STEP) return { kind: "end" };
    if (opt.next.startsWith(END_PREFIX))
      return { kind: "end", endId: opt.next.slice(END_PREFIX.length) };
    const i = form.steps.findIndex((s) => s.id === opt.next);
    return i >= 0 ? { kind: "step", index: i } : { kind: "step", index: index + 1 };
  }

  function goTarget(t: NextTarget, finalAnswers?: Answers) {
    if (t.kind === "end") {
      finish(finalAnswers, t.endId);
      return;
    }
    if (t.index >= total) {
      finish(finalAnswers);
      return;
    }
    setHistory((prev) => [...prev, t.index]);
  }

  // Captura parâmetros de tracking da URL (utm, gclid, fbclid)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t: Record<string, string> = {};
    for (const key of TRACKING_KEYS) {
      const val = params.get(key);
      if (val) t[key] = val;
    }
    trackingRef.current = t;
    track("view");
    pushDL({ event: "form_view", form_slug: form.slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foca o input ao trocar de etapa
  useEffect(() => {
    setError(null);
    const id = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [index]);

  // Enter inicia na tela de boas-vindas
  useEffect(() => {
    if (step.type !== "welcome") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step.type]);

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setError(null);
  }

  function validate(field: Field): string | null {
    const val = answers[field.id];
    if (field.type === "welcome") return null;
    if (field.required && (!val || (Array.isArray(val) && val.length === 0))) {
      return "Esse campo é obrigatório.";
    }
    if (field.type === "email" && typeof val === "string" && !isValidEmail(val)) {
      return "Digite um e-mail válido.";
    }
    if (field.type === "tel" && typeof val === "string") {
      const digits = val.replace(/\D/g, "");
      if (digits.length < 10) return "Digite um telefone com DDD.";
    }
    return null;
  }

  function goNext() {
    fireStart();
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    goTarget({ kind: "step", index: index + 1 });
  }

  function goBack() {
    if (history.length > 1) setHistory((prev) => prev.slice(0, -1));
  }

  async function finish(finalAnswers: Answers = answers, forcedEndId?: string) {
    setSubmitting(true);
    const score = computeScore(form, finalAnswers);
    const pct = scorePct(form, score);
    const sortedTiers = [...ends.tiers].sort((a, b) => b.minPct - a.minPct);
    const tier =
      sortedTiers.find((t) => pct >= t.minPct) ??
      sortedTiers[sortedTiers.length - 1] ??
      null;
    const tierId = tier?.id ?? null;
    const screen = resolveEndScreen(ends, { forcedEndId, scorePct: pct });
    const qualified = !!screen?.qualified;
    setResolvedEnd(screen);
    const eventId = newEventId();

    // Dispara eventos client-side (mesmo event_id do server p/ deduplicar)
    const w = window as unknown as {
      fbq?: (...a: unknown[]) => void;
      gtag?: (...a: unknown[]) => void;
    };
    try {
      if (w.fbq) {
        w.fbq("track", "Lead", { value: score }, { eventID: eventId });
        if (qualified)
          w.fbq("trackCustom", "LeadQualificado", { value: score }, { eventID: eventId });
      }
      if (w.gtag) {
        w.gtag("event", "generate_lead", { value: score, tier: tierId });
      }
    } catch {}

    // dataLayer rico para o GTM (GA4 EC, Meta AM, Google Ads EC)
    const leadEmail = (finalAnswers["email"] as string) || "";
    const leadPhone = (finalAnswers["telefone"] as string) || "";
    const leadName = (finalAnswers["nome"] as string) || "";
    pushDL({
      event: "generate_lead",
      form_slug: form.slug,
      form_name: form.name,
      value: score,
      currency: "BRL",
      tier: tierId,
      qualified,
      event_id: eventId,
      gclid: trackingRef.current.gclid,
      fbclid: trackingRef.current.fbclid,
      utm_source: trackingRef.current.utm_source,
      utm_medium: trackingRef.current.utm_medium,
      utm_campaign: trackingRef.current.utm_campaign,
      lead: { email: leadEmail, phone: leadPhone, name: leadName },
      // user_data no formato esperado pelas Enhanced Conversions (GTM faz o hash)
      user_data: {
        email_address: leadEmail,
        phone_number: leadPhone,
        address: { first_name: leadName.split(" ")[0] || undefined },
      },
    });

    const payload = {
      form: { slug: form.slug, name: form.name },
      status: "complete" as const,
      answers: finalAnswers,
      score,
      tier: tierId,
      qualified,
      tracking: trackingRef.current,
      pixel_event: {
        event_id: eventId,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        ga: getCookie("_ga"),
        event_source_url:
          typeof window !== "undefined" ? window.location.href : "",
      },
      submitted_at: new Date().toISOString(),
    };
    // Envia sem bloquear: a tela final aparece na hora; o servidor
    // grava no banco, dispara o webhook do CRM e os eventos server-side.
    fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
    setSubmitting(false);
    setDone(true);
  }

  // Escolha única com auto-avanço + roteamento condicional
  function selectSingle(field: Field, value: string) {
    fireStart();
    const next = { ...answers, [field.id]: value };
    const opt = field.options?.find((o) => o.value === value);
    const target = targetFromOption(opt);
    setAnswer(field.id, value);
    setTimeout(() => {
      goTarget(target, next); // usa as respostas já com a última seleção
    }, 260);
  }

  if (done) {
    return <EndScreen screen={resolvedEnd} answers={answers} />;
  }

  return (
    <>
      {/* Barra de progresso no topo (só nas perguntas) */}
      {step.type !== "welcome" && (
        <div className="fixed left-0 top-0 z-30 h-1.5 w-full bg-black/10">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(progress, 3)}%`,
              background: "var(--form-title, #111)",
            }}
          />
        </div>
      )}

      {/* Conteúdo centralizado, sem card/borda, ocupando a tela */}
      <div className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
        <div key={index} className="step-in w-full max-w-[640px]">
          <StepBody
            field={step}
            answers={answers}
            inputRef={inputRef}
            onChange={setAnswer}
            onSelectSingle={selectSingle}
            onEnter={goNext}
          />

          {error && <p className="mt-4 text-sm text-[var(--red)]">{error}</p>}

          {/* Ação */}
          {step.type !== "single" && (
            <div className="mt-8 flex items-center gap-3">
              <PrimaryButton onClick={goNext} disabled={submitting}>
                {step.type === "welcome"
                  ? step.buttonLabel ?? "Começar"
                  : index === total - 1
                  ? submitting
                    ? "Enviando…"
                    : "Ver meu resultado"
                  : "OK"}
              </PrimaryButton>
              <span
                className="mono text-xs"
                style={{ color: "var(--form-title)", opacity: 0.55 }}
              >
                Pressione Enter ↵
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navegação no rodapé (voltar / avançar) */}
      <div className="fixed bottom-5 right-5 z-30 flex items-center gap-1.5">
        <NavArrow
          dir="back"
          onClick={goBack}
          disabled={history.length <= 1}
        />
        <NavArrow dir="forward" onClick={goNext} disabled={submitting} />
      </div>
    </>
  );
}

function NavArrow({
  dir,
  onClick,
  disabled,
}: {
  dir: "back" | "forward";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "back" ? "Voltar" : "Avançar"}
      className="flex h-9 w-9 items-center justify-center rounded-md bg-black/85 text-white transition hover:bg-black disabled:opacity-30"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={dir === "back" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        />
      </svg>
    </button>
  );
}

// ============================================================
// Corpo da etapa (por tipo de campo)
// ============================================================
function StepBody({
  field,
  answers,
  inputRef,
  onChange,
  onSelectSingle,
  onEnter,
}: {
  field: Field;
  answers: Answers;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (id: string, value: string | string[]) => void;
  onSelectSingle: (field: Field, value: string) => void;
  onEnter: () => void;
}) {
  const value = answers[field.id];

  return (
    <div>
      {field.media && <MediaView media={field.media} />}
      <h1
        className="font-black leading-tight tracking-tight"
        style={{
          color: "var(--form-title, var(--text))",
          fontSize: "calc(1.8rem * var(--form-scale, 1))",
        }}
      >
        {field.title}
      </h1>
      {field.subtitle && (
        <p className="mt-3 whitespace-pre-line text-[0.95rem] text-[var(--text2)] leading-relaxed">
          {field.subtitle}
        </p>
      )}

      <div className="mt-7">
        {(field.type === "text" ||
          field.type === "name" ||
          field.type === "email" ||
          field.type === "tel" ||
          field.type === "link") && (
          <input
            ref={inputRef}
            type={
              field.type === "email"
                ? "email"
                : field.type === "tel"
                ? "tel"
                : field.type === "link"
                ? "url"
                : "text"
            }
            inputMode={
              field.type === "tel"
                ? "numeric"
                : field.type === "link"
                ? "url"
                : undefined
            }
            placeholder={field.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => {
              const v =
                field.type === "tel"
                  ? maskPhone(e.target.value)
                  : e.target.value;
              onChange(field.id, v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[1.05rem] text-[var(--text)] outline-none transition focus:border-[var(--acc2)] focus:shadow-[0_0_0_3px_rgba(194,251,141,0.4)]"
          />
        )}

        {field.type === "single" && field.options && (
          <div className="grid gap-2.5">
            {field.options.map((opt, i) => {
              const selected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onSelectSingle(field, opt.value)}
                  className={`group flex items-center justify-between rounded-lg border px-4 py-3.5 text-left transition-all duration-150 ${
                    selected
                      ? "border-[var(--accent)] bg-[rgba(194,251,141,0.12)] shadow-[0_0_0_1px_var(--accent)]"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-[#bbb] hover:-translate-y-[2px]"
                  }`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span
                    className="font-medium"
                    style={{ color: "var(--form-answer, var(--text))" }}
                  >
                    {opt.label}
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--border)] group-hover:border-[#bbb]"
                    }`}
                  >
                    {selected && (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#111"
                        strokeWidth="3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Botão primário (pill accent)
// ============================================================
function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex items-center gap-2 px-6 py-3 text-[0.95rem] font-bold transition-all duration-200 hover:-translate-y-[1px] hover:brightness-95 disabled:opacity-45 disabled:pointer-events-none"
      style={{
        background: "var(--form-btn-bg, var(--accent))",
        color: "var(--form-btn-text, var(--text))",
        borderRadius: "var(--form-radius, 9999px)",
      }}
    >
      {children}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="transition-transform duration-200 group-hover:translate-x-[3px]"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 8l4 4m0 0l-4 4m4-4H3"
        />
      </svg>
    </button>
  );
}

// ============================================================
// Tela final (condicional por faixa)
// ============================================================
function EndScreen({
  screen,
  answers,
}: {
  screen: EndScreenType | null;
  answers: Answers;
}) {
  const rawName =
    typeof answers["nome"] === "string" ? (answers["nome"] as string) : "";
  const firstName = rawName.trim().split(" ")[0] || "";
  const title = (screen?.title ?? "Obrigado!").replace(/\{nome\}/g, firstName);
  const message = (screen?.message ?? "").replace(/\{nome\}/g, firstName);
  const isHot = !!screen?.qualified;

  return (
    <div className="flex-1 flex items-center justify-center px-5 pb-16 pt-6">
      <div className="w-full max-w-[560px] text-center pop-in">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: isHot ? "var(--accent)" : "var(--border)",
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isHot ? "#111" : "#555"}
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="mt-7 text-[1.7rem] sm:text-[2rem] font-black leading-tight tracking-tight text-[var(--text)]">
          {title}
        </h1>
        <p className="mt-4 whitespace-pre-line text-[1rem] text-[var(--text2)] leading-relaxed">
          {message}
        </p>

        {screen?.ctaLabel && screen?.ctaHref && (
          <a
            href={screen.ctaHref}
            className="group mt-8 inline-flex items-center gap-2 px-7 py-3.5 text-[0.95rem] font-bold transition-all duration-200 hover:-translate-y-[1px] hover:brightness-95"
            style={{
              background: "var(--form-btn-bg, var(--accent))",
              color: "var(--form-btn-text, var(--text))",
              borderRadius: "var(--form-radius, 9999px)",
            }}
          >
            {screen.ctaLabel}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="transition-transform duration-200 group-hover:translate-x-[3px]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
