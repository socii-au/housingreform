import type { CityId } from "../regions";
import type { ScenarioParams } from "../methodology";
import { DEFAULT_CONSTANTS, DEFAULT_CURVES, resolveMethodology } from "../methodology";
import { fit1DGrid } from "./fitElasticities";
import {
  affordabilitySeriesFromHistory,
  predictAffordabilityFromHistory,
  rmseLogRatio,
  type CityHistorySeries,
} from "./objectives";
import type { HistoryBundle } from "../history/types";

export interface CalibrationReport {
  fitted: {
    marketAdjustmentSpeed: number;
  };
  holdout?: {
    splitYear: number;
    rmseCombined: number;
    notes: string[];
  };
  perCity: Partial<
    Record<
      CityId,
      {
        rmsePriceToIncome: number;
        rmseRentToIncome: number;
        years: number;
      }
    >
  >;
  warnings: string[];
  notes: string[];
}

function hasHistory(h: any): h is CityHistorySeries {
  return (
    h &&
    Array.isArray(h.years) &&
    Array.isArray(h.medianPrice) &&
    Array.isArray(h.medianAnnualRent) &&
    Array.isArray(h.medianAnnualWage) &&
    Array.isArray(h.population) &&
    Array.isArray(h.dwellingStock) &&
    h.years.length >= 8
  );
}

/**
 * Calibration-first, affordability-focused calibrator.
 *
 * First pass: fit a single global marketAdjustmentSpeed to minimize affordability ratio error across cities.
 * This keeps the pipeline stable and avoids a high-dimensional optimizer.
 */
