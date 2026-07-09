"use client";

import { useMemo, useRef, useState } from "react";
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
import { Logo } from "@/components/Logo";

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
  text: "Texto longo",
  name: "Nome",
  email: "E-mail",
  tel: "Telefone / WhatsApp",
  link: "Link / site",
  single: "Escolha única",
  multi: "Múltipla escolha",
};

// Metadados visuais por tipo (cor + ícone), estilo Yay
const TYPE_META: Record<
  FieldType,
  { label: string; color: string; icon: string }
> = {
  single: { label: "Escolha única", color: "#4f7cff", icon: "◉" },
  multi: { label: "Múltipla escolha", color: "#4f7cff", icon: "☑" },
  name: { label: "Nome", color: "#22b07d", icon: "A" },
  email: { label: "E-mail", color: "#22b07d", icon: "@" },
  tel: { label: "Telefone", color: "#22b07d", icon: "✆" },
  link: { label: "Site / link", color: "#22b07d", icon: "🔗" },
  text: { label: "Texto longo", color: "#e0a52b", icon: "¶" },
  welcome: { label: "Tela de boas-vindas", color: "#9b6dff", icon: "👋" },
};

// Título/placeholder padrão ao criar cada tipo de campo
const TYPE_DEFAULTS: Partial<
  Record<FieldType, { title: string; placeholder?: string }>
> = {
  name: { title: "Qual é o seu nome?", placeholder: "Seu nome" },
  email: { title: "Qual é o seu e-mail?", placeholder: "voce@email.com" },
  tel: { title: "Qual o seu WhatsApp?", placeholder: "(11) 99999-9999" },
  link: { title: "Qual o seu site?", placeholder: "https://" },
  text: { title: "Deixe sua mensagem", placeholder: "Escreva aqui…" },
  single: { title: "Nova pergunta" },
  multi: { title: "Nova pergunta" },
  welcome: { title: "Bem-vindo!" },
};

// Menu de campos categorizado (estilo Yay)
const ADD_CATEGORIES: { label: string; types: FieldType[] }[] = [
  { label: "Escolhas", types: ["single", "multi"] },
  { label: "Contato", types: ["name", "email", "tel", "link"] },
  { label: "Texto", types: ["text"] },
  { label: "Estrutura", types: ["welcome"] },
];

function ColorIcon({ type, size = 24 }: { type: FieldType; size?: number }) {
  const m = TYPE_META[type];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md text-white"
      style={{ background: m.color, width: size, height: size, fontSize: size * 0.5 }}
    >
      {m.icon}
    </span>
  );
}

// Tile da lista de perguntas: ícone colorido com o número DENTRO (estilo Yay)
function QuestionTile({ type, n }: { type: FieldType; n: number }) {
  const m = TYPE_META[type];
  return (
    <span
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: m.color }}
    >
      <span className="absolute left-1 top-0.5 text-[0.52rem] font-bold leading-none text-white/85">
        {n}
      </span>
      <span style={{ fontSize: 16 }}>{m.icon}</span>
    </span>
  );
}

function genId(prefix = "campo") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

interface EditorField extends Field {
  _key: string;
}

type TopTab = "edit" | "integrate" | "share";

