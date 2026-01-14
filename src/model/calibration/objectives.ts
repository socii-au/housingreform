import type { CoreConstants, Curves, Year } from "../methodology";

export interface CityHistorySeries {
  years: Year[];
  medianPrice: number[];
  medianAnnualRent: number[];
  medianAnnualWage: number[];
  population: number[];
  dwellingStock: number[];
}

export function affordabilitySeriesFromHistory(h: CityHistorySeries): {
  years: Year[];
  priceToIncome: number[];
  rentToIncome: number[];
} {
  const n = h.years.length;
  const priceToIncome: number[] = [];
  const rentToIncome: number[] = [];
  for (let i = 0; i < n; i++) {
    const w = Math.max(1e-9, h.medianAnnualWage[i]);
    priceToIncome.push(h.medianPrice[i] / w);
    rentToIncome.push(h.medianAnnualRent[i] / w);
  }
  return { years: h.years, priceToIncome, rentToIncome };
}

export function avgLogGrowth(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const diffs: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1];
    const b = xs[i];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) continue;
    diffs.push(Math.log(b / a));
  }
  if (diffs.length < 2) return null;
  return diffs.reduce((acc, d) => acc + d, 0) / diffs.length;
}

export function rmseLogRatio(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return Number.POSITIVE_INFINITY;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.log(Math.max(1e-12, a[i]));
    const y = Math.log(Math.max(1e-12, b[i]));
    const d = x - y;
    s += d * d;
  }
  return Math.sqrt(s / n);
}

export function supplyGapFromHistory(opts: {
  population: number;
  dwellingStock: number;
  c: CoreConstants;
}): number {
  const { population, dwellingStock, c } = opts;
  const stock = Math.max(1e-9, dwellingStock);
  const households = population / c.personsPerHousehold;
  return (households - stock) / stock;
}

export function cappedGrowth(x: number, c: CoreConstants, kind: "price" | "rent"): number {
  if (kind === "price") return Math.max(c.caps.minNominalPriceGrowth, Math.min(c.caps.maxNominalPriceGrowth, x));
  return Math.max(c.caps.minNominalRentGrowth, Math.min(c.caps.maxNominalRentGrowth, x));
}

/**
 * Predict affordability trajectories using history-derived baseline growth plus a supply-gap term scaled by speed.
 * This avoids circular dependency on runScenario while still anchoring to the model’s core mechanism.
 */
export function predictAffordabilityFromHistory(opts: {
  h: CityHistorySeries;
  c: CoreConstants;
  curves: Curves;
  marketAdjustmentSpeed: number;
}): { years: Year[]; priceToIncome: number[]; rentToIncome: number[] } {
  const { h, c, curves, marketAdjustmentSpeed } = opts;
  const n = h.years.length;

  const bp = avgLogGrowth(h.medianPrice) ?? 0.04;
  const br = avgLogGrowth(h.medianAnnualRent) ?? 0.035;
  const bw = avgLogGrowth(h.medianAnnualWage) ?? 0.03;

  let price = h.medianPrice[0];
  let rent = h.medianAnnualRent[0];
  let wage = h.medianAnnualWage[0];

  const pti: number[] = [price / Math.max(1e-9, wage)];
  const rti: number[] = [rent / Math.max(1e-9, wage)];

  for (let i = 1; i < n; i++) {
    const gap = supplyGapFromHistory({ population: h.population[i], dwellingStock: h.dwellingStock[i], c });
    const pg = cappedGrowth(bp + marketAdjustmentSpeed * curves.priceSupplyGap(gap), c, "price");
    const rg = cappedGrowth(br + marketAdjustmentSpeed * curves.rentSupplyGap(gap), c, "rent");

    price = price * (1 + pg);
    rent = rent * (1 + rg);
    wage = wage * (1 + bw);

    pti.push(price / Math.max(1e-9, wage));
    rti.push(rent / Math.max(1e-9, wage));
  }

  return { years: h.years, priceToIncome: pti, rentToIncome: rti };
}

