import type { CityBaseState, Year } from "../methodology";
import type { CityId, StateId } from "../regions";
import { cityMeta } from "../regions";
import { buildHistoryBundle } from "./importers";
import { imputeHistoryBundle } from "./impute";
import type { HistoryBundle } from "./types";

type GrowthProfile = Record<number, number>;

const PRICE_GROWTH: GrowthProfile = {
  2000: 0.08,
  2001: 0.12,
  2002: 0.12,
  2003: 0.08,
  2004: 0.03,
  2005: 0.04,
  2006: 0.03,
  2007: 0.02,
  2008: -0.05,
  2009: 0.05,
  2010: 0.04,
  2011: -0.02,
  2012: -0.02,
  2013: 0.03,
  2014: 0.06,
  2015: 0.08,
  2016: 0.06,
  2017: 0.04,
  2018: -0.04,
  2019: 0.03,
  2020: 0.08,
  2021: 0.18,
  2022: -0.08,
  2023: 0.05,
  2024: 0.07,
};

const RENT_GROWTH: GrowthProfile = {
  2000: 0.03,
  2001: 0.03,
  2002: 0.04,
  2003: 0.04,
  2004: 0.03,
  2005: 0.03,
  2006: 0.03,
  2007: 0.03,
  2008: 0.01,
  2009: 0.02,
  2010: 0.03,
  2011: 0.03,
  2012: 0.02,
  2013: 0.02,
  2014: 0.03,
  2015: 0.03,
  2016: 0.03,
  2017: 0.02,
  2018: 0.02,
  2019: 0.01,
  2020: 0.0,
  2021: 0.04,
  2022: 0.09,
  2023: 0.08,
  2024: 0.06,
};

const WAGE_GROWTH: GrowthProfile = {
  2000: 0.035,
  2001: 0.035,
  2002: 0.04,
  2003: 0.04,
  2004: 0.035,
  2005: 0.035,
  2006: 0.035,
  2007: 0.035,
  2008: 0.02,
  2009: 0.02,
  2010: 0.025,
  2011: 0.025,
  2012: 0.02,
  2013: 0.02,
  2014: 0.02,
  2015: 0.022,
  2016: 0.022,
  2017: 0.025,
  2018: 0.025,
  2019: 0.025,
  2020: 0.01,
  2021: 0.02,
  2022: 0.03,
  2023: 0.04,
  2024: 0.035,
};

const STATE_PRICE_FACTOR: Record<StateId, number> = {
  NSW: 1.05,
  VIC: 1.04,
  QLD: 1.02,
  WA: 1.07,
  SA: 1.0,
  TAS: 1.06,
  ACT: 1.03,
  NT: 1.08,
};

const STATE_RENT_FACTOR: Record<StateId, number> = {
  NSW: 1.02,
  VIC: 1.01,
  QLD: 1.03,
  WA: 1.02,
  SA: 1.0,
  TAS: 1.02,
  ACT: 1.01,
  NT: 1.03,
};

const STATE_WAGE_FACTOR: Record<StateId, number> = {
  NSW: 1.01,
  VIC: 1.0,
  QLD: 1.0,
  WA: 1.02,
  SA: 0.99,
  TAS: 0.99,
  ACT: 1.02,
  NT: 1.02,
};

function yearRange(startYear: number, endYear: number): Year[] {
  const ys: Year[] = [];
  for (let y = startYear; y <= endYear; y++) ys.push(y as Year);
  return ys;
}

function growthForYear(profile: GrowthProfile, year: number): number {
  return typeof profile[year] === "number" ? profile[year] : profile[2024] ?? 0.03;
}

function applyMiningCycle(state: StateId, year: number, growth: number): number {
  if (state !== "WA" && state !== "NT") return growth;
  if (year >= 2004 && year <= 2012) return growth + 0.02;
  if (year >= 2013 && year <= 2016) return growth - 0.02;
  return growth;
}

