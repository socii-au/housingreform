import type { CityId } from "../regions";
import type { CityBaseState, Year } from "../methodology";
import type { BuildHistoryBundleOptions, CityHistoryMeta, CityHistorySeries, HistoryBundle, HistoryField } from "./types";

function clampYear(y: number): Year {
  return Math.max(1800, Math.min(2600, Math.round(y))) as Year;
}

function makeYearRange(startYear: Year, endYear: Year): Year[] {
  const ys: Year[] = [];
  for (let y = startYear; y <= endYear; y++) ys.push(y as Year);
  return ys;
}

function indexByYear(years: Year[]): Map<Year, number> {
  const m = new Map<Year, number>();
  years.forEach((y, i) => m.set(y, i));
  return m;
}

function alignSeriesToYears(opts: {
  targetYears: Year[];
  input?: Partial<CityHistorySeries>;
}): CityHistorySeries {
  const { targetYears, input } = opts;
  const out: CityHistorySeries = { years: targetYears };
  if (!input || !input.years || input.years.length === 0) return out;

  const srcYears = input.years.map(clampYear);
  const srcIdx = indexByYear(srcYears as Year[]);
  const getAligned = (field?: Array<number | null>): Array<number | null> | undefined => {
    if (!field) return undefined;
    const aligned: Array<number | null> = targetYears.map(() => null);
    targetYears.forEach((y, i) => {
      const j = srcIdx.get(y);
      if (j == null) return;
      const v = field[j];
      aligned[i] = v == null ? null : Number.isFinite(v) ? v : null;
    });
    return aligned;
  };

  out.medianPrice = getAligned(input.medianPrice);
  out.medianAnnualRent = getAligned(input.medianAnnualRent);
  out.medianAnnualWage = getAligned(input.medianAnnualWage);
  out.population = getAligned(input.population);
  out.dwellingStock = getAligned(input.dwellingStock);
  return out;
}

function warnIfUnitScaleLooksWrong(opts: {
  field: HistoryField;
  values?: Array<number | null>;
  warnings: string[];
}) {
  const { field, values, warnings } = opts;
  if (!values) return;
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (xs.length < 5) return;
  const sorted = xs.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];

  // Very loose heuristics: enough to catch weekly/monthly wages mistakenly passed as annual.
  if (field === "medianAnnualWage") {
    if (med < 8_000) warnings.push(`History wages median looks too low (${Math.round(med)}). Ensure gross annual AUD.`);
    if (med > 400_000) warnings.push(`History wages median looks very high (${Math.round(med)}). Verify units (annual AUD).`);
  }
  if (field === "medianAnnualRent") {
    if (med < 5_000) warnings.push(`History rents median looks too low (${Math.round(med)}). Ensure annual rent (weekly*52).`);
    if (med > 150_000) warnings.push(`History rents median looks very high (${Math.round(med)}). Verify units (annual AUD).`);
  }
}

export function buildHistoryBundle(opts: BuildHistoryBundleOptions): HistoryBundle {
  const startYear = (opts.startYear ?? 2000) as Year;
  const endYear = opts.endYear;
  const targetYears = makeYearRange(startYear, endYear);

  const notes: string[] = [];
  const warnings: string[] = [];
  const byCity: Partial<Record<CityId, CityHistorySeries>> = {};
  const metaByCity: Partial<Record<CityId, CityHistoryMeta>> = {};

  opts.cities.forEach((c) => {
    const raw = opts.rawByCity[c.cityId];
    const aligned = alignSeriesToYears({ targetYears, input: raw ? { ...raw } : undefined });

    const cityWarnings: string[] = [];
    (["medianPrice", "medianAnnualRent", "medianAnnualWage", "population", "dwellingStock"] as const).forEach((f) =>
      warnIfUnitScaleLooksWrong({ field: f, values: (aligned as any)[f], warnings: cityWarnings })
    );

    byCity[c.cityId] = aligned;
    metaByCity[c.cityId] = {
      cityId: c.cityId,
      imputedFields: {},
      imputedShare: {},
      notes: raw ? ["Aligned history to common year range."] : ["No raw history provided for this city."],
      warnings: cityWarnings,
    };
  });

  if (Object.keys(opts.rawByCity).length === 0) {
    warnings.push("No raw historical series provided (rawByCity empty).");
  }

  notes.push(`History bundle aligned to ${startYear}–${endYear} across ${opts.cities.length} cities.`);

  return {
    startYear,
    endYear,
    byCity,
    meta: {
      notes,
      warnings,
      byCity: metaByCity,
    },
  };
}

