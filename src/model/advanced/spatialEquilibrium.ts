import type { CityId } from "../regions";
import type { SpatialEquilibriumConfig } from "../methodology";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function softmax(xs: number[], temperature: number): number[] {
  const t = Math.max(1e-9, temperature);
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp((x - m) / t));
  const sum = Math.max(1e-9, exps.reduce((a, b) => a + b, 0));
  return exps.map((e) => e / sum);
}

/**
 * Spatial equilibrium (placeholder but explicit).
 *
 * Reallocates *national* net migration across cities based on a simple utility index,
 * preserving total net migration while allowing re-sorting.
 */
export function reallocateNetMigrationAcrossCities(opts: {
  cityIds: CityId[];
  baseNetMigrationByCity: Record<CityId, number>;
  utilityByCity: Record<CityId, number>;
  config?: SpatialEquilibriumConfig;
}): Record<CityId, number> {
  const { cityIds, baseNetMigrationByCity, utilityByCity, config } = opts;
  if (!config?.enabled) return { ...baseNetMigrationByCity };

  const sens = clamp(config.migrationSensitivity ?? 1.2, 0.05, 10);
  const floorShare = clamp(config.floorShare ?? 0.03, 0, 0.25);

  const total = cityIds.reduce((acc, id) => acc + (baseNetMigrationByCity[id] ?? 0), 0);

  // If total is ~0, nothing to reallocate.
  if (Math.abs(total) < 1e-6) {
    const out: Record<CityId, number> = {} as Record<CityId, number>;
    cityIds.forEach((id) => (out[id] = baseNetMigrationByCity[id] ?? 0));
    return out;
  }

  const utils = cityIds.map((id) => utilityByCity[id] ?? 0);
  const shares = softmax(utils, 1 / sens);

  // Apply friction floor: keep some share of baseline allocation.
  // Baseline share uses absolute values to avoid weirdness when total is negative.
  const baseAbs = cityIds.map((id) => Math.abs(baseNetMigrationByCity[id] ?? 0));
  const baseAbsSum = Math.max(1e-9, baseAbs.reduce((a, b) => a + b, 0));
  const baseShare = baseAbs.map((x) => x / baseAbsSum);

  const blended = shares.map((s, i) => (1 - floorShare) * s + floorShare * baseShare[i]);
  const blendSum = Math.max(1e-9, blended.reduce((a, b) => a + b, 0));
  const norm = blended.map((b) => b / blendSum);

  const out: Record<CityId, number> = {} as Record<CityId, number>;
  cityIds.forEach((id, i) => {
    out[id] = total * norm[i];
  });
  return out;
}

