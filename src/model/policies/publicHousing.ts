import type { PolicyContext } from "./types";
import { emptyDelta, type PolicyChannelDelta } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Public/community housing levers.
 *
 * We treat these as (a) additive completions, and (b) rental-market loosening via tenure conversion.
 * This is a simplification: full general equilibrium effects are out of scope.
 */
export function publicHousingChannels(ctx: PolicyContext): PolicyChannelDelta {
  const d = emptyDelta();
  const p = ctx.policy.publicCommunity;
  const base = ctx.base;

  const buildBoost = clamp(p.publicHousingBuildBoost, 0, 0.20);
  if (buildBoost > 0) {
    // Additive completions: share of baseline completions.
    d.additionalCompletions += base.annualCompletions * buildBoost;
    // Slight rental loosening proxy (some households housed outside market).
    d.rentalSupplyShockShare += -0.002 * (buildBoost / 0.20);
  }

  const acq = clamp(p.publicHousingAcquisitionSharePerYear, 0, 0.01);
  if (acq > 0) {
    // Acquisition removes dwellings from private market but houses households; net effect in this
    // simplified model is treated as reduced pressure in private rental market.
    d.rentalSupplyShockShare += -0.004 * (acq / 0.01);
  }

  const conv = clamp(p.conversionToSocialSharePerYear, 0, 0.01);
  if (conv > 0) {
    d.rentalSupplyShockShare += -0.003 * (conv / 0.01);
  }

  return d;
}

