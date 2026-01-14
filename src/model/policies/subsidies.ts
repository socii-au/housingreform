import type { PolicyContext } from "./types";
import { emptyDelta, type PolicyChannelDelta } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Demand-side subsidies (e.g., first home buyer support).
 */
export function subsidyChannels(ctx: PolicyContext): PolicyChannelDelta {
  const d = emptyDelta();
  const s = clamp(ctx.policy.subsidies.firstHomeBuyerSubsidyIntensity, 0, 1);
  if (s > 0) {
    // Subsidies mostly shift timing/borrowing; conservative: up to +5% OO demand.
    d.ownerOccDemandMultiplier *= 1 + 0.05 * s;
  }
  return d;
}

