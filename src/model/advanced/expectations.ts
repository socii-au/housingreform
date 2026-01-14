import type { ExpectationsConfig, Year } from "../methodology";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function normalizeMix(mix: NonNullable<ExpectationsConfig["agentMix"]>) {
  const sum = Math.max(1e-9, mix.extrapolators + mix.fundamentals + mix.meanReverters);
  return {
    extrapolators: mix.extrapolators / sum,
    fundamentals: mix.fundamentals / sum,
    meanReverters: mix.meanReverters / sum,
  };
}

/**
 * Heterogeneous expectations (placeholder but explicit).
 *
 * Returns an expected nominal price growth rate used for:
 * - investor portfolio choice (expected capital gains)
 * - construction response (developers extrapolate demand)
 */
export function expectedNominalPriceGrowth(opts: {
  year: Year;
  baseline: number;
  lastObservedNominalPriceGrowth: number;
  fundamentalsAnchor: number;
  config?: ExpectationsConfig;
}): number {
  const { baseline, lastObservedNominalPriceGrowth, fundamentalsAnchor, config } = opts;
  if (!config?.enabled) return baseline;

  const model = config.model ?? "mixed";
  const mix = normalizeMix(
    config.agentMix ?? { extrapolators: 0.50, fundamentals: 0.25, meanReverters: 0.25 }
  );
  const extrap = clamp01(config.extrapolationStrength ?? 0.6);
  const mr = clamp01(config.meanReversionStrength ?? 0.35);

  const extrapolators = baseline + extrap * (lastObservedNominalPriceGrowth - baseline);
  const fundamentals = fundamentalsAnchor;
  const meanReverters = baseline - mr * (lastObservedNominalPriceGrowth - baseline);

  if (model === "adaptive") return extrapolators;
  if (model === "fundamentals") return fundamentals;

  // mixed
  return (
    mix.extrapolators * extrapolators +
    mix.fundamentals * fundamentals +
    mix.meanReverters * meanReverters
  );
}

