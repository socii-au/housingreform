import { useMemo, useState } from "react";
import type { CityId, StateId } from "../model/regions";
import { ALL_STATES, STATE_NAMES, cityMeta } from "../model/regions";
import type { ScenarioOutputs } from "../model/runScenario";
import type { ScenarioParams } from "../model/methodology";
import { computeCrisisScore, crisisColor } from "../model/crisisScore";
import type { HistoryBundle } from "../model/history/types";
import {
  AU_CITY_CATCHMENTS_GEOJSON,
  AU_STATE_SUBREGIONS_GEOJSON,
  AU_STATES_GEOJSON,
  SUBREGION_ANCHOR_BIAS,
  SUBREGION_WEIGHTS,
  polygonToPath,
} from "./maps/auGeo";

type CityPoint = {
  cityId: CityId;
  x: number;
  y: number;
  // A rough “catchment” radius in map units (not geo-accurate). Larger for capitals.
  r: number;
};

const VIEW = { w: 1000, h: 760 };

// City markers (hand-tuned, approximate).
const CITY_POINTS: CityPoint[] = [
  { cityId: "PER", x: 220, y: 320, r: 78 },
  { cityId: "BUN", x: 260, y: 440, r: 42 },
  { cityId: "KAL", x: 320, y: 420, r: 34 },

  { cityId: "ADL", x: 515, y: 475, r: 64 },
  { cityId: "MTG", x: 560, y: 560, r: 28 },

  { cityId: "DRW", x: 510, y: 200, r: 50 },
  { cityId: "ASP", x: 520, y: 280, r: 32 },

  { cityId: "CBR", x: 820, y: 560, r: 34 },
  { cityId: "SYD", x: 860, y: 520, r: 78 },
  { cityId: "NCL", x: 885, y: 485, r: 36 },
  { cityId: "WOL", x: 845, y: 555, r: 34 },
  { cityId: "CCS", x: 870, y: 500, r: 32 },
  { cityId: "ALW", x: 760, y: 595, r: 36 },
  { cityId: "WGA", x: 700, y: 575, r: 28 },

  { cityId: "MEL", x: 770, y: 650, r: 78 },
  { cityId: "GEL", x: 740, y: 670, r: 34 },
  { cityId: "BEN", x: 720, y: 625, r: 34 },
  { cityId: "BAL", x: 740, y: 640, r: 34 },
  { cityId: "SHP", x: 700, y: 615, r: 28 },

  { cityId: "HBA", x: 820, y: 725, r: 44 },
  { cityId: "LST", x: 800, y: 705, r: 32 },

  { cityId: "BNE", x: 820, y: 360, r: 70 },
  { cityId: "GC", x: 850, y: 395, r: 42 },
  { cityId: "SC", x: 800, y: 325, r: 42 },
  { cityId: "TWB", x: 780, y: 385, r: 34 },
  { cityId: "ROP", x: 770, y: 265, r: 34 },
  { cityId: "MKY", x: 810, y: 245, r: 36 },
  { cityId: "GLA", x: 780, y: 290, r: 30 },
  { cityId: "BDG", x: 795, y: 335, r: 28 },
  { cityId: "HVB", x: 815, y: 345, r: 28 },
  { cityId: "TSV", x: 850, y: 220, r: 42 },
  { cityId: "CNS", x: 890, y: 180, r: 38 },
];

function fmtPct(x: number): string {
  return (x * 100).toFixed(0) + "%";
}

function fmt1(x: number): string {
  return x.toFixed(1);
}

