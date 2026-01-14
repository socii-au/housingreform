import type { PolicyContext } from "./types";
import { emptyDelta, type PolicyChannelDelta } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Planning / infrastructure channels.
 */
export function planningChannels(ctx: PolicyContext): PolicyChannelDelta {
  const d = emptyDelta();
  const p = ctx.policy.planning;

  const up = clamp(p.upzoningIntensity, 0, 1);
  if (up > 0) {
    // Upzoning unlocks feasible supply but rolls out slowly.
    d.completionsMultiplier *= 1 + 0.10 * up; // up to +10% baseline completions
  }

  const infra = clamp(p.infrastructureEnablement, 0, 1);
  const lag = Math.max(0, Math.round(p.infrastructureLagYears ?? 3));
  if (infra > 0) {
    // Infrastructure lifts capacity after a lag.
    const active = ctx.yearIndex >= lag ? 1 : 0;
    d.capacityLift += active * 0.50 * infra; // up to +50% on the YoY growth cap (not on levels)
    d.completionsMultiplier *= 1 + active * 0.05 * infra; // modest additional completions once enabled
  }

  return d;
}

