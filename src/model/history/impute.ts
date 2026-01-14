import type { CityBaseState, Year } from "../methodology";
import type { CityId } from "../regions";
import type { CityHistoryMeta, CityHistorySeries, HistoryBundle, HistoryField } from "./types";

function avgLogGrowth(xs: Array<number | null>): number | null {
  const diffs: number[] = [];
  let prev: number | null = null;
  for (const v of xs) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      if (prev != null && prev > 0) diffs.push(Math.log(v / prev));
      prev = v;
    }
  }
  if (diffs.length < 2) return null;
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

function fillLogInterpolation(xs: Array<number | null>, fallbackLogGrowth: number, mark: boolean[]): Array<number | null> {
  const n = xs.length;
  const out = xs.slice();

  // Find known indices
  const known: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = out[i];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) known.push(i);
  }
  if (known.length === 0) return out;

  // Interpolate gaps between known points
  for (let k = 0; k < known.length - 1; k++) {
    const a = known[k];
    const b = known[k + 1];
    const va = out[a] as number;
    const vb = out[b] as number;
    const span = b - a;
    if (span <= 1) continue;
    const la = Math.log(va);
    const lb = Math.log(vb);
    for (let i = a + 1; i < b; i++) {
      if (out[i] != null) continue;
      const t = (i - a) / span;
      out[i] = Math.exp(la + t * (lb - la));
      mark[i] = true;
    }
  }

  // Backcast before first known
  const first = known[0];
  const v0 = out[first] as number;
  for (let i = first - 1; i >= 0; i--) {
    if (out[i] != null) continue;
    out[i] = v0 * Math.exp(-fallbackLogGrowth * (first - i));
    mark[i] = true;
  }

  // Forward-cast after last known
  const last = known[known.length - 1];
  const vl = out[last] as number;
  for (let i = last + 1; i < n; i++) {
    if (out[i] != null) continue;
    out[i] = vl * Math.exp(fallbackLogGrowth * (i - last));
    mark[i] = true;
  }

  return out;
}

function imputeField(opts: {
  field: HistoryField;
  years: Year[];
  series: CityHistorySeries;
  base: CityBaseState;
  meta: CityHistoryMeta;
}): void {
  const { field, years, series, base, meta } = opts;
  const arr = (series as any)[field] as Array<number | null> | undefined;
  if (!arr) return;

  const mark: boolean[] = years.map(() => false);
  const g = avgLogGrowth(arr);

  // Conservative fallback rates, annual log growth.
  const fallback = (() => {
    if (field === "medianAnnualWage") return Math.log(1 + (base.wageGrowthRate ?? 0.03));
    if (field === "population") return Math.log(1 + Math.max(0, base.naturalPopGrowthRate ?? 0.005));
    if (field === "dwellingStock") return Math.log(1 + 0.01);
    if (field === "medianAnnualRent") return Math.log(1 + 0.035);
    return Math.log(1 + 0.04); // price
  })();

  const filled = fillLogInterpolation(arr, g ?? fallback, mark);
  (series as any)[field] = filled;

  const anyImputed = mark.some(Boolean);
  if (anyImputed) {
    meta.imputedFields[field] = true;
    meta.imputedShare[field] = mark.filter(Boolean).length / Math.max(1, mark.length);
    meta.notes.push(`${field}: imputed/interpolated missing years (share ${(meta.imputedShare[field] * 100).toFixed(0)}%).`);
  }

  // If entire series was missing, warn.
  const origKnown = arr.filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0).length;
  if (origKnown === 0) meta.warnings.push(`${field}: no observations provided; series fully imputed from conservative trend.`);
}

function imputeRentFromPriceYield(opts: {
  years: Year[];
  series: CityHistorySeries;
  base: CityBaseState;
  meta: CityHistoryMeta;
}) {
  const r = opts.series.medianAnnualRent;
  const p = opts.series.medianPrice;
  if (!r || !p) return;

  const knownR = r.some((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (knownR) return;

  // Use baseline annual rent yield proxy at year0 if possible.
  const yield0 = opts.base.medianAnnualRent / Math.max(1, opts.base.medianPrice);
  const mark: boolean[] = opts.years.map(() => false);
  for (let i = 0; i < opts.years.length; i++) {
    const pv = p[i];
    if (typeof pv === "number" && Number.isFinite(pv) && pv > 0) {
      r[i] = pv * yield0;
      mark[i] = true;
    }
  }
  if (mark.some(Boolean)) {
    opts.meta.imputedFields.medianAnnualRent = true;
    opts.meta.imputedShare.medianAnnualRent = mark.filter(Boolean).length / mark.length;
    opts.meta.warnings.push("medianAnnualRent: fully imputed from price × baseline yield (proxy).");
  }
}

export function imputeHistoryBundle(opts: { bundle: HistoryBundle; cities: CityBaseState[] }): HistoryBundle {
  const { bundle, cities } = opts;
  const cityById = new Map<CityId, CityBaseState>();
  cities.forEach((c) => cityById.set(c.cityId, c));

  // Clone defensively (strip prototypes) and avoid mutating the input bundle.
  const next: HistoryBundle = (() => {
    try {
      if (typeof structuredClone === "function") return (structuredClone as typeof globalThis.structuredClone)(bundle);
    } catch {
      // ignore
    }
    return JSON.parse(JSON.stringify(bundle)) as HistoryBundle;
  })();
  next.meta.notes = next.meta.notes.slice();
  next.meta.warnings = next.meta.warnings.slice();

  Object.entries(next.byCity).forEach(([k, s]) => {
    const cityId = k as CityId;
    const base = cityById.get(cityId);
    if (!base || !s) return;

    const meta = next.meta.byCity[cityId];
    if (!meta) return;

    const years = s.years;

    // Ensure arrays exist if partially provided but empty.
    (["medianPrice", "medianAnnualRent", "medianAnnualWage", "population", "dwellingStock"] as const).forEach((f) => {
      const v = (s as any)[f];
      if (v && v.length !== years.length) {
        meta.warnings.push(`${f}: length mismatch vs years; will align by index and impute missing.`);
        (s as any)[f] = years.map((_, i) => (v[i] == null ? null : v[i]));
      }
    });

    // If rent is completely missing but price exists, create rent from yield before further imputation.
    imputeRentFromPriceYield({ years, series: s, base, meta });

    (["medianPrice", "medianAnnualRent", "medianAnnualWage", "population", "dwellingStock"] as HistoryField[]).forEach((f) =>
      imputeField({ field: f, years, series: s, base, meta })
    );
  });

  // Aggregate bundle-level warnings.
  const missingCities = cities
    .map((c) => c.cityId)
    .filter((id) => !bundle.byCity[id] || Object.keys(bundle.byCity[id] ?? {}).length === 1); // just years
  if (missingCities.length > 0) {
    next.meta.warnings.push(
      `No raw history provided for ${missingCities.length}/${cities.length} cities. Their series are imputed from conservative trends.`
    );
  }

  next.meta.notes.push("Imputation completed (conservative, explicitly flagged).");
  return next;
}