function alphaColor(hex: string, a: number): string {
  // hex "#rrggbb"
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getCityYearSnapshot(opts: {
  cityId: CityId;
  year: number;
  outputs: ScenarioOutputs;
  params: ScenarioParams;
  historyBundle?: HistoryBundle;
}): { medianPrice?: number; medianAnnualRent?: number; medianAnnualWage?: number } | null {
  const { cityId, year, outputs, params, historyBundle } = opts;
  const base = params.cities.find((c) => c.cityId === cityId);
  const year0 = base?.year0;

  // Historical
  if (historyBundle && typeof year0 === "number" && year < year0) {
    const h = historyBundle.byCity?.[cityId];
    if (!h) return null;
    const idx = h.years.indexOf(year as any);
    if (idx < 0) return null;
    const p = h.medianPrice?.[idx];
    const r = h.medianAnnualRent?.[idx];
    const w = h.medianAnnualWage?.[idx];
    return {
      medianPrice: typeof p === "number" ? p : undefined,
      medianAnnualRent: typeof r === "number" ? r : undefined,
      medianAnnualWage: typeof w === "number" ? w : undefined,
    };
  }

  // Projected (includes baseline year0 and forward)
  const cityOut = outputs.byCity?.[cityId];
  if (!cityOut) return null;
  const row = cityOut.years.find((y) => y.year === (year as any));
  if (!row) return null;
  return {
    medianPrice: row.medianPrice,
    medianAnnualRent: row.medianAnnualRent,
    medianAnnualWage: row.medianAnnualWage,
  };
}

function aggregateStateScore(opts: {
  state: StateId;
  year: number;
  outputs: ScenarioOutputs;
  params: ScenarioParams;
  historyBundle?: HistoryBundle;
}): number | null {
  const cities = opts.params.cities
    .map((c) => c.cityId)
    .filter((id) => cityMeta(id).state === opts.state);
  if (cities.length === 0) return null;
  const scores: Array<{ s: number; w: number }> = [];
  cities.forEach((cityId) => {
    const snap = getCityYearSnapshot({
      cityId,
      year: opts.year,
      outputs: opts.outputs,
      params: opts.params,
      historyBundle: opts.historyBundle,
    });
    if (!snap) return;
    const detail = computeCrisisScore(snap);
    if (!detail) return;
    const pop = opts.params.cities.find((c) => c.cityId === cityId)?.population ?? 1;
    scores.push({ s: detail.score01, w: pop });
  });
  if (scores.length === 0) return null;
  const wSum = scores.reduce((a, b) => a + b.w, 0) || 1;
  return scores.reduce((a, b) => a + (b.w / wSum) * b.s, 0);
}

export function AustraliaCrisisMap(props: {
  outputs: ScenarioOutputs;
  params: ScenarioParams;
  year: number;
  historyBundle?: HistoryBundle;
  title?: string;
}) {
  const { outputs, params, year, historyBundle } = props;
  const [hoverCity, setHoverCity] = useState<CityId | null>(null);

  const cityScores = useMemo(() => {
    const out: Partial<Record<CityId, ReturnType<typeof computeCrisisScore>>> = {};
    params.cities.forEach((c) => {
      const snap = getCityYearSnapshot({ cityId: c.cityId, year, outputs, params, historyBundle });
      out[c.cityId] = snap ? computeCrisisScore(snap) : null;
    });
    return out;
  }, [params, year, outputs, historyBundle]);

  const stateScores = useMemo(() => {
    const out: Partial<Record<StateId, number | null>> = {};
    ALL_STATES.forEach((st) => {
      out[st] = aggregateStateScore({ state: st, year, outputs, params, historyBundle });
    });
    return out;
  }, [params, year, outputs, historyBundle]);

  const subregionScores = useMemo(() => {
    const out: Record<string, number | null> = {};
    AU_STATE_SUBREGIONS_GEOJSON.features.forEach((f) => {
      const weights = SUBREGION_WEIGHTS[f.properties.id] ?? [];
      const st = f.properties.state as StateId;

      // Baseline: synthetic anchor bias applied to the state score (independent of city availability).
      // If state score is missing, assume neutral 0.50 so the map still renders structure.
      const stateBase = stateScores[st] ?? 0.5;
      const bias = SUBREGION_ANCHOR_BIAS[f.properties.id] ?? 0;
      const anchorScore = clamp01(stateBase + bias);

      // Optional refinement: blend toward city-weighted subregion score when enough city signal exists.
      let cityScore: number | null = null;
      if (weights.length > 0) {
        let sum = 0;
        let wsum = 0;
        weights.forEach(([cityId, w]) => {
          const d = cityScores[cityId];
          if (!d) return;
          sum += d.score01 * w;
          wsum += w;
        });
        cityScore = wsum > 0 ? sum / wsum : null;
      }

      // Coverage weight: more included cities in a state -> more trust in city-based variation.
      const cityCountInState = params.cities.filter((c) => cityMeta(c.cityId).state === st).length;
      const trust = clamp01(cityCountInState / 5); // 0..1, saturates at ~5 cities

      out[f.properties.id] =
        cityScore == null ? anchorScore : clamp01(lerp(anchorScore, cityScore, trust));
    });
    return out;
  }, [cityScores, stateScores, params.cities]);

  const hoverDetail = hoverCity ? cityScores[hoverCity] : null;

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h2" style={{ marginBottom: 4 }}>{props.title ?? "National crisis heatmap"}</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Updates live when you hover across years in the charts. Scoring blends rent burden and price-to-income (shape-first).
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, alignItems: "start" }}>
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", background: "white" }}>
          <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} width="100%" height="520" role="img" aria-label="Australia crisis heatmap">
            <defs>
              {AU_STATES_GEOJSON.features.map((f) => (
                <clipPath key={f.properties.id} id={`clip-${f.properties.id}`}>
                  <path d={polygonToPath(f.geometry)} />
                </clipPath>
              ))}
            </defs>

            {/* State polygons (base fill) */}
            {AU_STATES_GEOJSON.features.map((f) => {
              const st = f.properties.id as StateId;
              const s = stateScores[st];
              const fill = s == null ? "#e5e7eb" : alphaColor(crisisColor(s), 0.14);
              return (
                <path
                  key={`st-fill-${st}`}
                  d={polygonToPath(f.geometry)}
                  fill={fill}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                />
              );
            })}

            {/* Second mesh layer: subregions (coastal/inland/remote) */}
            {AU_STATE_SUBREGIONS_GEOJSON.features.map((f) => {
              const id = f.properties.id;
              const st = f.properties.state as StateId;
              const score = subregionScores[id];
              const fill = score == null ? "rgba(148,163,184,0.12)" : alphaColor(crisisColor(score), 0.22);
              return (
                <path
                  key={`sub-${id}`}
                  d={polygonToPath(f.geometry)}
                  clipPath={`url(#clip-${st})`}
                  fill={fill}
                  stroke="rgba(15,23,42,0.08)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Precomputed catchment mesh (true choropleth cells) */}
            {AU_CITY_CATCHMENTS_GEOJSON.features.map((f) => {
              const cityId = f.properties.cityId as CityId;
              const st = f.properties.state as StateId;
              const detail = cityScores[cityId];
              const d = polygonToPath(f.geometry);
              const fill = detail ? alphaColor(crisisColor(detail.score01), 0.60) : "#e5e7eb";
              return (
                <path
                  key={`cell-${cityId}`}
                  d={d}
                  clipPath={`url(#clip-${st})`}
                  fill={fill}
                  stroke="rgba(15,23,42,0.10)"
                  strokeWidth={1}
                />
              );
            })}

            {/* State borders on top */}
            {AU_STATES_GEOJSON.features.map((f) => (
              <path
                key={`st-b-${f.properties.id}`}
                d={polygonToPath(f.geometry)}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
              />
            ))}

            {/* City centres (sharp) */}
            {CITY_POINTS.map((p) => {
              const detail = cityScores[p.cityId];
              const col = detail ? crisisColor(detail.score01) : "#94a3b8";
              const name = cityMeta(p.cityId).name;
              return (
                <g
                  key={`pt-${p.cityId}`}
                  onMouseEnter={() => setHoverCity(p.cityId)}
                  onMouseLeave={() => setHoverCity(null)}
                  style={{ cursor: "default" }}
                >
                  <circle cx={p.x} cy={p.y} r={6} fill={col} stroke="#0f172a" strokeWidth={1} />
                  <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                  <title>{name}</title>
                </g>
              );
            })}

            {/* State labels */}
            {ALL_STATES.map((st) => {
              const anchor: Record<StateId, { x: number; y: number }> = {
                WA: { x: 220, y: 210 },
                NT: { x: 505, y: 175 },
                SA: { x: 505, y: 430 },
                QLD: { x: 760, y: 190 },
                NSW: { x: 770, y: 500 },
                VIC: { x: 720, y: 660 },
                TAS: { x: 820, y: 730 },
                ACT: { x: 810, y: 560 },
              };
              const a = anchor[st];
              return (
                <text key={`lbl-${st}`} x={a.x} y={a.y} fontSize={14} fill="#0f172a" style={{ fontWeight: 900 }}>
                  {st}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="card tone-neutral" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Selected year</div>
            <div style={{ fontWeight: 900 }}>{year}</div>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Hover a city marker to see details. State shading is a population-weighted average of included cities.
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Legend</div>
            {[
              ["Low", "#16a34a"],
              ["Moderate", "#f59e0b"],
              ["Severe", "#f97316"],
              ["Extreme", "#dc2626"],
            ].map(([label, col]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}>
                <span style={{ width: 14, height: 14, background: col as string, borderRadius: 4, display: "inline-block", border: "1px solid #cbd5e1" }} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Hover details</div>
            {hoverCity && hoverDetail ? (
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 900 }}>{cityMeta(hoverCity).name}</div>
                <div className="muted">{STATE_NAMES[cityMeta(hoverCity).state]}</div>
                <div style={{ marginTop: 8 }}>
                  Crisis score: <strong>{Math.round(hoverDetail.score01 * 100)}/100</strong>
                </div>
                <div>
                  Rent burden: <strong>{fmtPct(hoverDetail.rentBurden)}</strong>
                </div>
                <div>
                  Price-to-income: <strong>{fmt1(hoverDetail.priceToIncome)}×</strong>
                </div>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                Hover a city marker on the map.
              </div>
            )}
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Note: Boundaries are a compact embedded GeoJSON schematic (state outlines + precomputed city catchment cells), intended to represent regional coverage rather than exact administrative borders.
          </div>
        </div>
      </div>
    </div>
  );
}

