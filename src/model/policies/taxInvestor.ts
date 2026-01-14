import type { PolicyContext } from "./types";
import { emptyDelta, type PolicyChannelDelta } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Tax & investor incentives.
 *
 * Calibration-first: these are conservative, bounded mappings meant to be
 * replaced/validated with historical estimates.
 */
export function taxInvestorChannels(ctx: PolicyContext): PolicyChannelDelta {
  const d = emptyDelta();
  const { policy, base } = ctx;
  const t = policy.taxInvestor;

  // CGT discount change: affects investor after-tax return.
  // cgtDiscountDelta positive => more investor demand, negative => less.
  // Conservative: +/-25pp maps to roughly +/-6% investor demand.
  const cgt = clamp(t.cgtDiscountDelta, -0.25, 0.25);
  if (cgt !== 0) d.notes.push(`CGT discount delta applied: ${Math.round(cgt * 100)}pp`);
  d.investorDemandMultiplier *= 1 + 0.25 * cgt; // -0.25 => 0.9375, +0.25 => 1.0625

  // Vacancy tax: nudges empty/underutilized stock back into rental supply.
  const vac = clamp(t.vacancyTaxIntensity, 0, 1);
  if (vac > 0) {
    // Up to ~0.6% stock-equivalent rental loosening at full intensity.
    d.rentalSupplyShockShare += -0.006 * vac;
  }

  // Short-stay regulation: shifts some short-stay dwellings back into long-term rental.
  const ss = clamp(t.shortStayRegulationIntensity, 0, 1);
  if (ss > 0) {
    // Scale with investor share (proxy for stock more likely to be short-stay).
    d.rentalSupplyShockShare += -0.008 * ss * clamp(base.investorDwellingShare, 0, 0.5);
  }

  // Foreign buyer restrictions: modest investor demand reduction.
  const fb = clamp(t.foreignBuyerRestrictionIntensity, 0, 1);
  if (fb > 0) d.investorDemandMultiplier *= 1 - 0.03 * fb;

  // Stamp duty -> land tax shift: lowers transaction friction, increases turnover,
  // and reduces stamp duty rate used in revenue proxy (not a welfare calc).
  const shift = clamp(t.landTaxShift, 0, 1);
  if (shift > 0) {
    d.turnoverMultiplier *= 1 + 0.15 * shift;
    d.stampDutyRateDelta += -0.02 * shift; // up to -2pp
  }

  return d;
}

