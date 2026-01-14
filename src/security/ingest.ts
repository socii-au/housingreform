import type { CityId } from "../model/regions";
import type { RecordLike } from "../model/microdata/importers";
import type { HistoryBundle } from "../model/history/types";
import { sanitizeByCityRowsMapWithReport, sanitizeHistoryBundleWithReport } from "./sanitize";

export function ingestMicrodataRawByCity(
  input: unknown,
  opts?: { maxRowsPerCity?: number }
): {
  value: Partial<Record<CityId, RecordLike[]>>;
  warnings: string[];
  report: {
    droppedCityKeys: number;
    keptCityKeys: number;
    droppedRows: number;
    truncatedRows: number;
    maxRowsPerCity: number;
  };
} {
  const { sanitized, report } = sanitizeByCityRowsMapWithReport(input, opts);
  const warnings: string[] = [];
  if (report.droppedCityKeys > 0) warnings.push(`Dropped ${report.droppedCityKeys} invalid city keys.`);
  if (report.droppedRows > 0) warnings.push(`Dropped ${report.droppedRows} non-object rows.`);
  if (report.truncatedRows > 0) warnings.push(`Truncated ${report.truncatedRows} rows due to cap (${report.maxRowsPerCity}/city).`);
  if (report.keptCityKeys === 0) warnings.push("No valid city keys found after sanitization.");
  return { value: sanitized, warnings, report };
}

export function ingestHistoryBundle(
  input: unknown
): {
  value: HistoryBundle | null;
  warnings: string[];
  report: {
    ok: boolean;
    droppedCityKeys: number;
    keptCityKeys: number;
    droppedPoints: number;
    cappedPoints: number;
    maxYears: number;
  };
} {
  const { sanitized, report } = sanitizeHistoryBundleWithReport(input);
  const warnings: string[] = [];
  if (!report.ok || !sanitized) {
    warnings.push("History bundle failed validation and was rejected.");
    return { value: null, warnings, report };
  }
  if (report.droppedCityKeys > 0) warnings.push(`Dropped ${report.droppedCityKeys} invalid city keys in history bundle.`);
  if (report.cappedPoints > 0) warnings.push(`Capped ${report.cappedPoints} year-points (max ${report.maxYears} years).`);
  return { value: sanitized, warnings, report };
}

