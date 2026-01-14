/**
 * Embedded SA4 geometry and 2024 baseline series data.
 * Pre-extracted from ASGS 2026 for lightweight, instant rendering.
 */

import sa4DataRaw from "./sa4Data.json";

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

export interface SA4Feature {
  code: string;
  name: string;
  state: StateCode;
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
const rawFeatures = (sa4DataRaw as any).features as any[];

export const SA4_FEATURES: SA4Feature[] = rawFeatures.map((f) => ({
  code: String(f.code),
  name: String(f.name),
  state: String(f.state) as StateCode,
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
 * Compute crisis score for an SA4 feature using the same formula as the city-level model.
 */
export function computeSA4CrisisScore(f: SA4Feature): number | null {
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
 * Helper to convert polygon to SVG path.
 */
export function sa4PolygonToPath(polygon: Array<[number, number]>): string {
  if (!polygon.length) return "";
  const [x0, y0] = polygon[0];
  let d = `M${x0},${y0}`;
  for (let i = 1; i < polygon.length; i++) {
    const [x, y] = polygon[i];
    d += ` L${x},${y}`;
  }
  return d + " Z";
}
