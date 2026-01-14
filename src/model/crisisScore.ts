import type { CityId, StateId } from "./regions";
import { cityMeta } from "./regions";

export interface CrisisInputs {
  medianPrice?: number | null;
  medianAnnualRent?: number | null;
  medianAnnualWage?: number | null;
}

export interface CrisisScoreDetail {
  score01: number;
  rentBurden: number;
  priceToIncome: number;
  rentScore01: number;
  ptiScore01: number;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Shape-first crisis score used for the heatmap. Tunable thresholds, explicitly non-calibrated.
 *
 * - rentBurden = annualRent / annualWage
 * - priceToIncome = price / annualWage
 *
 * We normalize each to 0..1 using conservative thresholds and combine:
 * - 60% rent stress weight (more immediate pain)
 * - 40% price-to-income weight (long-run affordability)
 */
export function computeCrisisScore(inputs: CrisisInputs): CrisisScoreDetail | null {
  const w = inputs.medianAnnualWage ?? null;
  const p = inputs.medianPrice ?? null;
  const r = inputs.medianAnnualRent ?? null;
  if (!w || !p || !r || w <= 0 || p <= 0 || r <= 0) return null;

  const rentBurden = r / w; // e.g. 0.30
  const priceToIncome = p / w; // e.g. 9.5

  // Normalization thresholds (tunable):
  // - rentBurden: 25% → 0, 40% → 1
  // - priceToIncome: 6× → 0, 12× → 1
  const rentScore01 = clamp01((rentBurden - 0.25) / 0.15);
  const ptiScore01 = clamp01((priceToIncome - 6.0) / 6.0);
  const score01 = clamp01(0.6 * rentScore01 + 0.4 * ptiScore01);

  return { score01, rentBurden, priceToIncome, rentScore01, ptiScore01 };
}

export function crisisColor(score01: number): string {
  // 7-step ramp (accessible-ish, avoids neon).
  if (score01 < 0.12) return "#16a34a"; // low
  if (score01 < 0.24) return "#65a30d";
  if (score01 < 0.40) return "#a3a3a3"; // neutral/transition
  if (score01 < 0.55) return "#f59e0b";
  if (score01 < 0.70) return "#f97316";
  if (score01 < 0.85) return "#ea580c";
  return "#dc2626"; // extreme
}

export function stateOfCity(cityId: CityId): StateId {
  return cityMeta(cityId).state;
}

