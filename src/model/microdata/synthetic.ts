import type { CityBaseState, CoreConstants } from "../methodology";
import type { CityId } from "../regions";
import type { MicroRecord, TenureType } from "../advanced/microdata";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Simple PRNG for reproducibility (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(rng: () => number): number {
  // Box-Muller
  const u = Math.max(1e-12, rng());
  const v = Math.max(1e-12, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleTenure(rng: () => number, shares: Record<TenureType, number>): TenureType {
  const keys: TenureType[] = ["renter", "mortgaged", "outright", "investor"];
  const vals = keys.map((k) => Math.max(0, shares[k] ?? 0));
  const sum = Math.max(1e-9, vals.reduce((a, b) => a + b, 0));
  const p = vals.map((x) => x / sum);
  const u = rng();
  let acc = 0;
  for (let i = 0; i < keys.length; i++) {
    acc += p[i];
    if (u <= acc) return keys[i];
  }
  return keys[keys.length - 1];
}

/**
 * Synthetic microdata generator for when you have gaps (missing cities/tenures)
 * or want to "reinforce" sparse survey microdata.
 *
 * - Income modeled as lognormal around a city-specific median.
 * - Tenure shares are anchored to CoreConstants, with a small investor share.
 */
export function generateSyntheticMicrodataForCity(opts: {
  city: CityBaseState;
  c: CoreConstants;
  n?: number;
  seed?: number;
  /**
   * Overrides for tenure shares (must be 0..1-ish; we normalize).
   */
  tenureShares?: Partial<Record<TenureType, number>>;
  /**
   * Controls income dispersion: higher => wider tail. Typical: 0.45..0.70.
   */
  sigma?: number;
  /**
   * Multiplier converting median annual wage (individual) to median household income.
   * Typical: 1.3..1.7.
   */
  householdIncomeMultiplier?: number;
}): MicroRecord[] {
  const n = Math.max(50, Math.floor(opts.n ?? 2000));
  const rng = mulberry32(Math.floor(opts.seed ?? 12345) + hashCity(opts.city.cityId));
  const sigma = clamp(opts.sigma ?? 0.55, 0.25, 1.2);
  const hhMult = clamp(opts.householdIncomeMultiplier ?? 1.45, 0.9, 2.5);

  const medianWage = opts.city.medianAnnualWage ?? 85_000;
  const medianHouseholdIncome = Math.max(10_000, medianWage * hhMult);

  // lognormal: median = exp(mu)
  const mu = Math.log(medianHouseholdIncome);

  const defaultTenure: Record<TenureType, number> = {
    renter: clamp(opts.c.renterShare, 0.05, 0.75),
    mortgaged: clamp(opts.c.mortgagedOwnerShare, 0.05, 0.75),
    outright: clamp(1 - opts.c.renterShare - opts.c.mortgagedOwnerShare - 0.06, 0.02, 0.75),
    investor: 0.06,
  };

  const shares: Record<TenureType, number> = {
    ...defaultTenure,
    ...(opts.tenureShares ?? {}),
  };

  const rows: MicroRecord[] = [];
  for (let i = 0; i < n; i++) {
    const z = normalSample(rng);
    const income = Math.exp(mu + sigma * z);
    const tenure = sampleTenure(rng, shares);
    rows.push({
      income: clamp(income, 8_000, 1_500_000),
      tenure,
      weight: 1,
    });
  }
  return rows;
}

export function generateSyntheticMicrodataBundle(opts: {
  cities: CityBaseState[];
  c: CoreConstants;
  nPerCity?: number;
  seed?: number;
}): { byCity: Partial<Record<CityId, MicroRecord[]>> } {
  const byCity: Partial<Record<CityId, MicroRecord[]>> = {};
  opts.cities.forEach((city) => {
    byCity[city.cityId] = generateSyntheticMicrodataForCity({
      city,
      c: opts.c,
      n: opts.nPerCity ?? 2000,
      seed: (opts.seed ?? 12345) + hashCity(city.cityId),
    });
  });
  return { byCity };
}

function hashCity(id: CityId): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

