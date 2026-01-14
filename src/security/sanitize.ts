import { CITIES, type CityId } from "../model/regions";
import type { RecordLike } from "../model/microdata/importers";
import type { HistoryBundle } from "../model/history/types";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function isSafeKey(k: string): boolean {
  return !DANGEROUS_KEYS.has(k);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function nullProtoObject<T extends object = Record<string, unknown>>(): T {
  return Object.create(null) as T;
}

export function sanitizeByCityRowsMap(input: unknown, opts?: { maxRowsPerCity?: number }): Partial<Record<CityId, RecordLike[]>> {
  const out: Partial<Record<CityId, RecordLike[]>> = nullProtoObject();
  if (!isPlainObject(input)) return out;
  const allowed = new Set(CITIES.map((c) => c.id));
  const maxRows = Math.max(1000, Math.floor(opts?.maxRowsPerCity ?? 50_000));

  Object.keys(input).forEach((k) => {
    if (!isSafeKey(k)) return;
    if (!allowed.has(k as CityId)) return;
    const v = (input as any)[k];
    if (!Array.isArray(v)) return;
    // Only keep plain-object rows; hard cap to avoid DoS.
    const rows = v
      .slice(0, maxRows)
      .filter((r) => isPlainObject(r));
    out[k as CityId] = rows as RecordLike[];
  });

  return out;
}

export function sanitizeByCityRowsMapWithReport(
  input: unknown,
  opts?: { maxRowsPerCity?: number }
): {
  sanitized: Partial<Record<CityId, RecordLike[]>>;
  report: {
    droppedCityKeys: number;
    keptCityKeys: number;
    droppedRows: number;
    truncatedRows: number;
    maxRowsPerCity: number;
  };
} {
  const allowed = new Set(CITIES.map((c) => c.id));
  const maxRows = Math.max(1000, Math.floor(opts?.maxRowsPerCity ?? 50_000));

  const sanitized: Partial<Record<CityId, RecordLike[]>> = nullProtoObject();
  let droppedCityKeys = 0;
  let keptCityKeys = 0;
  let droppedRows = 0;
  let truncatedRows = 0;

  if (!isPlainObject(input)) {
    return { sanitized, report: { droppedCityKeys: 0, keptCityKeys: 0, droppedRows: 0, truncatedRows: 0, maxRowsPerCity: maxRows } };
  }

  Object.keys(input).forEach((k) => {
    if (!isSafeKey(k) || !allowed.has(k as CityId)) {
      droppedCityKeys++;
      return;
    }
    const v = (input as any)[k];
    if (!Array.isArray(v)) {
      droppedCityKeys++;
      return;
    }
    const slice = v.slice(0, maxRows);
    if (v.length > maxRows) truncatedRows += v.length - maxRows;
    const rows = slice.filter((r) => isPlainObject(r));
    droppedRows += slice.length - rows.length;
    sanitized[k as CityId] = rows as RecordLike[];
    keptCityKeys++;
  });

  return { sanitized, report: { droppedCityKeys, keptCityKeys, droppedRows, truncatedRows, maxRowsPerCity: maxRows } };
}

export function sanitizeStringMap(input: unknown, opts?: { maxKeys?: number; maxKeyLen?: number; maxValLen?: number }): Record<string, string> {
  const out: Record<string, string> = nullProtoObject();
  if (!isPlainObject(input)) return out;
  const maxKeys = Math.max(10, Math.floor(opts?.maxKeys ?? 200));
  const maxKeyLen = Math.max(4, Math.floor(opts?.maxKeyLen ?? 80));
  const maxValLen = Math.max(4, Math.floor(opts?.maxValLen ?? 200));

  let n = 0;
  for (const k of Object.keys(input)) {
    if (n >= maxKeys) break;
    if (!isSafeKey(k)) continue;
    if (k.length > maxKeyLen) continue;
    const v = (input as any)[k];
    if (typeof v !== "string") continue;
    out[k] = v.slice(0, maxValLen);
    n++;
  }
  return out;
}

export function sanitizeNumber(x: unknown, opts?: { min?: number; max?: number }): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x.trim()) : NaN;
  if (!Number.isFinite(n)) return null;
  const min = opts?.min;
  const max = opts?.max;
  if (typeof min === "number" && n < min) return min;
  if (typeof max === "number" && n > max) return max;
  return n;
}

export function safeStructuredClone<T>(x: T): T {
  // structuredClone is available in modern browsers; fallback strips prototypes via JSON.
  try {
    if (typeof structuredClone === "function") return (structuredClone as typeof globalThis.structuredClone)(x);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(x)) as T;
}