export function FormEditor({ initial }: { initial: FormRow }) {
  const router = useRouter();
  const cfg = (initial.config ?? {}) as any;

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [published, setPublished] = useState(initial.published);
  const [eyebrow, setEyebrow] = useState(cfg.eyebrow ?? "");
  const [steps, setSteps] = useState<EditorField[]>(
    (cfg.steps ?? []).map((s: Field) => ({ ...s, _key: genId("k") }))
  );
  const [tiers, setTiers] = useState<Tier[]>(
    cfg.tiers ?? [
      { id: "frio", name: "Frio", minPct: 0, color: "#999999" },
      { id: "morno", name: "Morno", minPct: 40, color: "#F0B822" },
      { id: "quente", name: "Quente", minPct: 70, color: "#c2fb8d" },
    ]
  );
  const [endScreens, setEndScreens] = useState<EndScreen[]>(cfg.endScreens ?? []);
  const [pixel, setPixel] = useState<PixelConfig>(cfg.pixel ?? {});
  const [webhookUrl, setWebhookUrl] = useState<string>(cfg.webhookUrl ?? "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>("edit");
  const [leftTab, setLeftTab] = useState<"content" | "settings">("content");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [selected, setSelected] = useState<string>(
    (cfg.steps ?? [])[0] ? "step:0" : ""
  );
  const [addOpen, setAddOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [addPos, setAddPos] = useState<{ top: number; left: number } | null>(null);
  function toggleAdd() {
    if (addOpen) {
      setAddOpen(false);
      return;
    }
    const r = addBtnRef.current?.getBoundingClientRect();
    if (r) setAddPos({ top: r.top, left: r.right + 12 });
    setAddOpen(true);
  }

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

  // seleção: "step:<_key>" | "end:<tierId>"
  const selectedStep = steps.find((s) => `step:${s._key}` === selected) ?? null;
  const selectedEndingTier = selected.startsWith("end:")
    ? selected.slice(4)
    : null;

  // ---------- steps ----------
  function updateStep(key: string, patch: Partial<EditorField>) {
    setSteps((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }
  function addStep(type: FieldType) {
    const key = genId("k");
    const d = TYPE_DEFAULTS[type];
    const base: EditorField = {
      _key: key,
      id: genId(),
      type,
      title: d?.title ?? "Nova pergunta",
      ...(d?.placeholder ? { placeholder: d.placeholder } : {}),
      ...(type === "welcome" ? { buttonLabel: "Começar" } : { required: true }),
      ...(type === "single" || type === "multi"
        ? {
            options: [
              { label: "Opção 1", value: "opcao-1", weight: 1 },
              { label: "Opção 2", value: "opcao-2", weight: 2 },
            ],
          }
        : {}),
    };
    setSteps((prev) => [...prev, base]);
    setSelected(`step:${key}`);
    setAddOpen(false);
  }
  function removeStep(key: string) {
    setSteps((prev) => prev.filter((s) => s._key !== key));
    setSelected("");
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
  function reorderSteps(fromKey: string, toKey: string) {
    setSteps((prev) => {
      const from = prev.findIndex((s) => s._key === fromKey);
      const to = prev.findIndex((s) => s._key === toKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }
  function changeType(key: string, type: FieldType) {
    const cur = steps.find((s) => s._key === key);
    updateStep(key, {
      type,
      options:
        type === "single" || type === "multi"
          ? cur?.options ?? [{ label: "Opção 1", value: "opcao-1", weight: 1 }]
          : undefined,
    });
  }

  // ---------- options ----------
  function updateOption(key: string, idx: number, patch: Partial<Option>) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s._key !== key || !s.options) return s;
        return {
          ...s,
          options: s.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
        };
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

  // ---------- tiers / endscreens / pixel ----------
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

  // ---------- save ----------
  function buildConfig() {
    const finalSteps: Field[] = steps.map((s) => {
      const b: Field = { id: s.id || genId(), type: s.type, title: s.title };
      if (s.subtitle) b.subtitle = s.subtitle;
      if (s.placeholder) b.placeholder = s.placeholder;
      if (s.required) b.required = true;
      if (s.buttonLabel) b.buttonLabel = s.buttonLabel;
      if (s.type === "single" || s.type === "multi") {
        const seen: Record<string, boolean> = {};
        b.options = (s.options ?? []).map((o, i) => {
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
      return b;
    });
    const cleanPixel: PixelConfig = {};
    (Object.keys(pixel) as (keyof PixelConfig)[]).forEach((k) => {
      const v = (pixel[k] || "").trim();
      if (v) cleanPixel[k] = v;
    });
    return {
      eyebrow,
      steps: finalSteps,
      tiers,
      endScreens,
      pixel: cleanPixel,
      webhookUrl: webhookUrl.trim() || undefined,
    };
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
      setMsg("Salvo");
      if (data.slug && data.slug !== slug) setSlug(data.slug);
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    } else {
      setMsg(data.error === "slug_em_uso" ? "Slug já em uso" : "Erro ao salvar");
    }
  }

  async function deleteForm() {
    if (
      !confirm(
        `Excluir "${name}" e todas as respostas? Não pode ser desfeito.`
      )
    )
      return;
    const res = await fetch(`/api/admin/forms/${initial.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/forms");
    else alert("Não foi possível excluir.");
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)]">
      {/* ===== Top bar ===== */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/forms")}
            className="text-[var(--text2)] hover:text-[var(--text)]"
            aria-label="Voltar"
          >
            ←
          </button>
          <Logo height={20} />
          <span className="text-sm font-medium text-[var(--text2)]">{name}</span>
        </div>

        {/* Nav pílula central */}
        <div className="hidden items-center gap-1 rounded-full bg-[var(--bg)] p-1 md:flex">
          <NavPill active={topTab === "edit"} onClick={() => setTopTab("edit")} icon={<IconEdit />}>
            Editor
          </NavPill>
          <NavPill active={topTab === "integrate"} onClick={() => setTopTab("integrate")} icon={<IconIntegrate />}>
            Integrações
          </NavPill>
          <NavPill active={topTab === "share"} onClick={() => setTopTab("share")} icon={<IconShare />}>
            Compartilhar
          </NavPill>
          <a
            href={`/admin/forms/${initial.id}/respostas`}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-[var(--text2)] hover:text-[var(--text)]"
          >
            <IconResults />
            Resultados
          </a>
        </div>

        <div className="flex items-center gap-3">
          {msg && (
            <span className="mono text-[0.7rem] text-[var(--text3)]">{msg}</span>
          )}
          <a
            href={`/f/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--text2)] hover:text-[var(--text)]"
          >
            Ver ↗
          </a>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--acc2)] disabled:opacity-45"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* ===== Conteúdo ===== */}
      {topTab === "edit" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Coluna esquerda */}
          <aside className="w-[280px] shrink-0 overflow-y-auto overflow-x-hidden border-r border-[var(--border)] bg-[var(--card)] p-3">
            <div className="mb-3 flex items-center gap-1 rounded-lg bg-[var(--bg)] p-1">
              <SideTab active={leftTab === "content"} onClick={() => setLeftTab("content")}>
                Conteúdo
              </SideTab>
              <SideTab active={leftTab === "settings"} onClick={() => setLeftTab("settings")}>
                Ajustes
              </SideTab>
            </div>

            {leftTab === "content" && (
              <div>
                <ListLabel>Perguntas</ListLabel>
                <div className="grid gap-1.5">
                  {steps.map((s, i) => (
                    <div
                      key={s._key}
                      draggable
                      onDragStart={() => setDragKey(s._key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragKey) reorderSteps(dragKey, s._key);
                        setDragKey(null);
                      }}
                      onDragEnd={() => setDragKey(null)}
                      onClick={() => setSelected(`step:${s._key}`)}
                      className={`group flex w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-sm transition ${
                        selected === `step:${s._key}`
                          ? "border-[var(--accent)] bg-[rgba(194,251,141,0.12)]"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[#bbb]"
                      } ${dragKey === s._key ? "opacity-40" : ""}`}
                    >
                      <QuestionTile type={s.type} n={i + 1} />
                      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
                        {s.title || "(sem título)"}
                      </span>
                      <span
                        className="shrink-0 cursor-grab select-none px-0.5 text-[var(--text3)] opacity-0 transition group-hover:opacity-100"
                        aria-hidden
                        title="Arraste para reordenar"
                      >
                        ⠿
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-2">
                  <button
                    ref={addBtnRef}
                    onClick={toggleAdd}
                    className="w-full rounded-lg border border-dashed border-[var(--border)] py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
                  >
                    + Adicionar campo
                  </button>
                  {addOpen && addPos && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setAddOpen(false)}
                      />
                      <div
                        className="fixed z-50 w-[500px] max-w-[calc(100vw-40px)] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
                        style={{
                          top: Math.min(addPos.top, window.innerHeight - 420),
                          left: addPos.left,
                          maxHeight: "70vh",
                          overflowY: "auto",
                        }}
                      >
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                          {ADD_CATEGORIES.map((cat) => (
                            <div key={cat.label}>
                              <div className="lbl mb-2">{cat.label}</div>
                              <div className="grid gap-0.5">
                                {cat.types.map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => addStep(t)}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--text)] transition hover:bg-[var(--bg)]"
                                  >
                                    <ColorIcon type={t} size={26} />
                                    {TYPE_META[t].label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5">
                  <ListLabel>Telas finais</ListLabel>
                  <div className="grid gap-1.5">
                    {tiers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelected(`end:${t.id}`)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                          selected === `end:${t.id}`
                            ? "border-[var(--accent)] bg-[rgba(194,251,141,0.12)]"
                            : "border-[var(--border)] bg-[var(--card)] hover:border-[#bbb]"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: t.color }}
                        />
                        <span className="flex-1 text-[var(--text)]">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {leftTab === "settings" && (
              <div className="grid gap-4">
                <div>
                  <ListLabel>Identificação</ListLabel>
                  <FieldRow label="Nome do formulário">
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Endereço público (slug)">
                    <div className="flex items-center gap-1">
                      <span className="mono text-[0.75rem] text-[var(--text3)]">/f/</span>
                      <input
                        className={inputCls}
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
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
                  <label className="mt-1 flex items-center gap-2 text-sm text-[var(--text2)]">
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={(e) => setPublished(e.target.checked)}
                    />
                    Publicado
                  </label>
                </div>

                <div>
                  <ListLabel>Faixas de lead (% do score máx.)</ListLabel>
                  <div className="grid gap-2">
                    {tiers.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                        <input
                          className={`${inputCls} flex-1`}
                          value={t.name}
                          onChange={(e) => updateTier(t.id, { name: e.target.value })}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="w-14 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-sm"
                          value={t.minPct}
                          onChange={(e) => updateTier(t.id, { minPct: Number(e.target.value) })}
                        />
                        <span className="mono text-[0.65rem] text-[var(--text3)]">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3" style={{ borderColor: "rgba(255,69,69,0.4)" }}>
                  <div className="text-sm font-bold text-[var(--red)]">Zona de perigo</div>
                  <button
                    onClick={deleteForm}
                    className="mt-2 rounded-full border border-[var(--red)] px-3 py-1.5 text-sm font-medium text-[var(--red)] transition hover:bg-[var(--red)] hover:text-white"
                  >
                    Excluir formulário
                  </button>
                </div>
              </div>
            )}
          </aside>

          {/* Coluna central — preview */}
          <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
            <div className="flex items-center justify-center border-b border-[var(--border)] py-2.5">
              <div className="flex items-center gap-1 rounded-full bg-[var(--bg)] p-1">
                {(["desktop", "tablet", "mobile"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDevice(d)}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                      device === d
                        ? "bg-[var(--card)] text-[var(--text)] shadow-sm"
                        : "text-[var(--text2)] hover:text-[var(--text)]"
                    }`}
                  >
                    {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablet" : "Mobile"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-1 items-start justify-center overflow-y-auto p-6">
              <div
                className="w-full overflow-hidden rounded-2xl border-2 border-[var(--dark)] bg-[var(--card)] shadow-xl"
                style={{
                  maxWidth:
                    device === "mobile" ? 390 : device === "tablet" ? 720 : 900,
                }}
              >
                <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <StepPreview
                  eyebrow={eyebrow}
                  step={selectedStep}
                  endingTier={selectedEndingTier}
                  endScreen={
                    selectedEndingTier ? endScreenFor(selectedEndingTier) : null
                  }
                />
              </div>
            </div>
          </div>

          {/* Coluna direita — configurações da seleção */}
          <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--card)] p-4">
            {selectedStep && (
              <StepSettings
                step={selectedStep}
                steps={steps}
                maxScore={maxScore}
                updateStep={updateStep}
                changeType={changeType}
                moveStep={moveStep}
                removeStep={removeStep}
                updateOption={updateOption}
                addOption={addOption}
                removeOption={removeOption}
              />
            )}
            {selectedEndingTier && (
              <EndingSettings
                tier={tiers.find((t) => t.id === selectedEndingTier)!}
                es={endScreenFor(selectedEndingTier)}
                update={(patch) => updateEndScreen(selectedEndingTier, patch)}
              />
            )}
            {!selectedStep && !selectedEndingTier && (
              <div className="mt-10 text-center text-sm text-[var(--text2)]">
                Selecione uma pergunta ou tela final à esquerda para editar.
              </div>
            )}
          </aside>
        </div>
      )}

      {topTab === "integrate" && (
        <div className="flex-1 overflow-y-auto">
          <IntegrateTab
            pixel={pixel}
            updatePixel={updatePixel}
            webhookUrl={webhookUrl}
            setWebhookUrl={setWebhookUrl}
          />
        </div>
      )}

      {topTab === "share" && (
        <div className="flex-1 overflow-y-auto">
          <ShareTab slug={slug} published={published} />
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Preview central
// =====================================================================
function StepPreview({
  eyebrow,
  step,
  endingTier,
  endScreen,
}: {
  eyebrow: string;
  step: (Field & { _key: string }) | null;
  endingTier: string | null;
  endScreen: EndScreen | null;
}) {
  if (endingTier && endScreen) {
    return (
      <div className="px-8 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]">
          <span className="text-2xl">✓</span>
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-tight text-[var(--text)]">
          {(endScreen.title || "").replace(/\{nome\}/g, "João")}
        </h1>
        <p className="mt-3 text-[var(--text2)]">
          {(endScreen.message || "").replace(/\{nome\}/g, "João")}
        </p>
        {endScreen.ctaLabel && (
          <span className="mt-6 inline-block rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--text)]">
            {endScreen.ctaLabel}
          </span>
        )}
      </div>
    );
  }
  if (!step) {
    return (
      <div className="px-8 py-24 text-center text-[var(--text2)]">
        Selecione um item para pré-visualizar.
      </div>
    );
  }
  const isInput =
    step.type === "text" ||
    step.type === "name" ||
    step.type === "email" ||
    step.type === "tel" ||
    step.type === "link";
  return (
    <div className="px-8 py-14">
      {step.type !== "welcome" && eyebrow && (
        <div className="lbl mb-4">{eyebrow}</div>
      )}
      <h1 className="text-[1.7rem] font-black leading-tight tracking-tight text-[var(--text)]">
        {step.title || "(sem título)"}
      </h1>
      {step.subtitle && (
        <p className="mt-2 text-[var(--text2)]">{step.subtitle}</p>
      )}
      <div className="mt-6">
        {isInput && (
          <div className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text3)]">
            {step.placeholder || "Resposta…"}
          </div>
        )}
        {(step.type === "single" || step.type === "multi") && (
          <div className="grid gap-2.5">
            {(step.options ?? []).map((o, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3 text-[var(--text)]"
              >
                {o.label}
                <span
                  className={`h-4 w-4 border border-[var(--border)] ${
                    step.type === "single" ? "rounded-full" : "rounded"
                  }`}
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--text)]">
            {step.type === "welcome" ? step.buttonLabel || "Começar" : "Continuar"} →
          </span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Painel direito — configurações da pergunta
// =====================================================================
function StepSettings({
  step,
  steps,
  maxScore,
  updateStep,
  changeType,
  moveStep,
  removeStep,
  updateOption,
  addOption,
  removeOption,
}: {
  step: Field & { _key: string };
  steps: (Field & { _key: string })[];
  maxScore: number;
  updateStep: (k: string, p: Partial<Field & { _key: string }>) => void;
  changeType: (k: string, t: FieldType) => void;
  moveStep: (k: string, d: -1 | 1) => void;
  removeStep: (k: string) => void;
  updateOption: (k: string, i: number, p: Partial<Option>) => void;
  addOption: (k: string) => void;
  removeOption: (k: string, i: number) => void;
}) {
  const key = step._key;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="lbl">Pergunta</span>
        <div className="flex items-center gap-1">
          <IconBtn label="Subir" onClick={() => moveStep(key, -1)}>↑</IconBtn>
          <IconBtn label="Descer" onClick={() => moveStep(key, 1)}>↓</IconBtn>
          <IconBtn label="Remover" onClick={() => removeStep(key)} danger>✕</IconBtn>
        </div>
      </div>

      <FieldRow label="Tipo">
        <select
          value={step.type}
          onChange={(e) => changeType(key, e.target.value as FieldType)}
          className={inputCls}
        >
          {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="Título">
        <input
          className={inputCls}
          value={step.title}
          onChange={(e) => updateStep(key, { title: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Subtítulo (opcional)">
        <input
          className={inputCls}
          value={step.subtitle ?? ""}
          onChange={(e) => updateStep(key, { subtitle: e.target.value })}
        />
      </FieldRow>

      {(step.type === "text" ||
        step.type === "name" ||
        step.type === "email" ||
        step.type === "tel" ||
        step.type === "link") && (
        <FieldRow label="Placeholder">
          <input
            className={inputCls}
            value={step.placeholder ?? ""}
            onChange={(e) => updateStep(key, { placeholder: e.target.value })}
          />
        </FieldRow>
      )}

      {step.type === "welcome" && (
        <FieldRow label="Texto do botão">
          <input
            className={inputCls}
            value={step.buttonLabel ?? ""}
            onChange={(e) => updateStep(key, { buttonLabel: e.target.value })}
          />
        </FieldRow>
      )}

      {(step.type === "single" || step.type === "multi") && (
        <div className="mt-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="lbl">Opções e pesos</span>
            <span className="mono text-[0.62rem] text-[var(--text3)]">
              máx: {maxScore}
            </span>
          </div>
          <div className="grid gap-2">
            {(step.options ?? []).map((o, oi) => (
              <div
                key={oi}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={o.label}
                    onChange={(e) => updateOption(key, oi, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    className="w-14 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-sm"
                    value={o.weight ?? 0}
                    onChange={(e) => updateOption(key, oi, { weight: Number(e.target.value) })}
                  />
                  <IconBtn label="Remover" onClick={() => removeOption(key, oi)} danger>✕</IconBtn>
                </div>
                {step.type === "single" && (
                  <div className="mt-2 flex items-center gap-1">
                    <span className="mono text-[0.6rem] text-[var(--text3)]">→</span>
                    <select
                      value={o.next ?? ""}
                      onChange={(e) =>
                        updateOption(key, oi, { next: e.target.value || undefined })
                      }
                      className="flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-[0.78rem]"
                    >
                      <option value="">Seguir na ordem</option>
                      {steps
                        .filter((t) => t._key !== key)
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
            onClick={() => addOption(key)}
            className="mt-2 text-sm font-medium text-[var(--text2)] hover:text-[var(--text)]"
          >
            + Adicionar opção
          </button>
        </div>
      )}

      {step.type !== "welcome" && (
        <label className="mt-4 flex items-center gap-2 text-sm text-[var(--text2)]">
          <input
            type="checkbox"
            checked={!!step.required}
            onChange={(e) => updateStep(key, { required: e.target.checked })}
          />
          Obrigatório
        </label>
      )}
    </div>
  );
}

function EndingSettings({
  tier,
  es,
  update,
}: {
  tier: Tier;
  es: EndScreen;
  update: (p: Partial<EndScreen>) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: tier.color }} />
        <span className="font-bold text-[var(--text)]">Tela final · {tier.name}</span>
      </div>
      <FieldRow label="Título">
        <input
          className={inputCls}
          value={es.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Use {nome} para personalizar"
        />
      </FieldRow>
      <FieldRow label="Mensagem">
        <textarea
          className={`${inputCls} min-h-[80px]`}
          value={es.message}
          onChange={(e) => update({ message: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Texto do botão (opcional)">
        <input
          className={inputCls}
          value={es.ctaLabel ?? ""}
          onChange={(e) => update({ ctaLabel: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Link do botão">
        <input
          className={inputCls}
          value={es.ctaHref ?? ""}
          onChange={(e) => update({ ctaHref: e.target.value })}
          placeholder="https:// ou https://wa.me/..."
        />
      </FieldRow>
      <label className="mt-1 flex items-center gap-2 text-sm text-[var(--text2)]">
        <input
          type="checkbox"
          checked={!!es.qualified}
          onChange={(e) => update({ qualified: e.target.checked })}
        />
        Marcar como lead qualificado
      </label>
    </div>
  );
}

// =====================================================================
// Aba Integrações
// =====================================================================
function IntegrateTab({
  pixel,
  updatePixel,
  webhookUrl,
  setWebhookUrl,
}: {
  pixel: PixelConfig;
  updatePixel: (p: Partial<PixelConfig>) => void;
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[760px] px-6 py-8">
      <IntegrationCard
        title="Meta / Facebook Pixel"
        desc="Adicione o Pixel ID e o token da Conversions API para rastrear e otimizar suas campanhas."
        color="#1877f2"
        icon="M"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Meta Pixel ID">
            <input className={inputCls} value={pixel.metaPixelId ?? ""} onChange={(e) => updatePixel({ metaPixelId: e.target.value })} placeholder="123456789012345" />
          </FieldRow>
          <FieldRow label="CAPI — token">
            <input className={inputCls} value={pixel.metaCapiToken ?? ""} onChange={(e) => updatePixel({ metaCapiToken: e.target.value })} placeholder="EAAB..." />
          </FieldRow>
          <FieldRow label="Código de teste (opcional)">
            <input className={inputCls} value={pixel.metaTestCode ?? ""} onChange={(e) => updatePixel({ metaTestCode: e.target.value })} placeholder="TEST12345" />
          </FieldRow>
        </div>
      </IntegrationCard>

      <IntegrationCard
        title="Google Analytics 4"
        desc="Measurement ID e API secret para enviar conversões client-side e server-side."
        color="#e37400"
        icon="G"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Measurement ID">
            <input className={inputCls} value={pixel.ga4Id ?? ""} onChange={(e) => updatePixel({ ga4Id: e.target.value })} placeholder="G-XXXXXXX" />
          </FieldRow>
          <FieldRow label="API secret">
            <input className={inputCls} value={pixel.ga4ApiSecret ?? ""} onChange={(e) => updatePixel({ ga4ApiSecret: e.target.value })} placeholder="Measurement Protocol secret" />
          </FieldRow>
        </div>
      </IntegrationCard>

      <IntegrationCard
        title="Webhook (CRM)"
        desc="Informe uma URL que recebe os dados a cada envio do formulário (CRM próprio, n8n, Make, etc.)."
        color="#c53d5d"
        icon="⇢"
      >
        <FieldRow label="URL do webhook">
          <input className={inputCls} value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://seu-crm.com/webhook" />
        </FieldRow>
        <p className="mono mt-1 text-[0.68rem] text-[var(--text3)]">
          Se vazio, usa a URL global (variável CRM_WEBHOOK_URL).
        </p>
      </IntegrationCard>
    </div>
  );
}

function IntegrationCard({
  title,
  desc,
  color,
  icon,
  children,
}: {
  title: string;
  desc: string;
  color: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ background: color }}
        >
          {icon}
        </span>
        <div>
          <div className="font-bold uppercase tracking-wide text-[var(--text)]">
            {title}
          </div>
          <p className="mt-0.5 text-sm text-[var(--text2)]">{desc}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// =====================================================================
// Aba Compartilhar
// =====================================================================
function ShareTab({ slug, published }: { slug: string; published: boolean }) {
  const base =
    typeof window !== "undefined" ? window.location.origin : "https://hibrid-forms.vercel.app";
  const url = `${base}/f/${slug}`;
  return (
    <div className="mx-auto max-w-[760px] px-6 py-8">
      {!published && (
        <div className="mb-5 rounded-xl border border-[#f0d98a] bg-[#fdf7e3] px-4 py-3 text-sm text-[#8a6d1a]">
          Este formulário ainda não está publicado. Ative “Publicado” em
          Editor → Ajustes para ele ficar visível.
        </div>
      )}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <span className="lbl">Link do formulário</span>
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={url}
            className={`${inputCls} bg-[var(--bg)]`}
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
          >
            Abrir ↗
          </a>
        </div>
        <p className="mt-2 text-sm text-[var(--text2)]">
          Use este link como página de destino do anúncio ou no botão da sua
          landing page.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <span className="lbl">Hidden fields (rastreamento)</span>
        <p className="mt-2 text-sm text-[var(--text2)]">
          O formulário captura automaticamente da URL:{" "}
          <span className="mono text-[0.8rem]">
            utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid,
            fbclid
          </span>
          . Exemplo:
        </p>
        <div className="mono mt-2 rounded-md bg-[var(--bg)] px-3 py-2 text-[0.78rem] text-[var(--text2)]">
          {url}?utm_source=google&amp;gclid=ABC123
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// UI helpers
// =====================================================================
const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--acc2)] focus:shadow-[0_0_0_3px_rgba(194,251,141,0.35)]";

function NavPill({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-[var(--text)] text-white" : "text-[var(--text2)] hover:text-[var(--text)]"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// Ícones do menu do topo (estilo Yay)
function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconIntegrate() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M12 7.4v3.2M10.2 16.4L7.6 14M13.8 16.4L16.4 14" />
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="19" r="2.4" />
      <path d="M8.1 10.9l7.8-4.6M8.1 13.1l7.8 4.6" />
    </svg>
  );
}
function IconResults() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15.5A9 9 0 1 1 8.5 3" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5V12z" />
    </svg>
  );
}

function SideTab({
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
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-[var(--card)] text-[var(--text)] shadow-sm" : "text-[var(--text2)]"
      }`}
    >
      {children}
    </button>
  );
}

function ListLabel({ children }: { children: React.ReactNode }) {
  return <div className="lbl mb-2 block">{children}</div>;
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
      <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">{label}</label>
      {children}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  danger,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-sm transition ${
        danger
          ? "text-[var(--text3)] hover:border-[var(--red)] hover:text-[var(--red)]"
          : "text-[var(--text2)] hover:border-[#bbb] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}
