import type { CityId } from "../regions";
import type { TenureType } from "../advanced/microdata";
import type { FieldMapping, RecordLike } from "./importers";

export interface AutodetectResult {
  fields: FieldMapping;
  tenureMap: Record<string, TenureType>;
  confidence: {
    income: number; // 0..1
    tenure: number; // 0..1
    weight: number; // 0..1
  };
  notes: string[];
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
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

function scoreKey(key: string, patterns: RegExp[]): number {
  const k = key.toLowerCase();
  // Perfect match bonus if pattern hits the full token.
  let score = 0;
  patterns.forEach((p) => {
    if (p.test(k)) score += 1;
  });
  // Bias toward simpler canonical names.
  if (k === "income_annual_aud" || k === "hh_income_annual" || k === "gross_income_annual") score += 2;
  if (k === "tenure" || k === "tenure_code" || k === "housing_tenure") score += 2;
  if (k === "weight" || k === "hh_weight" || k === "wgt") score += 2;
  return score;
}

function pickBestKey(keys: string[], patterns: RegExp[]): string | null {
  if (keys.length === 0) return null;
  const scored = keys
    .map((k) => ({ k, s: scoreKey(k, patterns) }))
    .sort((a, b) => b.s - a.s);
  if (scored[0].s <= 0) return null;
  return scored[0].k;
}

function classifyTenure(raw: unknown): TenureType | null {
  const s0 = asString(raw);
  if (!s0) return null;
  const s = s0.toLowerCase();

  // Compact codes (preferred)
  if (s0 === "R" || s === "r") return "renter";
  if (s0 === "M" || s === "m") return "mortgaged";
  if (s0 === "O" || s === "o") return "outright";
  if (s0 === "I" || s === "i") return "investor";

  // Numeric codes sometimes used in cleaned extracts
  if (s === "1") return "renter";
  if (s === "2") return "mortgaged";
  if (s === "3") return "outright";
  if (s === "4") return "investor";

  // Common label patterns
  if (/(rent|renter|renting|tenant|public housing|community housing|social housing)/.test(s)) return "renter";
  if (/(mortg|mortgage|loan|purchas|buyer|buying|paying off)/.test(s)) return "mortgaged";
  if (/(own outright|owned outright|fully owned|no mortgage|owner outright|owner without)/.test(s)) return "outright";
  if (/(landlord|investor)/.test(s)) return "investor";

  // “owner” alone is ambiguous; treat as outright only if it says “without mortgage”
  if (/(owner)/.test(s) && /(without|no)\s+(mortg|mortgage|loan)/.test(s)) return "outright";

  return null;
}

function buildTenureMapFromSample(values: unknown[]): Record<string, TenureType> {
  const out: Record<string, TenureType> = Object.create(null);
  values.forEach((v) => {
    const s = asString(v);
    if (!s) return;
    // Prevent prototype pollution keys
    if (s === "__proto__" || s === "constructor" || s === "prototype") return;
    const t = classifyTenure(s);
    if (!t) return;
    // Map both raw and lowercased to increase hit rate.
    out[s] = t;
    const low = s.toLowerCase();
    if (low !== "__proto__" && low !== "constructor" && low !== "prototype") out[low] = t;
  });

  // Always include the canonical compact mapping.
  out.R = "renter";
  out.M = "mortgaged";
  out.O = "outright";
  out.I = "investor";

  return out;
}

function evaluateIncomeColumn(rows: RecordLike[], k: string): { ok: boolean; conf: number; note?: string } {
  const vals = rows.slice(0, 4000).map((r) => asNumber(r[k])).filter((x): x is number => x !== null);
  if (vals.length < 20) return { ok: false, conf: 0, note: `income candidate ${k} has too few numeric values` };
  const pos = vals.filter((v) => v > 0).length / vals.length;
  const median = vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  // Gross annual household income in AUD should usually be in the tens of thousands.
  const plausibleScale = median >= 15_000 && median <= 250_000;
  const conf = clamp01(0.4 * pos + 0.6 * (plausibleScale ? 1 : 0));
  return { ok: conf >= 0.45, conf, note: plausibleScale ? undefined : `income median for ${k} looks off-scale (${median})` };
}

function evaluateWeightColumn(rows: RecordLike[], k: string): { ok: boolean; conf: number } {
  const vals = rows.slice(0, 4000).map((r) => asNumber(r[k])).filter((x): x is number => x !== null);
  if (vals.length < 20) return { ok: false, conf: 0 };
  const nonneg = vals.filter((v) => v >= 0).length / vals.length;
  // weights often > 1, sometimes fractional; just require non-negative and some variation
  const distinct = new Set(vals.map((v) => Math.round(v * 1e6) / 1e6)).size;
  const varied = distinct > 5;
  const conf = clamp01(0.7 * nonneg + 0.3 * (varied ? 1 : 0));
  return { ok: conf >= 0.5, conf };
}

function evaluateTenureColumn(rows: RecordLike[], k: string): { ok: boolean; conf: number; tenureMap: Record<string, TenureType> } {
  const vals = rows.slice(0, 4000).map((r) => r[k]);
  const mapped = vals.map(classifyTenure).filter((t): t is TenureType => !!t);
  const conf = clamp01(mapped.length / Math.max(1, vals.length));
  const tenureMap = buildTenureMapFromSample(vals);
  return { ok: conf >= 0.25, conf, tenureMap };
}

export function autodetectMicrodataSchema(rows: RecordLike[]): AutodetectResult {
  const notes: string[] = [];
  const keys = Array.from(
    new Set(
      rows
        .slice(0, 200)
        .flatMap((r) => Object.keys(r ?? {}))
        .filter((k) => typeof k === "string" && k.length > 0)
    )
  );

  const incomeKey =
    pickBestKey(keys, [/income/, /gross/, /hhinc/, /household.*income/, /tot.*inc/, /inc.*annual/, /fincome/]) ??
    pickBestKey(keys, [/inc/]);

  const tenureKey =
    pickBestKey(keys, [/tenure/, /housing.*tenure/, /own/, /ownership/, /mortg/, /rent/]) ??
    pickBestKey(keys, [/ten/]);

  const weightKey =
    pickBestKey(keys, [/weight/, /wgt/, /hh.*wgt/, /survey.*weight/, /hh_weight/, /popwgt/]) ??
    null;

  if (!incomeKey) notes.push("Could not confidently infer income column from keys; defaulting to income_annual_aud.");
  if (!tenureKey) notes.push("Could not confidently infer tenure column from keys; defaulting to tenure_code.");

  const income = incomeKey ? evaluateIncomeColumn(rows, incomeKey) : { ok: false, conf: 0 };
  const tenureEval = tenureKey
    ? evaluateTenureColumn(rows, tenureKey)
    : { ok: false, conf: 0, tenureMap: { R: "renter" as TenureType, M: "mortgaged" as TenureType, O: "outright" as TenureType, I: "investor" as TenureType } };
  const weight = weightKey ? evaluateWeightColumn(rows, weightKey) : { ok: false, conf: 0 };

  if (incomeKey && income.note) notes.push(income.note);
  if (incomeKey && !income.ok) notes.push(`Income detection low confidence for key '${incomeKey}'.`);
  if (tenureKey && !tenureEval.ok) notes.push(`Tenure detection low confidence for key '${tenureKey}'.`);
  if (weightKey && !weight.ok) notes.push(`Weight detection low confidence for key '${weightKey}'.`);
  if (!weightKey) notes.push("No weight column detected; weights will default to 1.");

  return {
    fields: {
      incomeField: incomeKey ?? "income_annual_aud",
      tenureField: tenureKey ?? "tenure_code",
      ...(weightKey ? { weightField: weightKey } : {}),
    },
    tenureMap: tenureEval.tenureMap,
    confidence: {
      income: income.conf ?? 0,
      tenure: tenureEval.conf ?? 0,
      weight: weight.conf ?? 0,
    },
    notes,
  };
}

export function autodetectFromByCity(opts: {
  byCity: Partial<Record<CityId, RecordLike[]>>;
}): AutodetectResult {
  // Pool up to ~3k rows across cities for a stable global inference.
  const pooled: RecordLike[] = [];
  (Object.keys(opts.byCity) as CityId[]).some((city) => {
    const rows = opts.byCity[city];
    if (!rows || rows.length === 0) return false;
    pooled.push(...rows.slice(0, 500));
    return pooled.length >= 3000;
  });
  return autodetectMicrodataSchema(pooled.length ? pooled : []);
}

