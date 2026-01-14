import type { CityBaseState, CoreConstants, Year } from "../methodology";
import type { CityId, Scope, StateId } from "../regions";
import type { RegionScenarioOutputs, RegionYearState, ScenarioOutputs } from "../runScenario";
import { computeStampDutyRevenue } from "../methodology";
import { cityMeta, scopeKey } from "../regions";
import type { HistoryBundle, TimelinePoint } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function pickBaseYear(opts: {
  indexBase: "history" | "year0";
  history?: TimelinePoint[];
  projected?: RegionYearState[];
  year0: Year;
}): Year {
  if (opts.indexBase === "year0") return opts.year0;
  const h0 = opts.history?.[0]?.year;
  if (h0 != null) return h0 as Year;
  const p0 = opts.projected?.[0]?.year;
  return (p0 ?? opts.year0) as Year;
}

function valueAtYear(points: Array<{ year: Year; value?: number }>, year: Year): number | null {
  const p = points.find((x) => x.year === year);
  return typeof p?.value === "number" && Number.isFinite(p.value) ? p.value : null;
}

function toTimelineHistoricalCity(opts: {
  city: CityBaseState;
  history: HistoryBundle;
  c: CoreConstants;
  stampDutyRate: number;
}): TimelinePoint[] {
  const s = opts.history.byCity[opts.city.cityId];
  if (!s) return [];
  const n = s.years.length;
  const out: TimelinePoint[] = [];
  for (let i = 0; i < n; i++) {
    const medianPrice = s.medianPrice?.[i] ?? null;
    const dwellingStock = s.dwellingStock?.[i] ?? null;
    const stampDutyRevenue =
      typeof medianPrice === "number" && typeof dwellingStock === "number"
        ? computeStampDutyRevenue({
            medianPrice,
            dwellingStock,
            annualTurnoverRate: opts.c.annualTurnoverRate,
            stampDutyRate: opts.stampDutyRate,
          })
        : undefined;
    out.push({
      year: s.years[i],
      kind: "historical",
      medianPrice: typeof medianPrice === "number" ? medianPrice : undefined,
      medianAnnualRent:
        typeof s.medianAnnualRent?.[i] === "number" ? (s.medianAnnualRent[i] as number) : undefined,
      medianAnnualWage:
        typeof s.medianAnnualWage?.[i] === "number" ? (s.medianAnnualWage[i] as number) : undefined,
      population: typeof s.population?.[i] === "number" ? (s.population[i] as number) : undefined,
      dwellingStock: typeof dwellingStock === "number" ? dwellingStock : undefined,
      stampDutyRevenue,
    });
  }
  return out;
}

function aggregateHistorical(opts: {
  scope: Scope;
  cities: CityBaseState[];
  history: HistoryBundle;
  c: CoreConstants;
  stampDutyRate: number;
}): TimelinePoint[] {
  const included = (() => {
    if (opts.scope.level === "national") return opts.cities;
    if (opts.scope.level === "city") {
      const cityScope = opts.scope as { level: "city"; city: CityId };
      return opts.cities.filter((c) => c.cityId === cityScope.city);
    }
    // opts.scope.level === "state"
    const stateScope = opts.scope as { level: "state"; state: StateId };
    return opts.cities.filter((c) => cityMeta(c.cityId).state === stateScope.state);
  })();

  if (included.length === 0) return [];

  const years = opts.history.startYear <= opts.history.endYear
    ? (Array.from({ length: opts.history.endYear - opts.history.startYear + 1 }, (_, i) => (opts.history.startYear + i) as Year))
    : [];

  // Weight by population where available; fallback to baseline city population weights.
  const fallbackPop: Record<CityId, number> = {} as any;
  included.forEach((c) => (fallbackPop[c.cityId] = c.population));

  const out: TimelinePoint[] = [];
  years.forEach((y) => {
    const parts = included.map((c) => {
      const s = opts.history.byCity[c.cityId];
      if (!s) return null;
      const idx = s.years.indexOf(y);
      if (idx < 0) return null;
      return {
        cityId: c.cityId,
        medianPrice: s.medianPrice?.[idx] ?? null,
        medianAnnualRent: s.medianAnnualRent?.[idx] ?? null,
        medianAnnualWage: s.medianAnnualWage?.[idx] ?? null,
        population: s.population?.[idx] ?? null,
        dwellingStock: s.dwellingStock?.[idx] ?? null,
      };
    }).filter(Boolean) as Array<{
      cityId: CityId;
      medianPrice: number | null;
      medianAnnualRent: number | null;
      medianAnnualWage: number | null;
      population: number | null;
      dwellingStock: number | null;
    }>;

    if (parts.length === 0) return;

    const popWeights = parts.map((p) => (typeof p.population === "number" ? p.population : fallbackPop[p.cityId] ?? 0));
    const wSum = popWeights.reduce((a, b) => a + b, 0) || 1;
    const w = popWeights.map((x) => x / wSum);

    const wAvg = (xs: Array<number | null>): number | undefined => {
      let s = 0;
      let ws = 0;
      xs.forEach((v, i) => {
        if (typeof v === "number" && Number.isFinite(v)) {
          s += w[i] * v;
          ws += w[i];
        }
      });
      if (ws <= 0) return undefined;
      return s / ws;
    };

    const pop = wAvg(parts.map((p) => p.population)) ?? popWeights.reduce((a, b) => a + b, 0);
    const stock = wAvg(parts.map((p) => p.dwellingStock));
    const price = wAvg(parts.map((p) => p.medianPrice));
    const rent = wAvg(parts.map((p) => p.medianAnnualRent));
    const wage = wAvg(parts.map((p) => p.medianAnnualWage));

    const stampDutyRevenue =
      typeof price === "number" && typeof stock === "number"
        ? computeStampDutyRevenue({
            medianPrice: price,
            dwellingStock: stock,
            annualTurnoverRate: opts.c.annualTurnoverRate,
            stampDutyRate: opts.stampDutyRate,
          })
        : undefined;

    out.push({
      year: y,
      kind: "historical",
      population: pop,
      dwellingStock: stock,
      medianPrice: price,
      medianAnnualRent: rent,
      medianAnnualWage: wage,
      stampDutyRevenue,
    });
  });

  return out;
}

