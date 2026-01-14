import type { PolicyContext } from "./types";
import { emptyDelta, type PolicyChannelDelta } from "./types";

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

  const buffer = clamp(c.serviceabilityBufferDelta, -0.02, 0.03);
  if (buffer !== 0) {
    // Interpret as tightening borrowing capacity more than it changes actual interest rates.
    // Map +1pp buffer => ~ -4% owner-occupier demand.
    d.ownerOccDemandMultiplier *= 1 - 4 * buffer; // buffer is in rate units (0.01 => 1%)
    d.notes.push(`Serviceability buffer delta: ${Math.round(buffer * 100)}pp`);
  }

  const dti = clamp(c.dtiCapTightness, 0, 1);
  if (dti > 0) {
    d.ownerOccDemandMultiplier *= 1 - 0.10 * dti;
    d.investorDemandMultiplier *= 1 - 0.05 * dti;
  }

  const inv = clamp(c.investorLendingLimitTightness, 0, 1);
  if (inv > 0) {
    d.investorDemandMultiplier *= 1 - 0.10 * inv;
  }

  return d;
}

