import type { CityId } from "../regions";

export type TenureType = "renter" | "mortgaged" | "outright" | "investor";

export interface MicroRecord {
  income: number; // annual household income (AUD)
  tenure: TenureType;
  weight?: number; // optional survey weight
}

export type MicrodataByCity = Partial<Record<CityId, MicroRecord[]>>;

export function isMicroRecord(x: unknown): x is MicroRecord {
  if (!x || typeof x !== "object") return false;
  const r = x as any;
  return (
    typeof r.income === "number" &&
    Number.isFinite(r.income) &&
    r.income > 0 &&
    (r.tenure === "renter" || r.tenure === "mortgaged" || r.tenure === "outright" || r.tenure === "investor") &&
    (r.weight === undefined || (typeof r.weight === "number" && Number.isFinite(r.weight) && r.weight >= 0))
  );
}

export function extractCityMicrodata(input: unknown, cityId: CityId): MicroRecord[] | null {
  if (!input) return null;

  // Allow either:
  // - { byCity: { SYD: [...] } }
  // - { SYD: [...] }
  const obj = input as any;
  const candidate = (obj.byCity?.[cityId] ?? obj[cityId]) as unknown;
  if (!Array.isArray(candidate)) return null;

  const rows = candidate.filter(isMicroRecord);
  if (rows.length < 20) return null;
  return rows;
}

