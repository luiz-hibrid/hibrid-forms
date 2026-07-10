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
  ThemeConfig,
  FieldMedia,
} from "@/lib/types";
import { END_STEP } from "@/lib/types";
import { normalizeEnds, END_PREFIX } from "@/lib/ends";
import { FONT_OPTIONS, DEFAULT_THEME, themeVars } from "@/lib/theme";
import type { FormRow } from "@/lib/forms-db";
import { Logo } from "@/components/Logo";
import { MediaView } from "@/components/MediaView";

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

// Ordem dos tipos no seletor
const TYPE_ORDER: FieldType[] = [
  "single",
  "multi",
  "name",
  "email",
  "tel",
  "link",
  "text",
  "welcome",
];

// Seletor de tipo com ícones coloridos (estilo Yay)
function TypeSelect({
  value,
  onChange,
}: {
  value: FieldType;
  onChange: (t: FieldType) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} flex items-center justify-between gap-2`}
      >
        <span className="flex items-center gap-2">
          <ColorIcon type={value} size={22} />
          {TYPE_META[value].label}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--text)] transition hover:bg-[var(--bg)] ${
                  t === value ? "bg-[rgba(194,251,141,0.14)]" : ""
                }`}
              >
                <ColorIcon type={t} size={22} />
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
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

