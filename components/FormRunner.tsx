"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Field, FormConfig } from "@/lib/types";
import { computeScore, resolveTier } from "@/lib/scoring";

type Answers = Record<string, string | string[]>;

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
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const trackingRef = useRef<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const total = form.steps.length;
  const step = form.steps[index];
  const progress = Math.round(((index + (done ? 1 : 0)) / total) * 100);

  // Captura parâmetros de tracking da URL (utm, gclid, fbclid)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t: Record<string, string> = {};
    for (const key of TRACKING_KEYS) {
      const val = params.get(key);
      if (val) t[key] = val;
    }
    trackingRef.current = t;
  }, []);

  // Foca o input ao trocar de etapa
  useEffect(() => {
    setError(null);
    const id = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [index]);

  const result = useMemo(() => {
    const score = computeScore(form, answers);
    const tier = resolveTier(form, score);
    const screen =
      form.endScreens.find((s) => s.tier === tier.id) ?? form.endScreens[0];
    return { score, tier, screen };
  }, [answers, form]);

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
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    if (index < total - 1) {
      setIndex((i) => i + 1);
    } else {
      finish();
    }
  }

  function goBack() {
    if (index > 0) setIndex((i) => i - 1);
  }

  async function finish(finalAnswers: Answers = answers) {
    setSubmitting(true);
    const score = computeScore(form, finalAnswers);
    const tier = resolveTier(form, score);
    const screen = form.endScreens.find((s) => s.tier === tier.id);
    const qualified = !!screen?.qualified;
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
        w.gtag("event", "generate_lead", { value: score, tier: tier.id });
      }
    } catch {}

    const payload = {
      form: { slug: form.slug, name: form.name },
      status: "complete" as const,
      answers: finalAnswers,
      score,
      tier: tier.id,
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

  // Escolha única com auto-avanço
  function selectSingle(field: Field, value: string) {
    const next = { ...answers, [field.id]: value };
    setAnswer(field.id, value);
    setTimeout(() => {
      if (index < total - 1) setIndex((i) => i + 1);
      else finish(next); // usa as respostas já com a última seleção
    }, 260);
  }

  if (done) {
    return <EndScreen result={result} answers={answers} />;
  }

  return (
    <div className="flex-1 flex items-center justify-center px-5 pb-10">
      <div className="w-full max-w-[620px]">
        {/* Progresso */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="lbl">
              {step.type === "welcome"
                ? form.eyebrow ?? "Começar"
                : `Etapa ${index} de ${total - 1}`}
            </span>
            <span className="mono text-[11px] text-[var(--text3)]">
              {Math.max(progress, 0)}%
            </span>
          </div>
          <div className="h-[3px] w-full rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 4)}%` }}
            />
          </div>
        </div>

        {/* Card da etapa */}
        <div
          key={index}
          className="step-in rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-9 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <StepBody
            field={step}
            answers={answers}
            inputRef={inputRef}
            onChange={setAnswer}
            onSelectSingle={selectSingle}
            onEnter={goNext}
          />

          {error && (
            <p className="mt-4 text-sm text-[var(--red)]">{error}</p>
          )}

          {/* Ações */}
          <div className="mt-8 flex items-center gap-3">
            {step.type === "welcome" ? (
              <PrimaryButton onClick={goNext} disabled={submitting}>
                {step.buttonLabel ?? "Começar"}
              </PrimaryButton>
            ) : (
              <>
                {step.type !== "single" && (
                  <PrimaryButton onClick={goNext} disabled={submitting}>
                    {index === total - 1
                      ? submitting
                        ? "Enviando…"
                        : "Ver meu resultado"
                      : "Continuar"}
                  </PrimaryButton>
                )}
                {index > 0 && (
                  <button
                    onClick={goBack}
                    className="text-sm text-[var(--text2)] hover:text-[var(--text)] transition px-3 py-2"
                  >
                    Voltar
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {step.type === "welcome" && (
          <p className="mt-5 text-center mono text-[11px] text-[var(--text3)]">
            Leva menos de 1 minuto · Seus dados estão seguros
          </p>
        )}
      </div>
    </div>
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
      <h1 className="text-[1.6rem] sm:text-[1.9rem] font-black leading-tight tracking-tight text-[var(--text)]">
        {field.title}
      </h1>
      {field.subtitle && (
        <p className="mt-3 text-[0.95rem] text-[var(--text2)] leading-relaxed">
          {field.subtitle}
        </p>
      )}

      <div className="mt-7">
        {(field.type === "text" ||
          field.type === "name" ||
          field.type === "email" ||
          field.type === "tel") && (
          <input
            ref={inputRef}
            type={
              field.type === "email"
                ? "email"
                : field.type === "tel"
                ? "tel"
                : "text"
            }
            inputMode={field.type === "tel" ? "numeric" : undefined}
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
                  <span className="font-medium text-[var(--text)]">
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
      className="group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-[0.95rem] font-bold text-[var(--text)] transition-all duration-200 hover:bg-[var(--acc2)] hover:-translate-y-[1px] disabled:opacity-45 disabled:pointer-events-none"
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
  result,
  answers,
}: {
  result: {
    score: number;
    tier: { id: string; name: string; color: string };
    screen: {
      title: string;
      message: string;
      ctaLabel?: string;
      ctaHref?: string;
      qualified?: boolean;
    };
  };
  answers: Answers;
}) {
  const { screen, tier } = result;
  const rawName =
    typeof answers["nome"] === "string" ? (answers["nome"] as string) : "";
  const firstName = rawName.trim().split(" ")[0] || "";
  const title = screen.title.replace(/\{nome\}/g, firstName);
  const message = screen.message.replace(/\{nome\}/g, firstName);
  const isHot = tier.id === "quente";

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
        <p className="mt-4 text-[1rem] text-[var(--text2)] leading-relaxed">
          {message}
        </p>

        {screen.ctaLabel && screen.ctaHref && (
          <a
            href={screen.ctaHref}
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-7 py-3.5 text-[0.95rem] font-bold text-[var(--text)] transition-all duration-200 hover:bg-[var(--acc2)] hover:-translate-y-[1px]"
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
