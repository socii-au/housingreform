import type { CityId } from "../regions";
import type { CityBaseState, Year } from "../methodology";

export type HistoryField =
  | "medianPrice"
  | "medianAnnualRent"
  | "medianAnnualWage"
  | "population"
  | "dwellingStock";

export interface CityHistorySeries {
  years: Year[];
  // Values may be null when missing prior to imputation.
  medianPrice?: Array<number | null>;
  medianAnnualRent?: Array<number | null>;
  medianAnnualWage?: Array<number | null>;
  population?: Array<number | null>;
  dwellingStock?: Array<number | null>;
}

export interface CityHistoryMeta {
  cityId: CityId;
  /** Which fields contain any imputed values (after imputation stage). */
  imputedFields: Partial<Record<HistoryField, boolean>>;
  /** Fraction of points imputed per field, 0..1. */
  imputedShare: Partial<Record<HistoryField, number>>;
  notes: string[];
  warnings: string[];
}

export interface HistoryBundle {
  startYear: Year;
  endYear: Year;
  byCity: Partial<Record<CityId, CityHistorySeries>>;
  meta: {
    notes: string[];
    warnings: string[];
    byCity: Partial<Record<CityId, CityHistoryMeta>>;
  };
}

export type TimelineKind = "historical" | "projected";

export interface TimelinePoint {
  year: Year;
  kind: TimelineKind;
  /**
   * Minimal fields used by charts. Optional because history can be partial.
   * Charts should hide/skip overlays when missing.
   */
  medianPrice?: number;
  medianAnnualRent?: number;
  medianAnnualWage?: number;
  population?: number;
  dwellingStock?: number;
  stampDutyRevenue?: number;

  // Indexed values (computed by timeline builder based on selected base year).
  priceIndex?: number;
  rentIndex?: number;
  wageIndex?: number;
}

export interface BuildHistoryBundleOptions {
  cities: CityBaseState[];
  startYear?: Year; // default 2000
  endYear: Year; // typically year0
  rawByCity: Partial<Record<CityId, Partial<CityHistorySeries>>>;
}