export function FormEditor({
  initial,
  initialTab,
}: {
  initial: FormRow;
  initialTab?: TopTab;
}) {
  const router = useRouter();
  const cfg = (initial.config ?? {}) as any;

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [published, setPublished] = useState(initial.published);
  const [eyebrow, setEyebrow] = useState(cfg.eyebrow ?? "");
  const [trackDropoff, setTrackDropoff] = useState<boolean>(!!cfg.trackDropoff);
  const [steps, setSteps] = useState<EditorField[]>(
    (cfg.steps ?? []).map((s: Field) => ({ ...s, _key: genId("k") }))
  );
  const _norm = normalizeEnds(cfg);
  const [tiers, setTiers] = useState<Tier[]>(
    _norm.tiers.length
      ? _norm.tiers
      : [
          { id: "frio", name: "Frio", minPct: 0, color: "#999999" },
          { id: "morno", name: "Morno", minPct: 40, color: "#F0B822" },
          { id: "quente", name: "Quente", minPct: 70, color: "#c2fb8d" },
        ]
  );
  const [endScreens, setEndScreens] = useState<EndScreen[]>(_norm.endScreens);
  const [defaultEndId, setDefaultEndId] = useState<string | undefined>(
    _norm.defaultEndScreenId
  );
  const [pixel, setPixel] = useState<PixelConfig>(cfg.pixel ?? {});
  const [theme, setTheme] = useState<ThemeConfig>(cfg.theme ?? {});
  const [webhookUrl, setWebhookUrl] = useState<string>(cfg.webhookUrl ?? "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>(initialTab ?? "edit");
  const [leftTab, setLeftTab] = useState<"content" | "design" | "settings">(
    "content"
  );
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

  // seleção: "step:<_key>" | "end:<endScreenId>"
  const selectedStep = steps.find((s) => `step:${s._key}` === selected) ?? null;
  const selectedEndingId = selected.startsWith("end:")
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
  function addOptionLabeled(key: string, label: string) {
    const text = label.trim();
    if (!text) return;
    setSteps((prev) =>
      prev.map((s) => {
        if (s._key !== key) return s;
        const n = (s.options?.length ?? 0) + 1;
        return {
          ...s,
          options: [
            ...(s.options ?? []),
            { label: text, value: slugify(text) || `opcao-${n}`, weight: 0 },
          ],
        };
      })
    );
  }

  // ---------- tiers / endscreens / pixel ----------
  function updateTier(id: string, patch: Partial<Tier>) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function endScreenById(id: string | null): EndScreen | null {
    return endScreens.find((e) => e.id === id) ?? null;
  }
  function updateEndScreen(id: string, patch: Partial<EndScreen>) {
    setEndScreens((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function addEndScreen() {
    const id = genId("end");
    setEndScreens((prev) => [
      ...prev,
      {
        id,
        name: "Nova tela final",
        title: "Obrigado, {nome}!",
        message: "Recebemos suas respostas.",
      },
    ]);
    setSelected(`end:${id}`);
  }
  function removeEndScreen(id: string) {
    if (endScreens.length <= 1) return;
    if (!confirm("Excluir esta tela final?")) return;
    setEndScreens((prev) => prev.filter((e) => e.id !== id));
    setTiers((prev) =>
      prev.map((t) => (t.endScreenId === id ? { ...t, endScreenId: undefined } : t))
    );
    if (defaultEndId === id) setDefaultEndId(endScreens.find((e) => e.id !== id)?.id);
    setSelected("");
  }
  function updatePixel(patch: Partial<PixelConfig>) {
    setPixel((p) => ({ ...p, ...patch }));
  }
  function updateTheme(patch: Partial<ThemeConfig>) {
    setTheme((t) => ({ ...t, ...patch }));
  }

  // ---------- save ----------
  function buildConfig() {
    const finalSteps: Field[] = steps.map((s) => {
      const b: Field = { id: s.id || genId(), type: s.type, title: s.title };
      if (s.subtitle) b.subtitle = s.subtitle;
      if (s.placeholder) b.placeholder = s.placeholder;
      if (s.required) b.required = true;
      if (s.buttonLabel) b.buttonLabel = s.buttonLabel;
      if (s.media?.url) b.media = s.media;
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
      defaultEndScreenId: defaultEndId,
      pixel: cleanPixel,
      theme,
      trackDropoff,
      webhookUrl: webhookUrl.trim() || undefined,
      ...(cfg.kanban ? { kanban: cfg.kanban } : {}),
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={() => router.push("/admin/forms")}
            className="shrink-0 text-[var(--text2)] hover:text-[var(--text)]"
            aria-label="Voltar"
          >
            ←
          </button>
          <span className="shrink-0">
            <Logo height={20} />
          </span>
          <span className="min-w-0 max-w-[200px] truncate text-sm font-medium text-[var(--text2)]">
            {name}
          </span>
        </div>

        {/* Nav pílula central */}
        <div className="hidden shrink-0 items-center gap-1 rounded-full bg-[var(--bg)] p-1 md:flex">
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

        <div className="flex flex-1 items-center justify-end gap-3">
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
          <aside className="w-[340px] shrink-0 overflow-y-auto overflow-x-hidden border-r border-[var(--border)] bg-[var(--card)] p-3">
            <div className="mb-3 flex items-center gap-1 rounded-lg bg-[var(--bg)] p-1">
              <SideTab active={leftTab === "content"} onClick={() => setLeftTab("content")}>
                Conteúdo
              </SideTab>
              <SideTab active={leftTab === "design"} onClick={() => setLeftTab("design")}>
                Design
              </SideTab>
              <SideTab active={leftTab === "settings"} onClick={() => setLeftTab("settings")}>
                Ajustes
              </SideTab>
            </div>

            {leftTab === "design" && (
              <DesignPanel theme={theme} updateTheme={updateTheme} />
            )}

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
                    {endScreens.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setSelected(`end:${e.id}`)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                          selected === `end:${e.id}`
                            ? "border-[var(--accent)] bg-[rgba(194,251,141,0.12)]"
                            : "border-[var(--border)] bg-[var(--card)] hover:border-[#bbb]"
                        }`}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                          style={{ background: e.qualified ? "#3d7a00" : "#9aa0a6", fontSize: 10 }}
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[var(--text)]">{e.name}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={addEndScreen}
                    className="mt-2 w-full rounded-lg border border-dashed border-[var(--border)] py-2 text-sm font-medium text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
                  >
                    + Nova tela final
                  </button>
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
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-[var(--text)]">Publicado</span>
                    <Toggle checked={published} onChange={setPublished} />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3 border-t border-[var(--border)] pt-3">
                    <div className="min-w-0">
                      <span className="text-sm text-[var(--text)]">Rastrear abandonos</span>
                      <p className="mt-0.5 text-[0.72rem] text-[var(--text2)]">
                        Registra por onde as pessoas passam e monta o funil de
                        desistência no Resumo. Útil para descobrir a pergunta que
                        mais faz gente sair.
                      </p>
                    </div>
                    <Toggle checked={trackDropoff} onChange={setTrackDropoff} />
                  </div>
                </div>

                <div>
                  <ListLabel>Faixas de score → tela final</ListLabel>
                  <p className="mb-2 text-[0.75rem] text-[var(--text2)]">
                    Usado só quando as perguntas têm pesos. Cada faixa (a partir
                    de X% do score máximo) leva a uma tela final.
                  </p>
                  <div className="grid gap-2">
                    {tiers.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
                          <input
                            className={`${inputCls} min-w-0 flex-1`}
                            value={t.name}
                            onChange={(e) => updateTier(t.id, { name: e.target.value })}
                          />
                          <div className="flex shrink-0 items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="w-14 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-sm"
                              value={t.minPct}
                              onChange={(e) => updateTier(t.id, { minPct: Number(e.target.value) })}
                            />
                            <span className="mono text-[0.6rem] text-[var(--text3)]">%</span>
                          </div>
                        </div>
                        <select
                          value={t.endScreenId ?? ""}
                          onChange={(e) => updateTier(t.id, { endScreenId: e.target.value || undefined })}
                          className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-[0.8rem] text-[var(--text)] outline-none"
                        >
                          <option value="">Tela final: (padrão)</option>
                          {endScreens.map((es) => (
                            <option key={es.id} value={es.id}>
                              Tela: {es.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <ListLabel>Tela final padrão</ListLabel>
                  <select
                    value={defaultEndId ?? ""}
                    onChange={(e) => setDefaultEndId(e.target.value || undefined)}
                    className={inputCls}
                  >
                    {endScreens.map((es) => (
                      <option key={es.id} value={es.id}>
                        {es.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[0.72rem] text-[var(--text3)]">
                    Exibida quando o lead termina sem rota específica.
                  </p>
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
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
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
            <div className="flex flex-1 items-stretch justify-center overflow-y-auto p-6">
              <div
                className="flex w-full flex-col overflow-hidden rounded-2xl border-2 border-[var(--dark)] bg-[var(--card)] shadow-xl"
                style={{
                  maxWidth:
                    device === "mobile" ? 390 : device === "tablet" ? 720 : 1100,
                }}
              >
                <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div
                  className="flex flex-1 items-center justify-center"
                  style={
                    {
                      ...themeVars(theme),
                      background: "var(--form-bg)",
                      fontFamily: "var(--form-font)",
                      minHeight:
                        device === "mobile"
                          ? 620
                          : device === "tablet"
                          ? 620
                          : 540,
                      padding: device === "mobile" ? "28px" : "48px",
                    } as React.CSSProperties
                  }
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth:
                        device === "mobile"
                          ? 330
                          : device === "tablet"
                          ? 520
                          : 640,
                    }}
                  >
                    <StepPreview
                      eyebrow={eyebrow}
                      step={selectedStep}
                      endingId={selectedEndingId}
                      endScreen={endScreenById(selectedEndingId)}
                      onUpdateOption={updateOption}
                      onRemoveOption={removeOption}
                      onAddOption={addOptionLabeled}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna direita — configurações da seleção */}
          <aside className="w-[340px] shrink-0 overflow-y-auto overflow-x-hidden border-l border-[var(--border)] bg-[var(--card)] p-4">
            {selectedStep && (
              <StepSettings
                step={selectedStep}
                steps={steps}
                endScreens={endScreens}
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
            {selectedEndingId && endScreenById(selectedEndingId) && (
              <EndingSettings
                es={endScreenById(selectedEndingId)!}
                update={(patch) => updateEndScreen(selectedEndingId, patch)}
                onDelete={
                  endScreens.length > 1
                    ? () => removeEndScreen(selectedEndingId)
                    : undefined
                }
              />
            )}
            {!selectedStep && !selectedEndingId && (
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
  endingId,
  endScreen,
  onUpdateOption,
  onRemoveOption,
  onAddOption,
}: {
  eyebrow: string;
  step: (Field & { _key: string }) | null;
  endingId: string | null;
  endScreen: EndScreen | null;
  onUpdateOption: (key: string, idx: number, patch: Partial<Option>) => void;
  onRemoveOption: (key: string, idx: number) => void;
  onAddOption: (key: string, label: string) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const btnStyle = {
    background: "var(--form-btn-bg)",
    color: "var(--form-btn-text)",
    borderRadius: "var(--form-radius)",
  } as React.CSSProperties;

  if (endingId && endScreen) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]">
          <span className="text-2xl">✓</span>
        </div>
        <h1
          className="mt-6 text-2xl font-black tracking-tight"
          style={{ color: "var(--form-title)" }}
        >
          {(endScreen.title || "").replace(/\{nome\}/g, "João")}
        </h1>
        <p className="mt-3 whitespace-pre-line" style={{ color: "var(--form-title)", opacity: 0.7 }}>
          {(endScreen.message || "").replace(/\{nome\}/g, "João")}
        </p>
        {endScreen.ctaLabel && (
          <span className="mt-6 inline-block px-6 py-3 text-sm font-bold" style={btnStyle}>
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
    <div className="w-full">
      {step.media && <MediaView media={step.media} />}
      {step.type !== "welcome" && eyebrow && (
        <div className="lbl mb-4">{eyebrow}</div>
      )}
      <h1
        className="font-black leading-tight tracking-tight"
        style={{
          color: "var(--form-title)",
          fontSize: "calc(1.7rem * var(--form-scale, 1))",
        }}
      >
        {step.title || "(sem título)"}
      </h1>
      {step.subtitle && (
        <p className="mt-2 whitespace-pre-line" style={{ color: "var(--form-title)", opacity: 0.65 }}>
          {step.subtitle}
        </p>
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
                className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-white/50 px-3 py-2.5"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border text-[0.72rem] font-bold text-[var(--text2)] ${
                    step.type === "single" ? "rounded-full" : "rounded"
                  } border-[var(--border)]`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={o.label}
                  onChange={(e) => onUpdateOption(step._key, i, { label: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[1rem] outline-none"
                  style={{ color: "var(--form-answer)" }}
                />
                <button
                  onClick={() => onRemoveOption(step._key, i)}
                  className="shrink-0 text-[var(--text3)] opacity-0 transition hover:text-[var(--red)] group-hover:opacity-100"
                  aria-label="Remover opção"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Adicionar opção inline */}
            <div className="flex items-center gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAddOption(step._key, newItem);
                    setNewItem("");
                  }
                }}
                placeholder="Novo item…"
                className="min-w-0 flex-1 rounded-lg border border-dashed border-[var(--border)] bg-transparent px-3 py-2.5 text-[1rem] text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
              />
              <button
                onClick={() => {
                  onAddOption(step._key, newItem);
                  setNewItem("");
                }}
                className="shrink-0 rounded-lg bg-[var(--form-btn-bg,var(--accent))] px-4 py-2.5 text-sm font-bold"
                style={{ color: "var(--form-btn-text, var(--text))" }}
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
        <div className="mt-8">
          <span
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold"
            style={btnStyle}
          >
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
  endScreens,
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
  endScreens: EndScreen[];
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

      {step.type !== "welcome" && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
          <div className="mono mb-2 text-[0.6rem] font-normal uppercase tracking-wider text-[var(--text3)]">
            Configurações
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text)]">Obrigatório</span>
            <Toggle
              checked={!!step.required}
              onChange={(v) => updateStep(key, { required: v })}
            />
          </div>
        </div>
      )}

      <FieldRow label="Tipo">
        <TypeSelect value={step.type} onChange={(t) => changeType(key, t)} />
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

      <MediaSection
        media={step.media}
        onChange={(m) => updateStep(key, { media: m })}
      />

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
                className="group rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5"
              >
                {/* Nome da opção */}
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--card)] text-[0.6rem] font-bold text-[var(--text3)]">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-medium text-[var(--text)] outline-none"
                    value={o.label}
                    placeholder={`Opção ${oi + 1}`}
                    onChange={(e) => updateOption(key, oi, { label: e.target.value })}
                  />
                  <button
                    onClick={() => removeOption(key, oi)}
                    aria-label="Remover"
                    className="shrink-0 text-[var(--text3)] opacity-0 transition hover:text-[var(--red)] group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>

                {/* Pontuação + fluxo (empilhados para caber sempre) */}
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[0.58rem] uppercase tracking-wide text-[var(--text3)]">
                      Pontuação
                    </span>
                    <input
                      type="number"
                      value={o.weight ?? 0}
                      onChange={(e) => updateOption(key, oi, { weight: Number(e.target.value) })}
                      className="w-16 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-right text-sm text-[var(--text)] outline-none focus:border-[var(--acc2)]"
                    />
                  </div>
                  {step.type === "single" && (
                    <div>
                      <span className="mono mb-1 block text-[0.58rem] uppercase tracking-wide text-[var(--text3)]">
                        Ao escolher, ir para
                      </span>
                      <select
                        value={o.next ?? ""}
                        onChange={(e) =>
                          updateOption(key, oi, { next: e.target.value || undefined })
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--acc2)]"
                      >
                        <option value="">Seguir na ordem</option>
                        {steps
                          .filter((t) => t._key !== key)
                          .map((t) => (
                            <option key={t._key} value={t.id}>
                              Ir para: {t.title || t.id}
                            </option>
                          ))}
                        {endScreens.map((es) => (
                          <option key={es.id} value={`${END_PREFIX}${es.id}`}>
                            Encerrar em: {es.name}
                          </option>
                        ))}
                        <option value={END_STEP}>Encerrar (por score/padrão)</option>
                      </select>
                    </div>
                  )}
                </div>
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

    </div>
  );
}

