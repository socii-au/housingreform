/**
 * Validation helpers for city baseline data
 *
 * Checks for plausible ranges to catch data entry errors before
 * they cause silent garbage in charts.
 */

import type { CityBaseState, ScenarioParams } from "./methodology";
import type { CityId, StateId } from "./regions";
import { cityMeta, getCitiesByState, CITIES } from "./regions";

export interface ValidationError {
  cityId: CityId;
  field: string;
  value: number;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface CoverageResult {
  included: CityId[];
  missing: CityId[];
  byState: Record<StateId, { included: CityId[]; missing: CityId[] }>;
  capitalsCovered: boolean;
  majorsCovered: boolean;
  coveragePercent: number;
}

/**
 * Plausible ranges for Australian cities (2024 proxies)
 */
const PLAUSIBLE_RANGES = {
  population: { min: 50_000, max: 10_000_000 },
  netMigrationPerYear: { min: -50_000, max: 200_000 },
  naturalPopGrowthRate: { min: -0.01, max: 0.02 },
  dwellingStock: { min: 20_000, max: 5_000_000 },
  annualCompletions: { min: 200, max: 100_000 },
  demolitionRate: { min: 0, max: 0.02 },
  medianPrice: { min: 200_000, max: 3_000_000 },
  medianAnnualRent: { min: 10_000, max: 80_000 },
  wageIndex: { min: 50, max: 200 },
  cpiIndex: { min: 50, max: 200 },
  mortgageRate: { min: 0.01, max: 0.15 },
  mortgageTermYears: { min: 15, max: 40 },
  investorDwellingShare: { min: 0.10, max: 0.50 },
};

const RATIO_CHECKS = {
  dwellingsPerCapita: { min: 0.30, max: 0.55 },
  grossRentalYield: { min: 0.02, max: 0.08 },
  completionsToStockRatio: { min: 0.005, max: 0.05 },
  migrationToPopRatio: { min: -0.02, max: 0.06 },
};

function checkRange(
  cityId: CityId,
  field: string,
  value: number,
  min: number,
  max: number,
  severity: "error" | "warning" = "error"
): ValidationError | null {
  if (value < min || value > max) {
    return {
      cityId,
      field,
      value,
      message: `${field} = ${value.toLocaleString()} is outside plausible range [${min.toLocaleString()}, ${max.toLocaleString()}]`,
      severity,
    };
  }
  return null;
}

export function validateCityBaseline(city: CityBaseState): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const addIssue = (issue: ValidationError | null) => {
    if (issue) {
      if (issue.severity === "error") {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  };

  const cityId = city.cityId;

  // Basic field ranges
  addIssue(checkRange(cityId, "population", city.population, PLAUSIBLE_RANGES.population.min, PLAUSIBLE_RANGES.population.max));
  addIssue(checkRange(cityId, "netMigrationPerYear", city.netMigrationPerYear, PLAUSIBLE_RANGES.netMigrationPerYear.min, PLAUSIBLE_RANGES.netMigrationPerYear.max));
  addIssue(checkRange(cityId, "naturalPopGrowthRate", city.naturalPopGrowthRate, PLAUSIBLE_RANGES.naturalPopGrowthRate.min, PLAUSIBLE_RANGES.naturalPopGrowthRate.max));
  addIssue(checkRange(cityId, "dwellingStock", city.dwellingStock, PLAUSIBLE_RANGES.dwellingStock.min, PLAUSIBLE_RANGES.dwellingStock.max));
  addIssue(checkRange(cityId, "annualCompletions", city.annualCompletions, PLAUSIBLE_RANGES.annualCompletions.min, PLAUSIBLE_RANGES.annualCompletions.max));
  addIssue(checkRange(cityId, "demolitionRate", city.demolitionRate, PLAUSIBLE_RANGES.demolitionRate.min, PLAUSIBLE_RANGES.demolitionRate.max));
  addIssue(checkRange(cityId, "medianPrice", city.medianPrice, PLAUSIBLE_RANGES.medianPrice.min, PLAUSIBLE_RANGES.medianPrice.max));
  addIssue(checkRange(cityId, "medianAnnualRent", city.medianAnnualRent, PLAUSIBLE_RANGES.medianAnnualRent.min, PLAUSIBLE_RANGES.medianAnnualRent.max));
  addIssue(checkRange(cityId, "wageIndex", city.wageIndex, PLAUSIBLE_RANGES.wageIndex.min, PLAUSIBLE_RANGES.wageIndex.max));
  addIssue(checkRange(cityId, "cpiIndex", city.cpiIndex, PLAUSIBLE_RANGES.cpiIndex.min, PLAUSIBLE_RANGES.cpiIndex.max));
  addIssue(checkRange(cityId, "mortgageRate", city.mortgageRate, PLAUSIBLE_RANGES.mortgageRate.min, PLAUSIBLE_RANGES.mortgageRate.max));
  addIssue(checkRange(cityId, "mortgageTermYears", city.mortgageTermYears, PLAUSIBLE_RANGES.mortgageTermYears.min, PLAUSIBLE_RANGES.mortgageTermYears.max));
  addIssue(checkRange(cityId, "investorDwellingShare", city.investorDwellingShare, PLAUSIBLE_RANGES.investorDwellingShare.min, PLAUSIBLE_RANGES.investorDwellingShare.max));

  // Derived ratio checks (warnings)
  const dwellingsPerCapita = city.dwellingStock / city.population;
  addIssue(
    checkRange(cityId, "dwellingsPerCapita", dwellingsPerCapita, RATIO_CHECKS.dwellingsPerCapita.min, RATIO_CHECKS.dwellingsPerCapita.max, "warning")
  );

  const grossYield = city.medianAnnualRent / city.medianPrice;
  addIssue(
    checkRange(cityId, "grossRentalYield", grossYield, RATIO_CHECKS.grossRentalYield.min, RATIO_CHECKS.grossRentalYield.max, "warning")
  );

  const completionsRatio = city.annualCompletions / city.dwellingStock;
  addIssue(
    checkRange(cityId, "completionsToStockRatio", completionsRatio, RATIO_CHECKS.completionsToStockRatio.min, RATIO_CHECKS.completionsToStockRatio.max, "warning")
  );

  const migrationRatio = city.netMigrationPerYear / city.population;
  addIssue(
    checkRange(cityId, "migrationToPopRatio", migrationRatio, RATIO_CHECKS.migrationToPopRatio.min, RATIO_CHECKS.migrationToPopRatio.max, "warning")
  );

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateAllBaselines(cities: CityBaseState[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  for (const city of cities) {
    const result = validateCityBaseline(city);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  // Check for duplicate city IDs
  const ids = cities.map((c) => c.cityId);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const dup of duplicates) {
    allErrors.push({
      cityId: dup,
      field: "cityId",
      value: 0,
      message: `Duplicate cityId: ${dup}`,
      severity: "error",
    });
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Validate coverage: check which cities/states are included vs missing.
 */
export function validateCoverage(params: ScenarioParams): CoverageResult {
  const includedIds = new Set(params.cities.map((c) => c.cityId));
  const allCityIds = CITIES.map((c) => c.id);

  const included = allCityIds.filter((id) => includedIds.has(id));
  const missing = allCityIds.filter((id) => !includedIds.has(id));

  const allStates: StateId[] = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT", "ACT"];
  const byState = {} as Record<StateId, { included: CityId[]; missing: CityId[] }>;

  for (const state of allStates) {
    const stateCities = getCitiesByState(state);
    byState[state] = {
      included: stateCities.filter((c) => includedIds.has(c.id)).map((c) => c.id),
      missing: stateCities.filter((c) => !includedIds.has(c.id)).map((c) => c.id),
    };
  }

  const capitals = CITIES.filter((c) => c.isCapital);
  const majors = CITIES.filter((c) => c.isMajor);

  const capitalsCovered = capitals.every((c) => includedIds.has(c.id));
  const majorsCovered = majors.every((c) => includedIds.has(c.id));

  const coveragePercent = (included.length / allCityIds.length) * 100;

  return {
    included,
    missing,
    byState,
    capitalsCovered,
    majorsCovered,
    coveragePercent,
  };
}

export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push("✓ All baselines valid");
  } else {
    lines.push("✗ Validation failed:");
  }

  if (result.errors.length > 0) {
    lines.push("\nErrors:");
    for (const err of result.errors) {
      lines.push(`  [${err.cityId}] ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("\nWarnings:");
    for (const warn of result.warnings) {
      lines.push(`  [${warn.cityId}] ${warn.message}`);
    }
  }

  return lines.join("\n");
}

export function formatCoverageResult(result: CoverageResult): string {
  const lines: string[] = [];

  lines.push(`Coverage: ${result.coveragePercent.toFixed(0)}% (${result.included.length}/${result.included.length + result.missing.length} cities)`);
  lines.push(`Capitals covered: ${result.capitalsCovered ? "✓" : "✗"}`);
  lines.push(`All majors covered: ${result.majorsCovered ? "✓" : "✗"}`);

  if (result.missing.length > 0) {
    lines.push(`\nMissing cities: ${result.missing.join(", ")}`);
  }

  return lines.join("\n");
}
