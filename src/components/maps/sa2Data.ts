/**
 * Embedded SA2 geometry and 2024 baseline series data.
 * Pre-extracted from ASGS 2026 for lightweight, instant rendering.
 * SA2 is the most granular level (~2,400 regions).
 */

import sa2DataRaw from "./sa2Data.json";

export type StateCode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

export const STATE_CODE_MAP: Record<StateCode, string> = {
  "1": "NSW",
  "2": "VIC",
  "3": "QLD",
  "4": "SA",
  "5": "WA",
  "6": "TAS",
  "7": "NT",
  "8": "ACT",
};

export interface SA2Feature {
  code: string;
  name: string;
  state: StateCode;
  parentSa3: string;
  parentSa4: string;
  polygon: Array<[number, number]>;
  series2024: {
    medianPrice: number;
    medianAnnualRent: number;
    medianAnnualWage: number;
    population: number;
    dwellingStock: number;
  } | null;
}

// Type assertion with runtime validation
const rawFeatures = (sa2DataRaw as any).features as any[];

export const SA2_FEATURES: SA2Feature[] = rawFeatures.map((f) => ({
  code: String(f.code),
  name: String(f.name),
  state: String(f.state) as StateCode,
  parentSa3: String(f.parentSa3 ?? ""),
  parentSa4: String(f.parentSa4 ?? ""),
  polygon: f.polygon as Array<[number, number]>,
  series2024: f.series2024
    ? {
        medianPrice: Number(f.series2024.medianPrice),
        medianAnnualRent: Number(f.series2024.medianAnnualRent),
        medianAnnualWage: Number(f.series2024.medianAnnualWage),
        population: Number(f.series2024.population),
        dwellingStock: Number(f.series2024.dwellingStock),
      }
    : null,
}));

/**
 * Compute crisis score for an SA2 feature using the same formula as the city-level model.
 */
export function computeSA2CrisisScore(f: SA2Feature): number | null {
  const s = f.series2024;
  if (!s || s.medianAnnualWage <= 0) return null;

  const rentBurden = s.medianAnnualRent / s.medianAnnualWage;
  const priceToIncome = s.medianPrice / s.medianAnnualWage;

  // Same formula as src/model/crisisScore.ts
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const rentScore = clamp01((rentBurden - 0.25) / 0.15);
  const ptiScore = clamp01((priceToIncome - 6.0) / 6.0);
  return clamp01(0.6 * rentScore + 0.4 * ptiScore);
}

/**
 * Get all SA2 features for a given state code.
 */
export function getSA2sByState(state: StateCode): SA2Feature[] {
  return SA2_FEATURES.filter((f) => f.state === state);
}

/**
 * Get all SA2 features for a given parent SA3.
 */
export function getSA2sBySA3(parentSa3: string): SA2Feature[] {
  return SA2_FEATURES.filter((f) => f.parentSa3 === parentSa3);
}

/**
 * Get all SA2 features for a given parent SA4.
 */
export function getSA2sBySA4(parentSa4: string): SA2Feature[] {
  return SA2_FEATURES.filter((f) => f.parentSa4 === parentSa4);
}

/**
 * Helper to convert polygon to SVG path.
 */
export function sa2PolygonToPath(polygon: Array<[number, number]>): string {
  if (!polygon.length) return "";
  const [x0, y0] = polygon[0];
  let d = `M${x0},${y0}`;
  for (let i = 1; i < polygon.length; i++) {
    const [x, y] = polygon[i];
    d += ` L${x},${y}`;
  }
  return d + " Z";
}
