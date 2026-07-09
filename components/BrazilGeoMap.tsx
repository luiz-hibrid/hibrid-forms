interface GeoSub {
  geo_uf: string | null;
  geo_city: string | null;
  geo_country: string | null;
}

const UF_NAME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

// posição [coluna, linha] de cada UF num grid estilizado do Brasil
const UF_POS: Record<string, [number, number]> = {
  RR: [2, 0], AP: [3, 0],
  AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
  AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
  MT: [2, 3], BA: [3, 3], AL: [4, 3], SE: [5, 3],
  MS: [2, 4], GO: [3, 4], DF: [4, 4],
  MG: [3, 5], ES: [4, 5],
  SP: [3, 6], RJ: [4, 6],
  PR: [2, 7], SC: [3, 7],
  RS: [2, 8],
};

const REGIONS: Record<string, string[]> = {
  Norte: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MT", "MS"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};

export function BrazilGeoMap({ submissions }: { submissions: GeoSub[] }) {
  const byUf: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  let semLocal = 0;
  for (const s of submissions) {
    const uf = (s.geo_uf || "").toUpperCase();
    if (uf && UF_POS[uf]) byUf[uf] = (byUf[uf] || 0) + 1;
    else semLocal++;
    if (s.geo_city) {
      const key = `${s.geo_city}${uf ? " · " + uf : ""}`;
      byCity[key] = (byCity[key] || 0) + 1;
    }
  }
  const max = Math.max(1, ...Object.values(byUf));
  const total = submissions.length;

  function tileColor(count: number): string {
    if (!count) return "var(--bg)";
    const a = 0.2 + 0.8 * (count / max);
    return `rgba(61,122,0,${a})`;
  }

  const topStates = Object.entries(byUf).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topCities = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const regionCounts = Object.entries(REGIONS).map(([name, ufs]) => [
    name,
    ufs.reduce((s, uf) => s + (byUf[uf] || 0), 0),
  ]) as [string, number][];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* Mapa (tile grid) + resumo por região */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div
            className="grid shrink-0"
            style={{
              gridTemplateColumns: "repeat(6, 34px)",
              gridTemplateRows: "repeat(9, 34px)",
              gap: 4,
            }}
          >
            {Object.entries(UF_POS).map(([uf, [x, y]]) => {
              const count = byUf[uf] || 0;
              const dark = count / max > 0.55;
              return (
                <div
                  key={uf}
                  title={`${UF_NAME[uf]}: ${count}`}
                  style={{
                    gridColumnStart: x + 1,
                    gridRowStart: y + 1,
                    background: tileColor(count),
                    color: dark ? "#fff" : count ? "#2f4d00" : "var(--text3)",
                  }}
                  className="flex flex-col items-center justify-center rounded-md text-[0.55rem] font-bold leading-none"
                >
                  <span>{uf}</span>
                  {count > 0 && <span className="mt-0.5 text-[0.6rem]">{count}</span>}
                </div>
              );
            })}
          </div>

          <div className="flex-1">
            <div className="lbl mb-3">Resumo por região</div>
            <div className="grid gap-1.5 text-sm">
              {regionCounts.map(([name, n]) => (
                <div key={name} className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text2)]">{name}</span>
                  <b className="text-[var(--text)]">{n}</b>
                </div>
              ))}
              {semLocal > 0 && (
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[var(--text3)]">Sem localização</span>
                  <b className="text-[var(--text3)]">{semLocal}</b>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <span className="font-bold text-[var(--text)]">Total</span>
                <b className="text-[var(--text)]">{total}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top estados + Top cidades */}
      <div className="space-y-4">
        <RankCard title="Top estados" rows={topStates.map(([uf, n]) => [UF_NAME[uf] ?? uf, n])} total={total} />
        <RankCard title="Top cidades" rows={topCities} total={total} />
      </div>
    </div>
  );
}

function RankCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: [string, number][];
  total: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="lbl mb-3">{title}</div>
      {rows.length === 0 && (
        <div className="text-sm text-[var(--text3)]">Sem dados de localização ainda.</div>
      )}
      <div className="space-y-3">
        {rows.map(([name, n]) => {
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate text-[var(--text2)]">{name}</span>
                <span className="mono shrink-0 text-[var(--text3)]">
                  {n} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg)]">
                <div className="h-full rounded-full bg-[var(--text)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