function buildIndex(opts: {
  years: Year[];
  profile: GrowthProfile;
  factor: number;
  capitalBoost?: number;
  state: StateId;
}): number[] {
  const { years, profile, factor, capitalBoost = 0, state } = opts;
  const values: number[] = [];
  let idx = 1;
  years.forEach((y) => {
    const base = growthForYear(profile, y);
    const g0 = applyMiningCycle(state, y, base) * factor + capitalBoost;
    idx *= 1 + g0;
    values.push(idx);
  });
  const last = values[values.length - 1] || 1;
  return values.map((v) => v / last);
}

function backcastPopulation(opts: { years: Year[]; base: CityBaseState }): Array<number | null> {
  const { years, base } = opts;
  const out = new Array<number>(years.length);
  const endIdx = years.length - 1;
  out[endIdx] = base.population;
  for (let i = endIdx - 1; i >= 0; i--) {
    const next = out[i + 1] ?? base.population;
    const grown = next / (1 + base.naturalPopGrowthRate);
    out[i] = Math.max(0, grown - base.netMigrationPerYear);
  }
  return out;
}

function backcastStock(opts: { years: Year[]; base: CityBaseState }): Array<number | null> {
  const { years, base } = opts;
  const out = new Array<number>(years.length);
  const endIdx = years.length - 1;
  out[endIdx] = base.dwellingStock;
  for (let i = endIdx - 1; i >= 0; i--) {
    const next = out[i + 1] ?? base.dwellingStock;
    const kept = next / (1 - base.demolitionRate);
    out[i] = Math.max(0, kept - base.annualCompletions);
  }
  return out;
}

function buildCitySeries(opts: { years: Year[]; base: CityBaseState }) {
  const { years, base } = opts;
  const meta = cityMeta(base.cityId as CityId);
  const state = meta.state;
  const capitalBoost = meta.isCapital ? 0.01 : -0.005;

  const priceIdx = buildIndex({
    years,
    profile: PRICE_GROWTH,
    factor: STATE_PRICE_FACTOR[state] ?? 1,
    capitalBoost,
    state,
  });
  const rentIdx = buildIndex({
    years,
    profile: RENT_GROWTH,
    factor: STATE_RENT_FACTOR[state] ?? 1,
    capitalBoost: meta.isCapital ? 0.002 : 0,
    state,
  });
  const wageIdx = buildIndex({
    years,
    profile: WAGE_GROWTH,
    factor: STATE_WAGE_FACTOR[state] ?? 1,
    capitalBoost: meta.isCapital ? 0.001 : 0,
    state,
  });

  return {
    years,
    medianPrice: priceIdx.map((v) => Math.round(base.medianPrice * v)),
    medianAnnualRent: rentIdx.map((v) => Math.round(base.medianAnnualRent * v)),
    medianAnnualWage: wageIdx.map((v) => Math.round(base.medianAnnualWage * v)),
    population: backcastPopulation({ years, base }),
    dwellingStock: backcastStock({ years, base }),
  };
}

export function buildSyntheticHistoryBundle(opts: {
  cities: CityBaseState[];
  startYear?: number;
  endYear?: number;
}): HistoryBundle {
  const endYear = (opts.endYear ?? Math.max(...opts.cities.map((c) => c.year0))) as Year;
  const startYear = (opts.startYear ?? 2000) as Year;
  const years = yearRange(startYear, endYear);
  const rawByCity: Partial<Record<CityId, any>> = {};

  opts.cities.forEach((c) => {
    rawByCity[c.cityId as CityId] = buildCitySeries({ years, base: c });
  });

  const bundle = buildHistoryBundle({
    startYear,
    endYear,
    cities: opts.cities,
    rawByCity,
  });

  const imputed = imputeHistoryBundle({ bundle, cities: opts.cities });
  imputed.meta.notes.push(
    "Synthetic history built from city baselines and coarse ABS-aligned growth profiles (no direct city-level price series)."
  );
  Object.values(imputed.meta.byCity).forEach((meta) => {
    meta?.notes?.push("Synthetic series (coarse indices + baseline anchoring).");
  });
  return imputed;
}
