import type { PortfolioConfig } from "../methodology";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Simple investor portfolio channel (placeholder but explicit).
 *
 * Returns a multiplier on investor demand (1 = neutral).
 * - If expected housing return > outside return, investor demand rises (>1).
 * - If expected housing return < outside return, investor demand falls (<1).
 *
 * This is NOT a full structural portfolio model; it's a tunable bridge.
 */
export function portfolioInvestorDemandMultiplier(opts: {
  expectedNominalPriceGrowth: number;
  rentalYield: number; // annual rent / price
  mortgageRate: number;
  config?: PortfolioConfig;
}): number {
  const { expectedNominalPriceGrowth, rentalYield, mortgageRate, config } = opts;
  if (!config?.enabled) return 1;

  const outside = config.outsideReturn ?? 0.04;
  const sens = clamp(config.demandSensitivity ?? 6, 0.5, 30);
  const riskAversion = clamp(config.riskAversion ?? 0.8, 0, 5);

  // Very rough expected excess return proxy:
  // housing return ≈ yield + capital gains - financing cost - risk penalty
  const housingReturn = rentalYield + expectedNominalPriceGrowth - 0.35 * mortgageRate;
  const excess = housingReturn - outside;

  // Logistic-style response around 0 excess return.
  // Risk aversion damps sensitivity.
  const k = sens / (1 + riskAversion);
  const raw = 1 + 0.18 * Math.tanh(k * excess);

  return clamp(raw, 0.80, 1.20);
}