export function sanitizeHistoryBundle(input: unknown): HistoryBundle | null {
  if (!isPlainObject(input)) return null;
  const startYear = sanitizeNumber((input as any).startYear, { min: 1800, max: 2600 });
  const endYear = sanitizeNumber((input as any).endYear, { min: 1800, max: 2600 });
  const byCityRaw = (input as any).byCity;
  const metaRaw = (input as any).meta;
  if (startYear == null || endYear == null) return null;
  if (!isPlainObject(byCityRaw)) return null;

  const allowed = new Set(CITIES.map((c) => c.id));
  const byCity: any = nullProtoObject();
  for (const k of Object.keys(byCityRaw)) {
    if (!isSafeKey(k)) continue;
    if (!allowed.has(k as CityId)) continue;
    const s = (byCityRaw as any)[k];
    if (!isPlainObject(s)) continue;
    const years = Array.isArray((s as any).years) ? (s as any).years.slice(0, 400).map((y: any) => sanitizeNumber(y, { min: 1800, max: 2600 })) : null;
    if (!years || years.some((y: any) => y == null)) continue;
    const n = years.length;
    const pickArr = (name: string) => {
      const a = (s as any)[name];
      if (!Array.isArray(a)) return undefined;
      if (a.length !== n) return undefined;
      return a.map((v: any) => {
        if (v == null) return null;
        const num = sanitizeNumber(v, { min: 0 });
        return num == null ? null : num;
      });
    };
    byCity[k] = {
      years: years as any,
      medianPrice: pickArr("medianPrice"),
      medianAnnualRent: pickArr("medianAnnualRent"),
      medianAnnualWage: pickArr("medianAnnualWage"),
      population: pickArr("population"),
      dwellingStock: pickArr("dwellingStock"),
    };
  }

  // Meta is optional; if present, strip unsafe keys.
  const meta = isPlainObject(metaRaw)
    ? {
        notes: Array.isArray((metaRaw as any).notes) ? (metaRaw as any).notes.slice(0, 50).filter((x: any) => typeof x === "string").map((x: string) => x.slice(0, 240)) : [],
        warnings: Array.isArray((metaRaw as any).warnings) ? (metaRaw as any).warnings.slice(0, 50).filter((x: any) => typeof x === "string").map((x: string) => x.slice(0, 240)) : [],
        byCity: nullProtoObject(),
      }
    : { notes: [], warnings: [], byCity: nullProtoObject() };

  return {
    startYear: startYear as any,
    endYear: endYear as any,
    byCity,
    meta: meta as any,
  } as HistoryBundle;
}

export function sanitizeHistoryBundleWithReport(input: unknown): {
  sanitized: HistoryBundle | null;
  report: {
    ok: boolean;
    droppedCityKeys: number;
    keptCityKeys: number;
    droppedPoints: number;
    cappedPoints: number;
    maxYears: number;
  };
} {
  const maxYears = 400;
  let droppedCityKeys = 0;
  let keptCityKeys = 0;
  let droppedPoints = 0;
  let cappedPoints = 0;

  const sanitized = sanitizeHistoryBundle(input);
  if (!sanitized) {
    return { sanitized: null, report: { ok: false, droppedCityKeys: 0, keptCityKeys: 0, droppedPoints: 0, cappedPoints: 0, maxYears } };
  }

  // Shallow report on byCity coverage.
  const allowed = new Set(CITIES.map((c) => c.id));
  if (isPlainObject((input as any)?.byCity)) {
    Object.keys((input as any).byCity).forEach((k) => {
      if (!isSafeKey(k) || !allowed.has(k as CityId)) droppedCityKeys++;
      else keptCityKeys++;
    });
  }

  // Cap years length in the sanitized object (defensive).
  Object.keys(sanitized.byCity as any).forEach((k) => {
    const s = (sanitized.byCity as any)[k];
    const n = Array.isArray(s?.years) ? s.years.length : 0;
    if (n > maxYears) {
      cappedPoints += n - maxYears;
      s.years = s.years.slice(0, maxYears);
      (["medianPrice", "medianAnnualRent", "medianAnnualWage", "population", "dwellingStock"] as const).forEach((f) => {
        if (Array.isArray(s[f])) s[f] = s[f].slice(0, maxYears);
      });
    }
  });

  return { sanitized, report: { ok: true, droppedCityKeys, keptCityKeys, droppedPoints, cappedPoints, maxYears } };
}
