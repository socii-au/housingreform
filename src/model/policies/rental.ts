import type { PolicyContext } from "./types";
import { emptyDelta, policyRamp, type PolicyChannelDelta } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Rental market settings.
 */
export function rentalChannels(ctx: PolicyContext): PolicyChannelDelta {
  const d = emptyDelta();
  const r = ctx.policy.rental;
  const ramp = policyRamp(ctx);

  // Rent assistance: modeled primarily as stress relief (income supplement for renters),
  // but it can slightly increase willingness-to-pay in tight markets. We keep the market
  // effect neutral here and apply only to stress via rentAssistanceShareOfRent.
  const ra = clamp(r.rentAssistanceIntensity, 0, 1) * ramp;
  if (ra > 0) {
    d.rentAssistanceShareOfRent = 0.25 * ra; // up to 25% of annual rent (shape-first)
  }

  // Rent regulation: applied later as a blended cap based on coverage.
  const regCoverage = clamp(r.rentRegulationCoverage ?? 0, 0, 1) * ramp;
  d.rentGrowthCap = r.rentRegulationCap == null ? null : clamp(r.rentRegulationCap, -0.05, 0.08);
  d.rentRegulationCoverage = regCoverage;
  d.vacancyDecontrol = !!r.vacancyDecontrol;

  // Supply-side feedback: broad rent regulation discourages new rental construction.
  // Evidence: Berlin (Mietendeckel), San Francisco (Costa-Hawkins) show reduced supply.
  // Stronger effect without vacancy decontrol (more investment uncertainty).
  if (d.rentGrowthCap != null && regCoverage > 0.3) {
    const supplyDrag = d.vacancyDecontrol ? 0.02 : 0.05;
    d.completionsMultiplier *= 1 - supplyDrag * regCoverage;
  }

  return d;
}