function EndingSettings({
  es,
  update,
  onDelete,
}: {
  es: EndScreen;
  update: (p: Partial<EndScreen>) => void;
  onDelete?: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="lbl">Tela final</span>
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-[var(--text3)] hover:text-[var(--red)]"
            aria-label="Excluir tela final"
            title="Excluir"
          >
            🗑
          </button>
        )}
      </div>
      <FieldRow label="Nome (interno)">
        <input
          className={inputCls}
          value={es.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Ex.: Qualificado, Fora do perfil…"
        />
      </FieldRow>
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
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-[var(--text)]">Marcar como lead qualificado</span>
        <Toggle
          checked={!!es.qualified}
          onChange={(v) => update({ qualified: v })}
        />
      </div>
    </div>
  );
}

// =====================================================================
// Painel Design (esquerda)
// =====================================================================
function DesignPanel({
  theme,
  updateTheme,
}: {
  theme: ThemeConfig;
  updateTheme: (p: Partial<ThemeConfig>) => void;
}) {
  const t = { ...DEFAULT_THEME, ...theme };
  return (
    <div className="grid gap-5">
      <div>
        <DesignLabel>Página</DesignLabel>
        <ColorField
          label="Cor de fundo"
          value={t.bg}
          onChange={(v) => updateTheme({ bg: v })}
        />
        <div className="mb-3">
          <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">Fonte</label>
          <select
            value={t.font}
            onChange={(e) => updateTheme({ font: e.target.value })}
            className={inputCls}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-1">
          <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">
            Tamanho da fonte
          </label>
          <Segmented
            value={t.fontSize}
            onChange={(v) => updateTheme({ fontSize: v as ThemeConfig["fontSize"] })}
            options={[
              { value: "sm", label: "SM" },
              { value: "md", label: "MD" },
              { value: "lg", label: "LG" },
            ]}
          />
        </div>
      </div>

      <div>
        <DesignLabel>Pergunta</DesignLabel>
        <ColorField
          label="Títulos e textos"
          value={t.questionColor}
          onChange={(v) => updateTheme({ questionColor: v })}
        />
        <ColorField
          label="Respostas"
          value={t.answerColor}
          onChange={(v) => updateTheme({ answerColor: v })}
        />
      </div>

      <div>
        <DesignLabel>Botão</DesignLabel>
        <ColorField
          label="Cor de fundo"
          value={t.buttonBg}
          onChange={(v) => updateTheme({ buttonBg: v })}
        />
        <ColorField
          label="Cor do texto"
          value={t.buttonText}
          onChange={(v) => updateTheme({ buttonText: v })}
        />
        <div className="mb-1">
          <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">Cantos</label>
          <Segmented
            value={t.corners}
            onChange={(v) => updateTheme({ corners: v as ThemeConfig["corners"] })}
            options={[
              { value: "square", label: <CornerIcon radius={1} /> },
              { value: "rounded", label: <CornerIcon radius={5} /> },
              { value: "pill", label: <CornerIcon radius={9} /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function CornerIcon({ radius }: { radius: number }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
      <rect
        x="1.5"
        y="1.5"
        width="19"
        height="13"
        rx={radius}
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function DesignLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono mb-2 text-[0.6rem] font-normal uppercase tracking-wider text-[var(--text3)]">
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm text-[var(--text2)]">{label}</span>
      <label className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1">
        <span
          className="h-5 w-5 rounded-full border border-[var(--border)]"
          style={{ background: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-0 w-0 opacity-0"
        />
        <span className="mono text-[0.62rem] text-[var(--text3)]">{value}</span>
      </label>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            value === o.value
              ? "bg-[var(--card)] text-[var(--text)] shadow-sm"
              : "text-[var(--text2)] hover:text-[var(--text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// =====================================================================
// Mídia (imagem/vídeo acima da pergunta)
// =====================================================================
function MediaSection({
  media,
  onChange,
}: {
  media?: FieldMedia;
  onChange: (m: FieldMedia | undefined) => void;
}) {
  const [modal, setModal] = useState(false);
  const label = (
    <span className="mono text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
      Imagem / Vídeo
    </span>
  );

  if (!media) {
    return (
      <div className="mb-4 flex items-center justify-between">
        {label}
        <button
          onClick={() => setModal(true)}
          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-bold text-[var(--text2)] transition hover:border-[#bbb] hover:text-[var(--text)]"
        >
          + Adicionar
        </button>
        {modal && (
          <MediaModal
            onClose={() => setModal(false)}
            onPick={(m) => {
              onChange(m);
              setModal(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="mb-2 flex items-center justify-between">
        {label}
        <button
          onClick={() => onChange(undefined)}
          aria-label="Remover"
          title="Remover"
          className="text-[var(--text3)] hover:text-[var(--red)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)]">
        {media.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt="" className="max-h-28 w-full object-cover" />
        ) : (
          <div className="truncate p-3 text-xs text-[var(--text2)]">🎬 {media.url}</div>
        )}
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">Posição</label>
        <Segmented
          value={media.align ?? "center"}
          onChange={(v) => onChange({ ...media, align: v as FieldMedia["align"] })}
          options={[
            { value: "left", label: "⬅" },
            { value: "center", label: "▣" },
            { value: "right", label: "➡" },
          ]}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">Altura (px)</label>
          <input
            className={inputCls}
            value={media.height ?? ""}
            onChange={(e) => onChange({ ...media, height: e.target.value.replace(/\D/g, "") })}
            placeholder="auto"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">Largura (%)</label>
          <input
            className={inputCls}
            value={media.width ?? ""}
            onChange={(e) => onChange({ ...media, width: e.target.value.replace(/\D/g, "") })}
            placeholder="auto"
          />
        </div>
      </div>

      {media.kind === "image" && (
        <div className="mt-3">
          <label className="mb-1 block text-[0.78rem] text-[var(--text2)]">Texto alternativo</label>
          <input
            className={inputCls}
            value={media.alt ?? ""}
            onChange={(e) => onChange({ ...media, alt: e.target.value })}
            placeholder="Descrição da imagem"
          />
        </div>
      )}

      <button
        onClick={() => setModal(true)}
        className="mt-3 text-sm font-medium text-[var(--text2)] hover:text-[var(--text)]"
      >
        Trocar mídia
      </button>
      {modal && (
        <MediaModal
          onClose={() => setModal(false)}
          onPick={(m) => {
            onChange({ ...m, align: media.align, width: media.width, height: media.height });
            setModal(false);
          }}
        />
      )}
    </div>
  );
}

function MediaModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (m: FieldMedia) => void;
}) {
  const [tab, setTab] = useState<"upload" | "url" | "video">("upload");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.url) onPick({ kind: "image", url: data.url, align: "center" });
    else
      setErr(
        data.error === "arquivo_grande"
          ? "Arquivo acima de 2MB."
          : data.error === "tipo_invalido"
          ? "Tipo de arquivo não suportado."
          : "Falha no upload."
      );
  }

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "upload", label: "Enviar imagem" },
    { id: "url", label: "URL da imagem" },
    { id: "video", label: "Vídeo" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="mono text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
            Adicionar imagem ou vídeo
          </span>
          <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)]">
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "border-[var(--text)] text-[var(--text)]"
                  : "border-transparent text-[var(--text3)] hover:text-[var(--text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] py-14 text-center transition hover:border-[#bbb]">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <span className="text-2xl text-[var(--text3)]">⬆</span>
            <span className="mt-2 text-sm text-[var(--text2)]">
              {busy ? "Enviando…" : "Selecione uma imagem (até 2MB)"}
            </span>
            <span className="mono mt-1 text-[0.65rem] text-[var(--text3)]">
              png, jpg, gif, svg, webp
            </span>
          </label>
        )}

        {tab === "url" && (
          <div>
            <input
              className={inputCls}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
            />
            <button
              onClick={() => url.trim() && onPick({ kind: "image", url: url.trim(), align: "center" })}
              className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--text)] hover:bg-[var(--acc2)]"
            >
              Adicionar imagem
            </button>
          </div>
        )}

        {tab === "video" && (
          <div>
            <input
              className={inputCls}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Link do YouTube, Vimeo ou .mp4"
            />
            <button
              onClick={() => url.trim() && onPick({ kind: "video", url: url.trim(), align: "center" })}
              className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--text)] hover:bg-[var(--acc2)]"
            >
              Adicionar vídeo
            </button>
          </div>
        )}

        {err && <p className="mt-3 text-sm text-[var(--red)]">{err}</p>}
      </div>
    </div>
  );
}

// =====================================================================
// Aba Integrações
// =====================================================================
// Logos oficiais das plataformas (marcas Simple Icons, cor da marca)
function LogoGTM() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#246FDB" d="M12.003 0a3 3 0 0 0-2.121 5.121l6.865 6.865-4.446 4.541 1.745 1.836a3.432 3.432 0 0 1 .7.739l.012.011-.001.002a3.432 3.432 0 0 1 .609 1.953 3.432 3.432 0 0 1-.09.78l7.75-7.647c.031-.029.067-.05.098-.08.023-.023.038-.052.06-.076a2.994 2.994 0 0 0-.06-4.166l-9-9A2.99 2.99 0 0 0 12.003 0zM8.63 2.133L.88 9.809a2.998 2.998 0 0 0 0 4.238l7.7 7.75a3.432 3.432 0 0 1-.077-.729 3.432 3.432 0 0 1 3.431-3.431 3.432 3.432 0 0 1 .826.101l-5.523-5.81 4.371-4.373-2.08-2.08c-.903-.904-1.193-2.183-.898-3.342zm3.304 16.004a2.932 2.932 0 0 0-2.931 2.931A2.932 2.932 0 0 0 11.934 24a2.932 2.932 0 0 0 2.932-2.932 2.932 2.932 0 0 0-2.932-2.931z" />
    </svg>
  );
}
function LogoGoogleAds() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#4285F4" d="M3.9998 22.9291C1.7908 22.9291 0 21.1383 0 18.9293s1.7908-3.9998 3.9998-3.9998 3.9998 1.7908 3.9998 3.9998-1.7908 3.9998-3.9998 3.9998zm19.4643-6.0004L15.4632 3.072C14.3586 1.1587 11.9121.5028 9.9988 1.6074S7.4295 5.1585 8.5341 7.0718l8.0009 13.8567c1.1046 1.9133 3.5511 2.5679 5.4644 1.4646 1.9134-1.1046 2.568-3.5511 1.4647-5.4644zM7.5137 4.8438L1.5645 15.1484A4.5 4.5 0 0 1 4 14.4297c2.5597-.0075 4.6248 2.1585 4.4941 4.7148l3.2168-5.5723-3.6094-6.25c-.4499-.7793-.6322-1.6394-.5878-2.4784z" />
    </svg>
  );
}
function LogoMeta() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#0081FB" d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.516-3.844l-.881-1.471-.209-.344c.472-.752.943-1.46 1.399-2.005.985-1.177 1.837-1.63 2.72-1.63zm-11.11.11c.851 0 1.68.446 2.703 1.583.454.505.917 1.12 1.395 1.836l-.727 1.114c-.782 1.203-1.297 2.028-1.762 2.727-.972 1.462-1.554 1.882-2.34 1.882-.834 0-1.4-.638-1.4-2.16 0-2.093.63-4.489 1.62-5.987.412-.62.892-1.086 1.42-1.412-.19.01-.38.02-.57.04.06-.01.12-.01.18-.02z" />
    </svg>
  );
}
function LogoGA4() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#E37400" d="M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 01-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z" />
    </svg>
  );
}

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
        title="Google Tag Manager"
        desc="Recomendado. Com o container do GTM você configura GA4, Meta e Google Ads (incl. Enhanced Conversions / Advanced Match) sem código — nós empurramos os dados no dataLayer."
        icon={<LogoGTM />}
      >
        <FieldRow label="Container ID">
          <input
            className={inputCls}
            value={pixel.gtmId ?? ""}
            onChange={(e) => updatePixel({ gtmId: e.target.value })}
            placeholder="GTM-XXXXXXX"
          />
        </FieldRow>
        <EventsNote
          items={[
            ["form_view", "ao abrir o formulário"],
            ["form_start", "quando a pessoa começa"],
            ["generate_lead", "ao concluir (com value, gclid, event_id e user_data para Enhanced Conversions)"],
          ]}
        />
      </IntegrationCard>

      <IntegrationCard
        title="Google Ads — conversões offline"
        desc="Nome da ação de conversão no Google Ads. Usado na exportação de leads qualificados (via gclid) para você importar em Ferramentas → Conversões → Uploads."
        icon={<LogoGoogleAds />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Nome da conversão (para o CSV)">
            <input
              className={inputCls}
              value={pixel.googleConversionName ?? ""}
              onChange={(e) => updatePixel({ googleConversionName: e.target.value })}
              placeholder="Ex.: Lead Qualificado - Hibrid"
            />
          </FieldRow>
          <FieldRow label="Customer ID do cliente (envio via API)">
            <input
              className={inputCls}
              value={pixel.googleCustomerId ?? ""}
              onChange={(e) => updatePixel({ googleCustomerId: e.target.value })}
              placeholder="Conta do cliente na MCC (só dígitos)"
            />
          </FieldRow>
          <FieldRow label="Conversion Action ID (envio via API)">
            <input
              className={inputCls}
              value={pixel.googleConversionActionId ?? ""}
              onChange={(e) => updatePixel({ googleConversionActionId: e.target.value })}
              placeholder="Só o número da ação de conversão"
            />
          </FieldRow>
        </div>
        <p className="mono mt-2 text-[0.68rem] text-[var(--text3)]">
          O envio automático via API dispara para leads qualificados que têm
          gclid, quando as credenciais do Google Ads estão configuradas no
          servidor.
        </p>
        <GoogleAdsTestButton
          customerId={pixel.googleCustomerId}
          conversionActionId={pixel.googleConversionActionId}
        />
      </IntegrationCard>

      <IntegrationCard
        title="Meta / Facebook Pixel"
        desc="Adicione o Pixel ID e o token da Conversions API para rastrear e otimizar suas campanhas."
        icon={<LogoMeta />}
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
        <EventsNote
          items={[
            ["PageView", "ao abrir o formulário"],
            ["Lead", "ao concluir"],
            ["LeadQualificado", "quando o lead é qualificado"],
          ]}
        />
      </IntegrationCard>

      <IntegrationCard
        title="Google Analytics 4"
        desc="Measurement ID e API secret para enviar conversões client-side e server-side."
        icon={<LogoGA4 />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Measurement ID">
            <input className={inputCls} value={pixel.ga4Id ?? ""} onChange={(e) => updatePixel({ ga4Id: e.target.value })} placeholder="G-XXXXXXX" />
          </FieldRow>
          <FieldRow label="API secret">
            <input className={inputCls} value={pixel.ga4ApiSecret ?? ""} onChange={(e) => updatePixel({ ga4ApiSecret: e.target.value })} placeholder="Measurement Protocol secret" />
          </FieldRow>
        </div>
        <EventsNote
          items={[
            ["page_view", "ao abrir o formulário"],
            ["generate_lead", "ao concluir"],
          ]}
        />
      </IntegrationCard>

      <IntegrationCard
        title="Webhook (CRM)"
        desc="Informe uma URL que recebe os dados a cada envio do formulário (CRM próprio, n8n, Make, etc.)."
        icon={
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#c53d5d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5" />
            <path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5" />
          </svg>
        }
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

function GoogleAdsTestButton({
  customerId,
  conversionActionId,
}: {
  customerId?: string;
  conversionActionId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const q = new URLSearchParams();
      if (customerId) q.set("customerId", customerId);
      if (conversionActionId) q.set("conversionActionId", conversionActionId);
      const res = await fetch(`/api/admin/google-test?${q.toString()}`);
      const data = await res.json();
      const a = data.action as
        | { name?: string; id?: string; type?: string; status?: string }
        | undefined;
      if (data.ok && a) {
        setResult({
          ok: true,
          msg: `Conta e ação válidas — ${a.name ?? a.id} · ${a.type ?? ""} · ${a.status ?? ""}`,
        });
      } else if (data.ok) {
        setResult({ ok: true, msg: "Credenciais válidas." });
      } else {
        setResult({ ok: false, msg: data.error || "Falha na validação." });
      }
    } catch {
      setResult({ ok: false, msg: "Erro ao validar." });
    }
    setLoading(false);
  }

  return (
    <div className="mt-3">
      <button
        onClick={run}
        disabled={loading || !customerId || !conversionActionId}
        className="rounded-full bg-[var(--text)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-45"
      >
        {loading ? "Validando…" : "Validar conexão"}
      </button>
      {result && (
        <p
          className={`mt-2 text-sm ${
            result.ok ? "text-[#3d7a00]" : "text-[var(--red)]"
          }`}
        >
          {result.ok ? "✓ " : "✕ "}
          {result.msg}
        </p>
      )}
    </div>
  );
}

function EventsNote({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="mono mb-1.5 text-[0.55rem] uppercase tracking-wide text-[var(--text3)]">
        Eventos disparados
      </div>
      <ul className="space-y-1 text-[0.78rem] text-[var(--text2)]">
        {items.map(([ev, when]) => (
          <li key={ev} className="flex items-center gap-2">
            <span className="mono rounded bg-[var(--card)] px-1.5 py-0.5 text-[0.68rem] font-bold text-[var(--text)]">
              {ev}
            </span>
            <span>{when}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntegrationCard({
  title,
  desc,
  icon,
  children,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-[var(--text)]" : "bg-[var(--border)]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
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
