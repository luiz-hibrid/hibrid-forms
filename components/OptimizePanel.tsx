"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Field } from "@/lib/types";
import type { Insight, InsightSample } from "@/lib/insights";

// ============================================================
// Aba "Otimizar" — conselheiro de conversão.
// Lê a última análise salva; gerar uma nova é ação explícita do master
// (cada disparo custa uma chamada de API).
// ============================================================

interface SavedInsight {
  id: string;
  created_at: string;
  model: string | null;
  sample: InsightSample;
  payload: Insight;
}

const SEV = {
  alta: { label: "Alta", cls: "bg-[rgba(255,69,69,0.1)] text-[var(--red)]" },
  media: { label: "Média", cls: "bg-[rgba(0,0,0,0.05)] text-[var(--text2)]" },
  baixa: { label: "Baixa", cls: "bg-[var(--bg)] text-[var(--text3)]" },
};

const CONF = {
  alta: { label: "Confiança alta", cls: "bg-[rgba(194,251,141,0.3)] text-[#3d7a00]" },
  media: { label: "Confiança média", cls: "bg-[rgba(0,0,0,0.05)] text-[var(--text2)]" },
  baixa: { label: "Confiança baixa", cls: "bg-[rgba(255,69,69,0.1)] text-[var(--red)]" },
};

const ESFORCO: Record<string, string> = { baixo: "Esforço baixo", medio: "Esforço médio", alto: "Esforço alto" };

function fmtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OptimizePanel({ formId, steps }: { formId: string; steps: Field[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [canGenerate, setCanGenerate] = useState(false);
  const [insight, setInsight] = useState<SavedInsight | null>(null);

  // ações marcadas para virar o formulário novo (índices na lista já ordenada)
  const [picked, setPicked] = useState<number[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const stepTitle = useCallback(
    (id?: string) => (id ? steps.find((s) => s.id === id)?.title : undefined),
    [steps]
  );

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/forms/${formId}/insights`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setConfigured(!!d.configured);
        setCanGenerate(!!d.canGenerate);
        setInsight(d.insight ?? null);
      })
      .catch(() => alive && setError("Não foi possível carregar a análise."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [formId]);

  // ordem estável das ações — é a mesma que o servidor usa para casar os índices
  const acoes = useMemo(
    () => (insight?.payload.acoes ?? []).slice().sort((x, y) => x.prioridade - y.prioridade),
    [insight]
  );

  // toda análise nova chega com tudo marcado
  useEffect(() => {
    setPicked(acoes.map((_, i) => i));
    setBuildError(null);
  }, [acoes]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/forms/${formId}/insights`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error || "Falha ao gerar a análise.");
      else setInsight(data.insight);
    } catch {
      setError("Falha de rede ao gerar a análise.");
    } finally {
      setGenerating(false);
    }
  }

  function toggle(i: number) {
    setPicked((p) => (p.includes(i) ? p.filter((v) => v !== i) : [...p, i].sort((a, b) => a - b)));
  }

  async function buildForm() {
    if (!insight || !picked.length) return;
    setBuilding(true);
    setBuildError(null);
    try {
      const res = await fetch(`/api/admin/forms/${formId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId: insight.id, actionIndexes: picked }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBuildError(data.error || "Falha ao criar o formulário.");
        return;
      }
      router.push(`/admin/forms/${data.id}`);
    } catch {
      setBuildError("Falha de rede ao criar o formulário.");
    } finally {
      setBuilding(false);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-[0.85rem] text-[var(--text3)]">Carregando…</p>;
  }

  if (!configured) {
    return (
      <Empty
        title="Integração de IA não configurada"
        body="Adicione a variável ANTHROPIC_API_KEY nas configurações do projeto na Vercel e faça um novo deploy para liberar as recomendações."
      />
    );
  }

  const a = insight?.payload;
  const conf = a ? CONF[a.confianca] ?? CONF.media : null;

  return (
    <div className="mx-auto max-w-[860px]">
      {/* cabeçalho */}
      <div className="dash-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="min-w-0">
          <span className="lbl">Conselheiro de conversão</span>
          <p className="mt-1.5 max-w-[52ch] text-[0.8rem] leading-relaxed text-[var(--text2)]">
            Lê o funil, a ordem e o tipo das perguntas, o perfil de quem converte e a origem do
            tráfego — e aponta onde está o gargalo.
          </p>
          {insight && (
            <p className="mono mt-2 text-[0.62rem] uppercase tracking-wider text-[var(--text3)]">
              Última análise · {fmtDateTime(insight.created_at)}
            </p>
          )}
        </div>
        {canGenerate && (
          <button
            onClick={generate}
            disabled={generating}
            className="mono shrink-0 rounded-full bg-[var(--dark)] px-5 py-2.5 text-[0.68rem] font-bold uppercase tracking-wider text-white transition hover:bg-[var(--text2)] disabled:opacity-50"
          >
            {generating ? "Analisando…" : insight ? "Analisar de novo" : "Gerar análise"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-[rgba(255,69,69,0.08)] px-4 py-3 text-[0.8rem] text-[var(--red)]">
          {error}
        </p>
      )}

      {generating && (
        <p className="mt-4 text-center text-[0.8rem] text-[var(--text3)]">
          Lendo os dados e montando o diagnóstico. Leva alguns instantes.
        </p>
      )}

      {!insight && !generating && !error && (
        <Empty
          title="Nenhuma análise ainda"
          body={
            canGenerate
              ? "Clique em “Gerar análise” para receber o diagnóstico deste formulário."
              : "A análise é gerada pela equipe da Hibrid. Assim que houver uma, ela aparece aqui."
          }
        />
      )}

      {a && !generating && (
        <div className="mt-4 flex flex-col gap-4">
          {/* diagnóstico */}
          <section className="dash-in rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="lbl">Diagnóstico</span>
              {conf && (
                <span
                  className={`mono rounded-full px-2.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide ${conf.cls}`}
                >
                  {conf.label}
                </span>
              )}
            </div>
            <p className="text-[0.95rem] leading-relaxed text-[var(--text)]">{a.diagnostico}</p>
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-[0.75rem] leading-relaxed text-[var(--text3)]">
              {a.confiancaMotivo}
            </p>
          </section>

          {/* achados */}
          {a.achados?.length > 0 && (
            <section className="dash-in rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <span className="lbl">O que os dados mostram</span>
              <div className="mt-4 flex flex-col gap-4">
                {a.achados.map((f, i) => {
                  const sev = SEV[f.gravidade] ?? SEV.media;
                  return (
                    <div key={i} className="border-l-2 border-[var(--border)] pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`mono rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide ${sev.cls}`}
                        >
                          {sev.label}
                        </span>
                        <h4 className="text-[0.9rem] font-bold text-[var(--text)]">{f.titulo}</h4>
                      </div>
                      {stepTitle(f.stepId) && (
                        <p className="mono mt-1 text-[0.62rem] uppercase tracking-wider text-[var(--text3)]">
                          {stepTitle(f.stepId)}
                        </p>
                      )}
                      <p className="mt-2 text-[0.82rem] leading-relaxed text-[var(--text2)]">
                        {f.evidencia}
                      </p>
                      <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[var(--text3)]">
                        {f.hipotese}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ações */}
          {acoes.length > 0 && (
            <section className="dash-in rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="lbl">O que fazer, nesta ordem</span>
                {canGenerate && (
                  <span className="text-[0.72rem] text-[var(--text3)]">
                    Marque o que deve entrar no formulário novo.
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {acoes.map((ac, i) => {
                  const on = picked.includes(i);
                  return (
                    <div
                      key={i}
                      className="rounded-xl bg-[var(--bg)] p-4 transition"
                      style={{
                        ...(i === 0 ? { boxShadow: "inset 3px 0 0 var(--accent)" } : {}),
                        ...(canGenerate && !on ? { opacity: 0.45 } : {}),
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {canGenerate ? (
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(i)}
                            aria-label={`Aplicar: ${ac.titulo}`}
                            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--dark)]"
                          />
                        ) : (
                          <span className="mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--dark)] text-[0.65rem] font-bold text-white">
                            {ac.prioridade}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[0.92rem] font-bold text-[var(--text)]">{ac.titulo}</h4>
                          {stepTitle(ac.stepId) && (
                            <p className="mono mt-1 text-[0.62rem] uppercase tracking-wider text-[var(--text3)]">
                              {stepTitle(ac.stepId)}
                            </p>
                          )}
                          <p className="mt-2 whitespace-pre-line text-[0.85rem] leading-relaxed text-[var(--text)]">
                            {ac.oQueFazer}
                          </p>
                          <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--text2)]">
                            {ac.porQue}
                          </p>
                          <div className="mono mt-3 flex flex-wrap items-center gap-2 text-[0.58rem] uppercase tracking-wider">
                            <span className="rounded-full bg-[var(--card)] px-2.5 py-1 text-[var(--text2)]">
                              {ac.impactoEsperado}
                            </span>
                            <span className="rounded-full bg-[var(--card)] px-2.5 py-1 text-[var(--text3)]">
                              {ESFORCO[ac.esforco] ?? ac.esforco}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canGenerate && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <p className="max-w-[46ch] text-[0.75rem] leading-relaxed text-[var(--text3)]">
                    Nasce como rascunho e compartilha a base de leads deste formulário — as
                    respostas das duas versões aparecem na mesma tabela.
                  </p>
                  <button
                    onClick={buildForm}
                    disabled={building || !picked.length}
                    className="mono shrink-0 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[0.68rem] font-bold uppercase tracking-wider text-[var(--dark)] transition hover:bg-[var(--acc2)] disabled:opacity-40"
                  >
                    {building
                      ? "Criando formulário…"
                      : `Gerar formulário com ${picked.length} ${
                          picked.length === 1 ? "ação" : "ações"
                        }`}
                  </button>
                </div>
              )}

              {buildError && (
                <p className="mt-3 rounded-xl bg-[rgba(255,69,69,0.08)] px-4 py-3 text-[0.8rem] text-[var(--red)]">
                  {buildError}
                </p>
              )}
              {building && (
                <p className="mt-3 text-[0.78rem] text-[var(--text3)]">
                  Reescrevendo as perguntas e montando a nova versão. Leva alguns instantes.
                </p>
              )}
            </section>
          )}

          {/* ressalvas */}
          {a.ressalvas?.length > 0 && (
            <section className="dash-in rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <span className="lbl">O que estes dados não permitem concluir</span>
              <ul className="mt-3 flex flex-col gap-2">
                {a.ressalvas.map((r, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-[0.8rem] leading-relaxed text-[var(--text2)]"
                  >
                    <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-[var(--text3)]" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mono px-1 text-[0.6rem] uppercase tracking-wider text-[var(--text3)]">
            Amostra: {insight!.sample.views} visualizações · {insight!.sample.completes} respostas ·{" "}
            {insight!.sample.periodDays} dias
            {insight!.model ? ` · ${insight!.model}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center">
      <p className="text-[0.95rem] font-bold text-[var(--text)]">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-[0.82rem] leading-relaxed text-[var(--text2)]">
        {body}
      </p>
    </div>
  );
}
