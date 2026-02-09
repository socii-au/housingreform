import type { PolicyContext } from "./types";
import { emptyDelta, policyRamp, type PolicyChannelDelta } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Credit and macro-prudential settings.
 */
export function macroprudentialChannels(ctx: PolicyContext): PolicyChannelDelta {
  const d = emptyDelta();
  const { policy } = ctx;
  const c = policy.credit;
  const ramp = policyRamp(ctx);

  const buffer = clamp(c.serviceabilityBufferDelta, -0.02, 0.03) * ramp;
  if (buffer !== 0) {
    // Interpret as tightening borrowing capacity more than it changes actual interest rates.
    // Map +1pp buffer => ~ -4% owner-occupier demand.
    d.ownerOccDemandMultiplier *= 1 - 4 * buffer; // buffer is in rate units (0.01 => 1%)
    d.notes.push(`Serviceability buffer delta: ${Math.round(buffer * 100)}pp`);
  }

  // DTI caps constrain investors more heavily than OO (higher leverage, multiple properties).
  // Empirical: APRA 2014-17 investor lending intervention reduced inv. lending ~10-15%.
  const dti = clamp(c.dtiCapTightness, 0, 1) * ramp;
  if (dti > 0) {
    d.ownerOccDemandMultiplier *= 1 - 0.08 * dti;
    d.investorDemandMultiplier *= 1 - 0.10 * dti;
  }

  // Investor lending limit: APRA evidence ~10-15% reduction at full tightness.
  const inv = clamp(c.investorLendingLimitTightness, 0, 1) * ramp;
  if (inv > 0) {
    d.investorDemandMultiplier *= 1 - 0.13 * inv;
  }

  return d;
}