export function calibrateScenario(params: ScenarioParams): CalibrationReport {
  const warnings: string[] = [];
  const notes: string[] = [];

  const bundle = params.advanced?.calibration?.historyBundle as HistoryBundle | undefined;
  const historyByCity = params.advanced?.calibration?.historyByCity ?? {};
  const cityIds = params.cities.map((c) => c.cityId);

  const validCities: CityId[] = [];
  const histories: Record<CityId, CityHistorySeries> = {} as any;

  cityIds.forEach((id) => {
    const fromBundle = bundle?.byCity?.[id];
    const toNumArr = (arr?: Array<number | null>, n?: number): number[] | null => {
      if (!arr || n == null) return null;
      if (arr.length !== n) return null;
      const out: number[] = [];
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
        out.push(v);
      }
      return out;
    };

    const h = fromBundle
      ? (() => {
          const n = fromBundle.years.length;
          const medianPrice = toNumArr(fromBundle.medianPrice, n);
          const medianAnnualRent = toNumArr(fromBundle.medianAnnualRent, n);
          const medianAnnualWage = toNumArr(fromBundle.medianAnnualWage, n);
          const population = toNumArr(fromBundle.population, n);
          const dwellingStock = toNumArr(fromBundle.dwellingStock, n);
          if (!medianPrice || !medianAnnualRent || !medianAnnualWage || !population || !dwellingStock) return null;
          return {
            years: fromBundle.years,
            medianPrice,
            medianAnnualRent,
            medianAnnualWage,
            population,
            dwellingStock,
          };
        })()
      : (historyByCity as any)[id];
    if (!hasHistory(h)) return;
    const n = h.years.length;
    const ok =
      h.medianPrice.length === n &&
      h.medianAnnualRent.length === n &&
      h.medianAnnualWage.length === n &&
      h.population.length === n &&
      h.dwellingStock.length === n;
    if (!ok) return;
    validCities.push(id);
    histories[id] = h;
  });

  if (validCities.length === 0) {
    warnings.push("No usable historical city series found for calibration. Using defaults.");
    return {
      fitted: { marketAdjustmentSpeed: DEFAULT_CONSTANTS.marketAdjustmentSpeed },
      perCity: {},
      warnings,
      notes,
    };
  }

  const { c, curves } = resolveMethodology({
    ...params,
    constants: { ...DEFAULT_CONSTANTS, ...(params.constants ?? {}) },
    curves: { ...DEFAULT_CURVES, ...(params.curves ?? {}) },
  });

  const target = validCities.flatMap((id) => {
    const obs = affordabilitySeriesFromHistory(histories[id]);
    return obs.priceToIncome.map((x, i) => Math.log(Math.max(1e-12, x)) + 0.35 * Math.log(Math.max(1e-12, obs.rentToIncome[i])));
  });

  const simulate = (speed: number) => {
    const xs = validCities.flatMap((id) => {
      const pred = predictAffordabilityFromHistory({
        h: histories[id],
        c: { ...c, marketAdjustmentSpeed: speed },
        curves,
        marketAdjustmentSpeed: speed,
      });
      return pred.priceToIncome.map(
        (x, i) => Math.log(Math.max(1e-12, x)) + 0.35 * Math.log(Math.max(1e-12, pred.rentToIncome[i]))
      );
    });
    return xs;
  };

  const fit = fit1DGrid({
    param: "marketAdjustmentSpeed",
    bound: { min: 0.20, max: 1.00 },
    gridN: 60,
    simulate,
    target,
  });

  const best = fit.best;
  notes.push(`Calibrated marketAdjustmentSpeed=${best.toFixed(2)} using ${validCities.length} cities (grid rmse=${fit.rmse.toFixed(3)}).`);

  const perCity: CalibrationReport["perCity"] = {};
  validCities.forEach((id) => {
    const obs = affordabilitySeriesFromHistory(histories[id]);
    const pred = predictAffordabilityFromHistory({
      h: histories[id],
      c: { ...c, marketAdjustmentSpeed: best },
      curves,
      marketAdjustmentSpeed: best,
    });
    perCity[id] = {
      rmsePriceToIncome: rmseLogRatio(obs.priceToIncome, pred.priceToIncome),
      rmseRentToIncome: rmseLogRatio(obs.rentToIncome, pred.rentToIncome),
      years: histories[id].years.length,
    };
  });

  // Optional holdout scoring: last 5 years if enough history exists.
  let holdout: CalibrationReport["holdout"] | undefined;
  const lengths = validCities.map((id) => histories[id].years.length);
  const minN = Math.min(...lengths);
  if (minN >= 15) {
    const splitIdx = minN - 5;
    const splitYear = validCities.length ? histories[validCities[0]].years[splitIdx] : 0;
    const combinedObs: number[] = [];
    const combinedPred: number[] = [];
    validCities.forEach((id) => {
      const h = histories[id];
      const obs = affordabilitySeriesFromHistory(h);
      const pred = predictAffordabilityFromHistory({
        h,
        c: { ...c, marketAdjustmentSpeed: best },
        curves,
        marketAdjustmentSpeed: best,
      });
      for (let i = splitIdx; i < h.years.length; i++) {
        combinedObs.push(Math.log(Math.max(1e-12, obs.priceToIncome[i])) + 0.35 * Math.log(Math.max(1e-12, obs.rentToIncome[i])));
        combinedPred.push(Math.log(Math.max(1e-12, pred.priceToIncome[i])) + 0.35 * Math.log(Math.max(1e-12, pred.rentToIncome[i])));
      }
    });
    const rmse = Math.sqrt(
      combinedObs.reduce((acc, v, i) => {
        const d = v - (combinedPred[i] ?? v);
        return acc + d * d;
      }, 0) / Math.max(1, combinedObs.length)
    );
    holdout = { splitYear, rmseCombined: rmse, notes: ["Holdout is a simple last-5-years score (not a re-fit)."] };
  }

  if (validCities.length < Math.max(3, Math.floor(cityIds.length * 0.5))) {
    warnings.push(
      `Calibration coverage is incomplete (${validCities.length}/${cityIds.length} cities have usable history). Results may be biased.`
    );
  }

  return {
    fitted: { marketAdjustmentSpeed: best },
    holdout,
    perCity,
    warnings,
    notes,
  };
}