export function buildRegionTimeline(opts: {
  outputs: ScenarioOutputs;
  scope: Scope;
  historyBundle?: HistoryBundle;
  cities: CityBaseState[];
  c: CoreConstants;
  stampDutyRate: number;
  year0: Year;
  indexBase: "history" | "year0";
}): {
  id: string;
  scope: Scope;
  cutoverYear: Year;
  timeline: TimelinePoint[];
  meta: { notes: string[]; warnings: string[]; historyAvailable: boolean };
} {
  const region = opts.outputs.byRegion[scopeKey(opts.scope)];
  const projected = region?.years ?? [];
  const historyAvailable = !!opts.historyBundle;

  const history = opts.historyBundle
    ? aggregateHistorical({
        scope: opts.scope,
        cities: opts.cities,
        history: opts.historyBundle,
        c: opts.c,
        stampDutyRate: opts.stampDutyRate,
      })
    : [];

  const baseYear = pickBaseYear({
    indexBase: opts.indexBase,
    history,
    projected,
    year0: opts.year0,
  });

  const basePrice = valueAtYear(
    (history.length ? history : projected).map((p: any) => ({ year: p.year, value: p.medianPrice })),
    baseYear
  );
  const baseRent = valueAtYear(
    (history.length ? history : projected).map((p: any) => ({ year: p.year, value: p.medianAnnualRent })),
    baseYear
  );
  const baseWage = valueAtYear(
    (history.length ? history : projected).map((p: any) => ({ year: p.year, value: p.medianAnnualWage })),
    baseYear
  );

  const idx = (v?: number, base?: number | null) =>
    typeof v === "number" && typeof base === "number" && base > 0 ? (v / base) * 100 : undefined;

  const historicalWithIndex: TimelinePoint[] = history.map((p) => ({
    ...p,
    priceIndex: idx(p.medianPrice, basePrice),
    rentIndex: idx(p.medianAnnualRent, baseRent),
    wageIndex: idx(p.medianAnnualWage, baseWage),
  }));

  const projectedWithKind: TimelinePoint[] = projected.map((p) => ({
    year: p.year,
    kind: "projected",
    population: p.population,
    dwellingStock: p.dwellingStock,
    medianPrice: p.medianPrice,
    medianAnnualRent: p.medianAnnualRent,
    medianAnnualWage: p.medianAnnualWage,
    stampDutyRevenue: p.stampDutyRevenue,
    priceIndex: idx(p.medianPrice, basePrice),
    rentIndex: idx(p.medianAnnualRent, baseRent),
    wageIndex: idx(p.medianAnnualWage, baseWage),
  }));

  // Join, avoiding duplicate year0 if history ends at year0.
  const cutoverYear = opts.year0;
  const histYears = new Set(historicalWithIndex.map((p) => p.year));
  const joined = [
    ...historicalWithIndex,
    ...projectedWithKind.filter((p) => !histYears.has(p.year)),
  ].sort((a, b) => a.year - b.year);

  const metaWarnings: string[] = [];
  if (!historyAvailable) metaWarnings.push("No historical series attached. Showing projections only.");
  if (historyAvailable && historicalWithIndex.length === 0) metaWarnings.push("History bundle attached, but no usable points for this scope.");

  return {
    id: scopeKey(opts.scope),
    scope: opts.scope,
    cutoverYear,
    timeline: joined,
    meta: {
      notes: [],
      warnings: metaWarnings,
      historyAvailable,
    },
  };
}

