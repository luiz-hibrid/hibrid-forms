"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Field,
  FieldType,
  Option,
  Tier,
  EndScreen,
  PixelConfig,
} from "@/lib/types";
import { END_STEP } from "@/lib/types";
import type { FormRow } from "@/lib/forms-db";

// slugify local (evita importar módulo de servidor no client)
function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const TYPE_LABELS: Record<FieldType, string> = {
  welcome: "Tela de boas-vindas",
  text: "Texto",
  name: "Nome",
  email: "E-mail",
  tel: "Telefone / WhatsApp",
  link: "Link / site",
  single: "Escolha única (pontuável)",
  multi: "Múltipla escolha (pontuável)",
};

const TYPE_OPTIONS: FieldType[] = [
  "welcome",
  "text",
  "name",
  "email",
  "tel",
  "link",
  "single",
  "multi",
];

function genId(prefix = "campo") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

interface EditorField extends Field {
  _key: string;
}

export function FormEditor({ initial }: { initial: FormRow }) {
  const router = useRouter();
  const cfg = initial.config ?? ({} as FormRow["config"]);

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [published, setPublished] = useState(initial.published);
  const [eyebrow, setEyebrow] = useState((cfg as any).eyebrow ?? "");
  const [steps, setSteps] = useState<EditorField[]>(
    ((cfg as any).steps ?? []).map((s: Field) => ({ ...s, _key: genId("k") }))
  );
  const [tiers, setTiers] = useState<Tier[]>(
    (cfg as any).tiers ?? [
      { id: "frio", name: "Frio", minPct: 0, color: "#999999" },
      { id: "morno", name: "Morno", minPct: 40, color: "#F0B822" },
      { id: "quente", name: "Quente", minPct: 70, color: "#c2fb8d" },
    ]
  );
  const [endScreens, setEndScreens] = useState<EndScreen[]>(
    (cfg as any).endScreens ?? []
  );
  const [pixel, setPixel] = useState<PixelConfig>((cfg as any).pixel ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"editor" | "opcoes">("editor");

  const maxScore = useMemo(() => {
    let max = 0;
    for (const s of steps) {
      if (!s.options?.length) continue;
      const w = s.options.map((o) => Number(o.weight) || 0);
      if (s.type === "single") max += Math.max(0, ...w);
      else if (s.type === "multi") max += w.reduce((a, b) => a + Math.max(0, b), 0);
    }
    return max;
  }, [steps]);

  // ---- steps ----
  function updateStep(key: string, patch: Partial<EditorField>) {
    setSteps((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        _key: genId("k"),
        id: genId(),
        type: "single",
        title: "Nova pergunta",
        required: true,
        options: [
          { label: "Opção 1", value: "opcao-1", weight: 1 },
          { label: "Opção 2", value: "opcao-2", weight: 2 },
        ],
      },
    ]);
  }
  function removeStep(key: string) {
    setSteps((prev) => prev.filter((s) => s._key !== key));
  }
  function moveStep(key: string, dir: -1 | 1) {
    setSteps((prev) => {
      const i = prev.findIndex((s) => s._key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function changeType(key: string, type: FieldType) {
    updateStep(key, {
      type,
      options:
        type === "single" || type === "multi"
          ? // mantém opções existentes ou cria padrão
            (steps.find((s) => s._key === key)?.options ?? [
              { label: "Opção 1", value: "opcao-1", weight: 1 },
            ])
          : undefined,
    });
  }

  // ---- options ----
  function updateOption(key: string, idx: number, patch: Partial<Option>) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s._key !== key || !s.options) return s;
        const options = s.options.map((o, i) =>
          i === idx ? { ...o, ...patch } : o
        );
        return { ...s, options };
      })
    );
  }
  function addOption(key: string) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s._key !== key) return s;
        const n = (s.options?.length ?? 0) + 1;
        return {
          ...s,
          options: [
            ...(s.options ?? []),
            { label: `Opção ${n}`, value: `opcao-${n}`, weight: 0 },
          ],
        };
      })
    );
  }
  function removeOption(key: string, idx: number) {
    setSteps((prev) =>
      prev.map((s) =>
        s._key === key && s.options
          ? { ...s, options: s.options.filter((_, i) => i !== idx) }
          : s
      )
    );
  }

  // ---- tiers / endscreens ----
  function updateTier(id: string, patch: Partial<Tier>) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function endScreenFor(tierId: string): EndScreen {
    return (
      endScreens.find((e) => e.tier === tierId) ?? {
        tier: tierId,
        title: "Obrigado, {nome}!",
        message: "Recebemos suas respostas.",
      }
    );
  }
  function updateEndScreen(tierId: string, patch: Partial<EndScreen>) {
    setEndScreens((prev) => {
      const exists = prev.some((e) => e.tier === tierId);
      if (exists) return prev.map((e) => (e.tier === tierId ? { ...e, ...patch } : e));
      return [...prev, { ...endScreenFor(tierId), ...patch }];
    });
  }

  function updatePixel(patch: Partial<PixelConfig>) {
    setPixel((p) => ({ ...p, ...patch }));
  }

  // ---- save ----
  function buildConfig() {
    const finalSteps: Field[] = steps.map((s) => {
      const base: Field = {
        id: s.id || genId(),
        type: s.type,
        title: s.title,
      };
      if (s.subtitle) base.subtitle = s.subtitle;
      if (s.placeholder) base.placeholder = s.placeholder;
      if (s.required) base.required = true;
      if (s.buttonLabel) base.buttonLabel = s.buttonLabel;
      if (s.type === "single" || s.type === "multi") {
        const seen: Record<string, boolean> = {};
        base.options = (s.options ?? []).map((o, i) => {
          let v = o.value || slugify(o.label) || `op_${i + 1}`;
          while (seen[v]) v = `${v}_${i + 1}`;
          seen[v] = true;
          const weight = Number(o.weight) || 0;
          const opt: Option = { label: o.label, value: v };
          if (weight) opt.weight = weight;
          if (o.next) opt.next = o.next;
          return opt;
        });
      }
      return base;
    });
    const cleanPixel: PixelConfig = {};
    (Object.keys(pixel) as (keyof PixelConfig)[]).forEach((k) => {
      const v = (pixel[k] || "").trim();
      if (v) cleanPixel[k] = v;
    });
    return { eyebrow, steps: finalSteps, tiers, endScreens, pixel: cleanPixel };
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/forms/${initial.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, published, config: buildConfig() }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setMsg("Salvo com sucesso.");
      if (data.slug && data.slug !== slug) setSlug(data.slug);
      router.refresh();
    } else {
      setMsg(
        data.error === "slug_em_uso"
          ? "Esse endereço (slug) já está em uso."
          : "Erro ao salvar."
      );
    }
  }

  async function deleteForm() {
    if (
      !confirm(
        `Excluir o formulário "${name}" e todas as suas respostas? Essa ação não pode ser desfeita.`
      )
    )
      return;
    const res = await fetch(`/api/admin/forms/${initial.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/admin/forms");
    else alert("Não foi possível excluir.");
  }

  return (
    <div className="mx-auto max-w-[820px] px-5 py-8 sm:px-8">
      {/* Barra superior */}
      <div className="sticky top-0 z-10 -mx-5 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <a href="/admin/forms" className="text-sm text-[var(--text2)] hover:text-[var(--text)]">
          ← Formulários
        </a>
        <div className="flex items-center gap-3">
          <a
            href={`/f/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--text2)] hover:text-[var(--text)]"
          >
            Ver ↗
          </a>
          <label className="flex items-center gap-2 text-sm text-[var(--text2)]">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            Publicado
          </label>
          {msg && (
            <span
              className={`mono text-[0.72rem] ${
                msg.includes("sucesso") ? "text-[#3d7a00]" : "text-[var(--red)]"
              }`}
            >
              {msg}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--acc2)] disabled:opacity-45"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="mb-6 flex items-center gap-1 border-b border-[var(--border)]">
        <TabBtn active={tab === "editor"} onClick={() => setTab("editor")}>
          Editor
        </TabBtn>
        <TabBtn active={tab === "opcoes"} onClick={() => setTab("opcoes")}>
          Opções
        </TabBtn>
      </div>

      {/* ===================== ABA OPÇÕES ===================== */}
      {tab === "opcoes" && (
        <>
      <Section title="Identificação">
        <FieldRow label="Nome do formulário">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </FieldRow>
        <FieldRow label="Endereço público (slug)">
          <div className="flex items-center gap-2">
            <span className="mono text-[0.8rem] text-[var(--text3)]">/f/</span>
            <input
              className={inputCls}
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="advogados"
            />
          </div>
        </FieldRow>
        <FieldRow label="Selo de topo (opcional)">
          <input
            className={inputCls}
            value={eyebrow}
            onChange={(e) => setEyebrow(e.target.value)}
            placeholder="Ex.: Diagnóstico gratuito"
          />
        </FieldRow>
      </Section>
        </>
      )}

      {/* ===================== ABA EDITOR ===================== */}
      {tab === "editor" && (
      <Section
        title="Perguntas"
        right={
          <span className="mono text-[0.72rem] text-[var(--text3)]">
            Score máximo: {maxScore}
          </span>
        }
      >
        <div className="grid gap-3">
          {steps.map((s, i) => (
            <div
              key={s._key}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <select
                  value={s.type}
                  onChange={(e) => changeType(s._key, e.target.value as FieldType)}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <IconBtn label="Subir" onClick={() => moveStep(s._key, -1)} disabled={i === 0}>↑</IconBtn>
                  <IconBtn label="Descer" onClick={() => moveStep(s._key, 1)} disabled={i === steps.length - 1}>↓</IconBtn>
                  <IconBtn label="Remover" onClick={() => removeStep(s._key)} danger>✕</IconBtn>
                </div>
              </div>

              <input
                className={inputCls}
                value={s.title}
                onChange={(e) => updateStep(s._key, { title: e.target.value })}
                placeholder="Título da pergunta"
              />
              <input
                className={`${inputCls} mt-2`}
                value={s.subtitle ?? ""}
                onChange={(e) => updateStep(s._key, { subtitle: e.target.value })}
                placeholder="Subtítulo / ajuda (opcional)"
              />

              {(s.type === "text" ||
                s.type === "name" ||
                s.type === "email" ||
                s.type === "tel" ||
                s.type === "link") && (
                <input
                  className={`${inputCls} mt-2`}
                  value={s.placeholder ?? ""}
                  onChange={(e) => updateStep(s._key, { placeholder: e.target.value })}
                  placeholder="Placeholder do campo (opcional)"
                />
              )}

              {s.type === "welcome" && (
                <input
                  className={`${inputCls} mt-2`}
                  value={s.buttonLabel ?? ""}
                  onChange={(e) => updateStep(s._key, { buttonLabel: e.target.value })}
                  placeholder="Texto do botão (ex.: Começar)"
                />
              )}

              {(s.type === "single" || s.type === "multi") && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="lbl">Opções e pesos</span>
                  </div>
                  <div className="grid gap-2">
                    {(s.options ?? []).map((o, oi) => (
                      <div
                        key={oi}
                        className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            className={`${inputCls} flex-1`}
                            value={o.label}
                            onChange={(e) => updateOption(s._key, oi, { label: e.target.value })}
                            placeholder={`Opção ${oi + 1}`}
                          />
                          <div className="flex items-center gap-1">
                            <span className="mono text-[0.65rem] text-[var(--text3)]">peso</span>
                            <input
                              type="number"
                              className="w-16 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
                              value={o.weight ?? 0}
                              onChange={(e) =>
                                updateOption(s._key, oi, { weight: Number(e.target.value) })
                              }
                            />
                          </div>
                          <IconBtn label="Remover opção" onClick={() => removeOption(s._key, oi)} danger>✕</IconBtn>
                        </div>
                        {s.type === "single" && (
                          <div className="mt-2 flex items-center gap-2 pl-1">
                            <span className="mono text-[0.62rem] text-[var(--text3)]">
                              ao escolher →
                            </span>
                            <select
                              value={o.next ?? ""}
                              onChange={(e) =>
                                updateOption(s._key, oi, {
                                  next: e.target.value || undefined,
                                })
                              }
                              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[0.8rem]"
                            >
                              <option value="">Seguir na ordem</option>
                              {steps
                                .filter((t) => t._key !== s._key)
                                .map((t) => (
                                  <option key={t._key} value={t.id}>
                                    Ir para: {t.title || t.id}
                                  </option>
                                ))}
                              <option value={END_STEP}>Encerrar (tela final)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addOption(s._key)}
                    className="mt-2 text-sm font-medium text-[var(--text2)] hover:text-[var(--text)]"
                  >
                    + Adicionar opção
                  </button>
                </div>
              )}

              {s.type !== "welcome" && (
                <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text2)]">
                  <input
                    type="checkbox"
                    checked={!!s.required}
                    onChange={(e) => updateStep(s._key, { required: e.target.checked })}
                  />
                  Obrigatório
                </label>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addStep}
          className="mt-3 w-full rounded-xl border border-dashed border-[var(--border)] py-3 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
        >
          + Adicionar pergunta
        </button>
      </Section>
      )}

      {/* ===================== ABA OPÇÕES (continuação) ===================== */}
      {tab === "opcoes" && (
        <>
      <Section title="Faixas de lead (por % do score máximo)">
        <div className="grid gap-2">
          {tiers.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: t.color }}
              />
              <input
                className={`${inputCls} flex-1`}
                value={t.name}
                onChange={(e) => updateTier(t.id, { name: e.target.value })}
              />
              <div className="flex items-center gap-1">
                <span className="mono text-[0.65rem] text-[var(--text3)]">a partir de</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-16 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-sm"
                  value={t.minPct}
                  onChange={(e) => updateTier(t.id, { minPct: Number(e.target.value) })}
                />
                <span className="mono text-[0.65rem] text-[var(--text3)]">%</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Telas finais */}
      <Section title="Telas finais (uma por faixa)">
        <div className="grid gap-3">
          {tiers.map((t) => {
            const es = endScreenFor(t.id);
            return (
              <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                  <span className="font-bold text-[var(--text)]">{t.name}</span>
                </div>
                <input
                  className={inputCls}
                  value={es.title}
                  onChange={(e) => updateEndScreen(t.id, { title: e.target.value })}
                  placeholder="Título (use {nome} para personalizar)"
                />
                <textarea
                  className={`${inputCls} mt-2 min-h-[64px]`}
                  value={es.message}
                  onChange={(e) => updateEndScreen(t.id, { message: e.target.value })}
                  placeholder="Mensagem"
                />
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    className={inputCls}
                    value={es.ctaLabel ?? ""}
                    onChange={(e) => updateEndScreen(t.id, { ctaLabel: e.target.value })}
                    placeholder="Texto do botão (opcional)"
                  />
                  <input
                    className={inputCls}
                    value={es.ctaHref ?? ""}
                    onChange={(e) => updateEndScreen(t.id, { ctaHref: e.target.value })}
                    placeholder="Link do botão (https:// ou https://wa.me/...)"
                  />
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text2)]">
                  <input
                    type="checkbox"
                    checked={!!es.qualified}
                    onChange={(e) => updateEndScreen(t.id, { qualified: e.target.checked })}
                  />
                  Marcar como lead qualificado
                </label>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Rastreamento / Pixel */}
      <Section title="Rastreamento / Pixel">
        <p className="mb-3 text-[0.8rem] text-[var(--text2)]">
          Preencha só o que for usar. Os campos “token” e “API secret” ficam no
          servidor e habilitam o envio server-side (melhor recuperação de
          conversões).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Meta Pixel ID">
            <input
              className={inputCls}
              value={pixel.metaPixelId ?? ""}
              onChange={(e) => updatePixel({ metaPixelId: e.target.value })}
              placeholder="Ex.: 123456789012345"
            />
          </FieldRow>
          <FieldRow label="Meta CAPI — token de acesso">
            <input
              className={inputCls}
              value={pixel.metaCapiToken ?? ""}
              onChange={(e) => updatePixel({ metaCapiToken: e.target.value })}
              placeholder="EAAB... (server-side)"
            />
          </FieldRow>
          <FieldRow label="Meta — código de teste (opcional)">
            <input
              className={inputCls}
              value={pixel.metaTestCode ?? ""}
              onChange={(e) => updatePixel({ metaTestCode: e.target.value })}
              placeholder="TEST12345"
            />
          </FieldRow>
          <div />
          <FieldRow label="GA4 — Measurement ID">
            <input
              className={inputCls}
              value={pixel.ga4Id ?? ""}
              onChange={(e) => updatePixel({ ga4Id: e.target.value })}
              placeholder="G-XXXXXXX"
            />
          </FieldRow>
          <FieldRow label="GA4 — API secret (server-side)">
            <input
              className={inputCls}
              value={pixel.ga4ApiSecret ?? ""}
              onChange={(e) => updatePixel({ ga4ApiSecret: e.target.value })}
              placeholder="Measurement Protocol secret"
            />
          </FieldRow>
        </div>
      </Section>

      {/* Zona de perigo */}
      <section className="mb-8 rounded-xl border p-5" style={{ borderColor: "rgba(255,69,69,0.4)", background: "rgba(255,69,69,0.04)" }}>
        <h2 className="text-sm font-bold text-[var(--red)]">Zona de perigo</h2>
        <p className="mt-1 text-[0.8rem] text-[var(--text2)]">
          Excluir o formulário remove também todas as respostas. Não pode ser
          desfeito.
        </p>
        <button
          onClick={deleteForm}
          className="mt-3 rounded-full border border-[var(--red)] px-4 py-2 text-sm font-medium text-[var(--red)] transition hover:bg-[var(--red)] hover:text-white"
        >
          Excluir formulário
        </button>
      </section>
        </>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "border-[var(--text)] text-[var(--text)]"
          : "border-transparent text-[var(--text3)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--acc2)] focus:shadow-[0_0_0_3px_rgba(194,251,141,0.35)]";

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="lbl">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[0.8rem] text-[var(--text2)]">{label}</label>
      {children}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  danger,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-sm transition disabled:opacity-30 ${
        danger
          ? "text-[var(--text3)] hover:border-[var(--red)] hover:text-[var(--red)]"
          : "text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}
