import type { PolicyContext } from "./types";
import { emptyDelta, type PolicyChannelDelta } from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Migration policy lever (national net migration level shock).
 *
 * This is applied as a multiplier on the city's baseline net migration per year
 * (before spatial reallocation in the advanced engine).
 */
export function migrationChannels(ctx: PolicyContext): PolicyChannelDelta {
  const d = emptyDelta();
  const m = clamp(ctx.policy.migration.netOverseasMigrationShock, -0.30, 0.30);
  if (m !== 0) {
    d.netMigrationMultiplier *= 1 + m;
  }
  return d;
}

