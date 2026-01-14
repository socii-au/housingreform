import type { CityId } from "../regions";
import type { Year } from "../methodology";

export interface HistoricalSeries {
  years: Year[];
  medianPrice?: number[];
  medianAnnualRent?: number[];
  medianAnnualWage?: number[];
  population?: number[];
  dwellingStock?: number[];
}

export interface ParamBound {
  min: number;
  max: number;
}

export interface FitResult {
  param: string;
  best: number;
  rmse: number;
  tried: number;
}

function rmse(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return Number.POSITIVE_INFINITY;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s / n);
}

/**
 * Very simple bounded 1D grid-search fitter.
 * Intended as a scaffolding to plug into proper estimation later.
 */
export function fit1DGrid(opts: {
  param: string;
  bound: ParamBound;
  gridN?: number;
  simulate: (p: number) => number[];
  target: number[];
}): FitResult {
  const { param, bound, simulate, target } = opts;
  const gridN = Math.max(10, Math.floor(opts.gridN ?? 60));
  const lo = bound.min;
  const hi = bound.max;
  let best = lo;
  let bestRmse = Number.POSITIVE_INFINITY;
  let tried = 0;

  for (let i = 0; i < gridN; i++) {
    const p = lo + (i / (gridN - 1)) * (hi - lo);
    const sim = simulate(p);
    const e = rmse(sim, target);
    tried++;
    if (e < bestRmse) {
      bestRmse = e;
      best = p;
    }
  }

  return { param, best, rmse: bestRmse, tried };
}

export function validateSeriesLengths(series: HistoricalSeries): string[] {
  const errs: string[] = [];
  const n = series.years.length;
  ([
    ["medianPrice", series.medianPrice],
    ["medianAnnualRent", series.medianAnnualRent],
    ["medianAnnualWage", series.medianAnnualWage],
    ["population", series.population],
    ["dwellingStock", series.dwellingStock],
  ] as const).forEach(([k, v]) => {
    if (v && v.length !== n) errs.push(`${k} length (${v.length}) != years length (${n})`);
  });
  return errs;
}

/**
 * Placeholder multi-city calibration entrypoint.
 * Today: just validates shapes; you plug real data + choose which params to fit.
 */
export function validateCalibrationInputs(opts: {
  historyByCity: Partial<Record<CityId, HistoricalSeries>>;
}): Record<CityId, string[]> {
  const out: Record<CityId, string[]> = {} as Record<CityId, string[]>;
  Object.entries(opts.historyByCity).forEach(([k, v]) => {
    const city = k as CityId;
    if (!v) return;
    out[city] = validateSeriesLengths(v);
  });
  return out;
}

