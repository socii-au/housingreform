import type { CityBaseState, CoreConstants } from "../methodology";
import type { CityId } from "../regions";
import type { MicroRecord, TenureType } from "../advanced/microdata";
import { fromABS, fromHILDA, DEFAULT_TENURE_MAPS, type FieldMapping, type RecordLike } from "./importers";
import { generateSyntheticMicrodataBundle } from "./synthetic";
import { mixRealAndSynthetic, reweightTenureShares } from "./reinforce";
import { autodetectFromByCity } from "./autodetect";

export type MicroSource = "abs" | "hilda" | "synthetic" | "mixed";

export interface BuildMicrodataOptions {
  source: MicroSource;
  cities: CityBaseState[];
  c: CoreConstants;

  // For abs/hilda/mixed
  rawByCity?: Partial<Record<CityId, RecordLike[]>>;
  fields?: FieldMapping;
  tenureMap?: Record<string, TenureType>;

  // For synthetic/mixed
  nPerCity?: number;
  seed?: number;

  // For mixed
  realWeightShare?: number;

  // Optional reweighting targets
  tenureTargetsByCity?: Partial<Record<CityId, Partial<Record<TenureType, number>>>>;
}

export function buildMicrodataBundle(opts: BuildMicrodataOptions): {
  byCity: Partial<Record<CityId, MicroRecord[]>>;
  meta: {
    source: MicroSource;
    notes: string[];
    warnings: string[];
    inferredMappings: boolean;
    confidence?: {
      income: number;
      tenure: number;
      weight: number;
    };
  };
} {
  const notes: string[] = [];
  const warnings: string[] = [];
  const tenure = { map: opts.tenureMap ?? DEFAULT_TENURE_MAPS.strings.map };
  let inferredMappings = false;
  let confidence: { income: number; tenure: number; weight: number } | undefined;

  const warnCoverage = (rawByCity: Partial<Record<CityId, RecordLike[]>>) => {
    const expected = opts.cities.map((c) => c.cityId);
    const present = expected.filter((id) => Array.isArray(rawByCity[id]) && (rawByCity[id]?.length ?? 0) > 0);
    if (present.length < expected.length) {
      warnings.push(
        `Microdata missing for ${expected.length - present.length}/${expected.length} included cities. Missing cities will fall back to proxy stress calculations.`
      );
    }
  };

  const warnIncomeUnits = (byCity: Partial<Record<CityId, MicroRecord[]>>) => {
    const all = Object.values(byCity)
      .flatMap((xs) => (Array.isArray(xs) ? xs : []))
      .map((r) => r.income)
      .filter((x) => Number.isFinite(x) && x > 0)
      .slice(0, 5000);
    if (all.length < 50) return;
    const sorted = all.slice().sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    if (med < 8_000) {
      warnings.push(
        `Microdata income median looks too low (${Math.round(med)}). Ensure income is gross annual household AUD (not weekly/monthly).`
      );
    }
    if (med > 400_000) {
      warnings.push(
        `Microdata income median looks very high (${Math.round(med)}). Verify units and that income is gross annual household AUD.`
      );
    }
  };

  const synth = () =>
    generateSyntheticMicrodataBundle({
      cities: opts.cities,
      c: opts.c,
      nPerCity: opts.nPerCity ?? 2000,
      seed: opts.seed ?? 12345,
    });

  if (opts.source === "synthetic") {
    notes.push("Synthetic microdata generated (lognormal incomes + tenure shares anchored to constants).");
    return { byCity: synth().byCity, meta: { source: opts.source, notes, warnings, inferredMappings } };
  }

  if (opts.source === "abs" || opts.source === "hilda") {
    if (!opts.rawByCity) {
      throw new Error(`buildMicrodataBundle: rawByCity is required for source=${opts.source}`);
    }

    const inferred = (!opts.fields || !opts.tenureMap) ? autodetectFromByCity({ byCity: opts.rawByCity }) : null;
    const fields = opts.fields ?? inferred?.fields;
    const tenure2 = { map: opts.tenureMap ?? inferred?.tenureMap ?? tenure.map };
    if (!fields) {
      throw new Error(`buildMicrodataBundle: could not infer fields for source=${opts.source}`);
    }
    if (inferred) {
      inferredMappings = true;
      confidence = inferred.confidence;
      notes.push(
        `Autodetected fields: income='${fields.incomeField}', tenure='${fields.tenureField}'` +
          (fields.weightField ? `, weight='${fields.weightField}'` : ", weight=default(1)")
      );
      inferred.notes.forEach((n) => notes.push(`Autodetect: ${n}`));

      // Warnings that matter for correctness.
      if ((inferred.confidence.income ?? 0) < 0.6) {
        warnings.push(
          `Microdata mapping inferred '${fields.incomeField}' as income with low confidence. Confirm this is gross annual household income in AUD (or set fields explicitly).`
        );
      }
      if ((inferred.confidence.tenure ?? 0) < 0.5) {
        warnings.push(
          `Microdata mapping inferred '${fields.tenureField}' as tenure with low confidence. Prefer exporting tenure_code as R/M/O (or set tenureMap explicitly).`
        );
      }
      if (fields.weightField && (inferred.confidence.weight ?? 0) < 0.6) {
        warnings.push(
          `Microdata mapping inferred '${fields.weightField}' as weight with low confidence. If unsure, omit weights (defaults to 1).`
        );
      }
    }
    const parsed =
      opts.source === "abs"
        ? fromABS({ byCity: opts.rawByCity, fields, tenure: tenure2 })
        : fromHILDA({ byCity: opts.rawByCity, fields, tenure: tenure2 });
    notes.push(`${opts.source.toUpperCase()} microdata mapped into canonical MicroRecord rows.`);
    warnCoverage(opts.rawByCity);
    const final = maybeReweight(parsed.byCity, opts.tenureTargetsByCity, notes).byCity;
    warnIncomeUnits(final);
    return {
      byCity: final,
      meta: { source: opts.source, notes, warnings, inferredMappings, confidence },
    };
  }

  // mixed
  if (!opts.rawByCity) {
    throw new Error("buildMicrodataBundle: rawByCity is required for source=mixed");
  }
  const inferred = (!opts.fields || !opts.tenureMap) ? autodetectFromByCity({ byCity: opts.rawByCity }) : null;
  const fields = opts.fields ?? inferred?.fields;
  const tenure2 = { map: opts.tenureMap ?? inferred?.tenureMap ?? tenure.map };
  if (!fields) {
    throw new Error("buildMicrodataBundle: could not infer fields for source=mixed");
  }
  if (inferred) {
    inferredMappings = true;
    confidence = inferred.confidence;
    notes.push(
      `Autodetected fields: income='${fields.incomeField}', tenure='${fields.tenureField}'` +
        (fields.weightField ? `, weight='${fields.weightField}'` : ", weight=default(1)")
    );
    inferred.notes.forEach((n) => notes.push(`Autodetect: ${n}`));

    if ((inferred.confidence.income ?? 0) < 0.6) {
      warnings.push(
        `Microdata mapping inferred '${fields.incomeField}' as income with low confidence. Confirm this is gross annual household income in AUD (or set fields explicitly).`
      );
    }
    if ((inferred.confidence.tenure ?? 0) < 0.5) {
      warnings.push(
        `Microdata mapping inferred '${fields.tenureField}' as tenure with low confidence. Prefer exporting tenure_code as R/M/O (or set tenureMap explicitly).`
      );
    }
    if (fields.weightField && (inferred.confidence.weight ?? 0) < 0.6) {
      warnings.push(
        `Microdata mapping inferred '${fields.weightField}' as weight with low confidence. If unsure, omit weights (defaults to 1).`
      );
    }
  }
  const real = fromABS({ byCity: opts.rawByCity, fields, tenure: tenure2 }).byCity;
  const syn = synth().byCity;
  notes.push("Mixed microdata: combining real survey rows with synthetic reinforcement.");
  const mixed = mixRealAndSynthetic({
    realByCity: real,
    syntheticByCity: syn,
    realWeightShare: opts.realWeightShare ?? 0.7,
  }).byCity;
  const rew = maybeReweight(mixed, opts.tenureTargetsByCity, notes);
  warnCoverage(opts.rawByCity);
  warnIncomeUnits(rew.byCity);
  return { byCity: rew.byCity, meta: { source: opts.source, notes, warnings, inferredMappings, confidence } };
}

function maybeReweight(
  byCity: Partial<Record<CityId, MicroRecord[]>>,
  targets: BuildMicrodataOptions["tenureTargetsByCity"],
  notes: string[]
): { byCity: Partial<Record<CityId, MicroRecord[]>> } {
  if (!targets) return { byCity };
  notes.push("Applied tenure-share reweighting (weights only; incomes unchanged).");
  return reweightTenureShares({ byCity, targets });
}

