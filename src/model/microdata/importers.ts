import type { CityId } from "../regions";
import type { MicroRecord, TenureType } from "../advanced/microdata";

export type RecordLike = Record<string, unknown>;

export interface FieldMapping {
  incomeField: string;
  tenureField: string;
  weightField?: string;
}

export interface TenureMapping {
  /**
   * Map raw tenure codes/strings to canonical tenure types.
   * Unmapped values are dropped.
   */
  map: Record<string, TenureType>;
}

function asNumber(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asString(x: unknown): string | null {
  if (typeof x === "string") return x.trim();
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  return null;
}

function buildMapper(opts: { fields: FieldMapping; tenure: TenureMapping }) {
  const { fields, tenure } = opts;
  return (r: RecordLike): MicroRecord | null => {
    const income = asNumber(r[fields.incomeField]);
    const tRaw = asString(r[fields.tenureField]);
    if (!income || income <= 0 || !tRaw) return null;
    const tenureType = tenure.map[tRaw] ?? tenure.map[tRaw.toLowerCase?.() ?? tRaw];
    if (!tenureType) return null;

    const weight = fields.weightField ? asNumber(r[fields.weightField]) : null;
    return {
      income,
      tenure: tenureType,
      ...(weight && weight > 0 ? { weight } : {}),
    };
  };
}

/**
 * ABS SIH/CSHCV-derived adapter.
 *
 * Because ABS/HILDA extracts vary a lot by researcher pipeline, this adapter is
 * mapping-driven rather than hard-coding variable names.
 */
export function fromABS(opts: {
  byCity: Partial<Record<CityId, RecordLike[]>>;
  fields: FieldMapping;
  tenure: TenureMapping;
}): { byCity: Partial<Record<CityId, MicroRecord[]>>; dropped: Record<CityId, number> } {
  const out: Partial<Record<CityId, MicroRecord[]>> = Object.create(null);
  const dropped: Record<CityId, number> = {} as Record<CityId, number>;
  const map = buildMapper({ fields: opts.fields, tenure: opts.tenure });

  Object.entries(opts.byCity).forEach(([k, rows]) => {
    const city = k as CityId;
    if (k === "__proto__" || k === "constructor" || k === "prototype") return;
    if (!rows) return;
    const kept: MicroRecord[] = [];
    let drop = 0;
    rows.forEach((r) => {
      const rec = map(r);
      if (rec) kept.push(rec);
      else drop++;
    });
    out[city] = kept;
    dropped[city] = drop;
  });

  return { byCity: out, dropped };
}

/**
 * HILDA adapter (mapping-driven).
 *
 * Typical HILDA extracts are household-level or person-level; for stress modelling
 * you usually want household income (equivalised or not). This adapter assumes
 * the income field is already annual household income in AUD.
 */
export function fromHILDA(opts: {
  byCity: Partial<Record<CityId, RecordLike[]>>;
  fields: FieldMapping;
  tenure: TenureMapping;
}): { byCity: Partial<Record<CityId, MicroRecord[]>>; dropped: Record<CityId, number> } {
  // Same mapper; kept separate so we can evolve HILDA-specific validations later.
  return fromABS(opts);
}

/**
 * Handy default tenure mappings you can start with and override.
 */
export const DEFAULT_TENURE_MAPS = {
  /**
   * Common string labels (from cleaned datasets).
   */
  strings: {
    map: {
      renter: "renter",
      rent: "renter",
      "private renter": "renter",
      "public renter": "renter",
      "social renter": "renter",
      "community housing": "renter",
      mortgaged: "mortgaged",
      mortgage: "mortgaged",
      owner: "outright",
      outright: "outright",
      investor: "investor",
      // Recommended compact codes
      R: "renter",
      M: "mortgaged",
      O: "outright",
      I: "investor",
    } as Record<string, TenureType>,
  } satisfies TenureMapping,
};

