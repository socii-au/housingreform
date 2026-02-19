/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * AIM-HR — Methodology + Core Assumptions
 *
 * - All constants, curves, default parameters, and core formulas live here.
 * - Scenario logic should call into these helpers rather than duplicating math.
 *
 * Units & conventions:
 * - Money: AUD (nominal), unless stated otherwise.
 * - Rates: decimals (e.g., 0.055 = 5.5%).
 * - Time step: annual.
 */

import type { CityId } from "./regions";
import type { RatePathConfig } from "./ratePath";

export type Year = number;

/**
 * Model engine selection.
 *
 * - "aggregate": current fast, shape-first model (per-city independent; aggregate afterwards)
 * - "advanced": coupled multi-city run with heterogeneous expectations, portfolio effects,
 *   and optional spatial equilibrium migration reallocations.
 */
export type ModelEngine = "aggregate" | "advanced";

export type ExpectationModelName = "adaptive" | "fundamentals" | "mixed";

export interface ExpectationsConfig {
  enabled: boolean;
  model: ExpectationModelName;
  /**
   * Heterogeneity (mixture weights). Interpreted as shares of agent types.
   * Must sum ~1.0 (we normalize defensively).
   */
  agentMix?: {
    extrapolators: number;
    fundamentals: number;
    meanReverters: number;
  };
  /**
   * How strongly expectations extrapolate recent price growth.
   * (Used by "adaptive" / "mixed".)
   */
  extrapolationStrength?: number; // 0..1
  /**
   * Speed of mean reversion in expectations (used by "mixed".)
   */
  meanReversionStrength?: number; // 0..1
}

export interface PortfolioConfig {
  enabled: boolean;
  /**
   * Alternative annual return (outside housing) used for investor allocation.
   */
  outsideReturn?: number; // e.g. 0.04
  /**
   * Sensitivity of investor demand to expected excess return.
   * Higher = more volatile investor participation.
   */
  demandSensitivity?: number; // e.g. 3..10
  /**
   * Risk penalty applied to high expected volatility (placeholder).
   */
  riskAversion?: number; // e.g. 0..3
}

export interface SpatialEquilibriumConfig {
  enabled: boolean;
  /**
   * Migration reallocation sensitivity to utility differences.
   * Higher => stronger re-sorting across cities.
   */
  migrationSensitivity?: number; // e.g. 0.5..3
  /**
   * Utility weights (placeholder but explicit).
   */
  utilityWeights?: {
    logWage: number; // positive
    logHousingCost: number; // negative
    amenity: number; // positive/negative
  };
  /**
   * City-level amenity shifters. If missing, defaults to 0.
   */
  amenityByCity?: Partial<Record<CityId, number>>;
  /**
   * Minimum share of national net migration each city keeps (friction).
   */
  floorShare?: number; // 0..1
}

/**
 * Tenure-specific micro distribution configuration.
 * If not provided, the model falls back to the existing decile proxy.
 */
export interface MicroDistributionConfig {
  enabled: boolean;
  /**
   * Optional microdata sample (synthetic or imported) used to compute stress rates.
   * Keep this shape flexible; we validate lightly in helpers.
   */
  microdata?: unknown;
}

export interface CalibrationConfig {
  enabled: boolean;
  /**
   * Historical targets by city used to estimate/validate elasticities.
   * This is a hook; actual ingestion is up to the caller.
   */
  historyByCity?: Partial<
    Record<
      CityId,
      {
        years: Year[];
        medianPrice?: number[];
        medianAnnualRent?: number[];
        medianAnnualWage?: number[];
        population?: number[];
        dwellingStock?: number[];
      }
    >
  >;
  /**
   * Preferred history container for past→present overlays and calibration.
   * This supports missing values + explicit imputation metadata.
   */
  historyBundle?: unknown;
  /**
   * Parameter bounds for estimation/validation.
   * Keys map to named parameters in the calibrator.
   */
  bounds?: Record<string, { min: number; max: number }>;
}

export interface AdvancedModelConfig {
  expectations?: ExpectationsConfig;
  portfolio?: PortfolioConfig;
  spatialEquilibrium?: SpatialEquilibriumConfig;
  microDistributions?: MicroDistributionConfig;
  calibration?: CalibrationConfig;
}

export type CurveName =
  | "priceSupplyGap"
  | "rentSupplyGap"
  | "constructionResponse"
  | "migrationResponse"
  | "wageGrowth"
  | "inflation"
  | "investorDemandShock"
  | "rentalSupplyShockFromDivestment";

export interface Curves {
  priceSupplyGap: (supplyGapRatio: number) => number;
  rentSupplyGap: (supplyGapRatio: number) => number;
  constructionResponse: (expectedPriceGrowth: number) => number;
  migrationResponse: (housingCostIndexDelta: number) => number;

  wageGrowth: (year: Year, base: number) => number;
  inflation: (year: Year, base: number) => number;

  /**
   * Maps policy intensity (0..1) into investor demand reduction (0..something).
   */
  investorDemandShock: (policyIntensity01: number) => number;

  /**
   * When investors are forced to divest, some rentals become owner-occupied,
   * reducing rental supply.
   */
  rentalSupplyShockFromDivestment: (divestedDwellingsShareOfStock: number) => number;
}

export interface CoreConstants {
  personsPerHousehold: number;
  renterShare: number;
  mortgagedOwnerShare: number;
  typicalLVR: number;
  marketAdjustmentSpeed: number;

  caps: {
    maxNominalPriceGrowth: number;
    maxNominalRentGrowth: number;
    minNominalPriceGrowth: number;
    minNominalRentGrowth: number;
  };

  stampDutyEffectiveRate: number;
  annualTurnoverRate: number;

  gdpHousingServicesShareBaseline: number;

  mortgageStressShareOfIncome: number;
  rentStressShareOfIncome: number;

  divestmentToOwnerOccupierShare: number;
  maxDivestmentSharePerYear: number;

  /**
   * Real-world construction capacity constraints (shape-first but bounded).
   * Caps how quickly annual completions can change year-to-year.
   */
  constructionCapacity: {
    maxCompletionsYoYIncrease: number; // e.g. 0.12 = +12% per year
    maxCompletionsYoYDecrease: number; // e.g. 0.25 = -25% per year
  };
}

export interface CityBaseState {
  cityId: CityId;
  cityName: string;

  year0: Year;

  population: number;
  netMigrationPerYear: number;
  naturalPopGrowthRate: number;

  dwellingStock: number;
  annualCompletions: number;
  demolitionRate: number;

  medianPrice: number;
  medianAnnualRent: number;
  /**
   * Optional baseline nominal rent growth (e.g., 0.035 = 3.5%/yr).
   * If omitted, defaults are inferred from history or a conservative proxy.
   */
  rentGrowthBaseline?: number;
  /** Rent sensitivity to investor demand shocks (per 1.0 shock). */
  rentElasticityToInvestorDemand?: number;
  /** Rent sensitivity to supply growth delta (per 1.0 delta). */
  rentElasticityToSupply?: number;
  /** Rent sensitivity to population growth delta (per 1.0 delta). */
  rentElasticityToPopulation?: number;
  /** Rent sensitivity to wage growth delta (per 1.0 delta). */
  rentElasticityToWage?: number;

  /** Median annual full-time wage for this city (AUD) */
  medianAnnualWage: number;
  /** Expected annual wage growth rate (e.g., 0.03 = 3%) */
  wageGrowthRate: number;

  wageIndex: number;
  cpiIndex: number;

  mortgageRate: number;
  mortgageTermYears: number;

  weight?: number;

  investorDwellingShare: number;

  /** Insurance: annual base premium (ex tax) for owner-occupiers. */
  annualHomeInsuranceBase?: number;
  /** Insurance: annual base premium (ex tax) for landlords. */
  annualLandlordInsuranceBase?: number;
  /** Insurance: baseline inflation for premiums (typically CPI). */
  insuranceInflationBaseline?: number;
  /** Insurance: additional claims inflation above CPI. */
  insuranceClaimsInflationPremium?: number;
  /** Insurance: climate trend (annual, before multiplier). */
  insuranceClimateTrend?: number;
  /** Insurance: location-specific climate risk multiplier. */
  climateRiskMultiplier?: number;
  /** Insurance: effective tax/levy rate on premiums. */
  insuranceTaxRateEffective?: number;
}

export type NegativeGearingMode = "none" | "remove" | "reverse";

export interface PolicyLevers {
  supplyBoost: number;
  demandReduction: number;

  stampDutyRateDelta: number;
  mortgageRateDelta: number;

  rentGrowthModifier: number;

  negativeGearingMode: NegativeGearingMode;
  negativeGearingIntensity: number;

  ownershipCapEnabled: boolean;
  ownershipCapEnforcement: number;
  excessInvestorStockShare: number;
  divestmentPhased: boolean;

  rampYears: number;
}

export interface TaxInvestorLevers {
  /** Change in CGT discount in percentage points (e.g., -0.50 = full repeal of 50% discount, -0.25 = 25pp reduction). */
  cgtDiscountDelta: number;
  /** Transition share from stamp duty to land tax (0..1). */
  landTaxShift: number;
  /** Vacancy/under-utilisation policy intensity (0..1). */
  vacancyTaxIntensity: number;
  /** Short-stay regulation intensity (0..1). */
  shortStayRegulationIntensity: number;
  /** Foreign buyer restriction intensity (0..1). */
  foreignBuyerRestrictionIntensity: number;
}

export interface CreditLevers {
  /** Serviceability buffer delta in rate terms (e.g., +0.01 = +1pp). */
  serviceabilityBufferDelta: number;
  /** Debt-to-income cap tightness (0..1). */
  dtiCapTightness: number;
  /** Investor lending limit tightness (0..1). */
  investorLendingLimitTightness: number;
}

export interface SubsidyLevers {
  /** First-home buyer subsidy intensity (0..1). */
  firstHomeBuyerSubsidyIntensity: number;
}

export interface RentalLevers {
  /** Rent assistance expansion intensity (0..1). */
  rentAssistanceIntensity: number;
  /** Optional nominal rent growth cap (e.g., 0.03 = +3%/yr). */
  rentRegulationCap: number | null;
  /** Share of rental market under regulation (0..1). */
  rentRegulationCoverage: number;
  /** If false, caps persist on turnover (more restrictive). */
  vacancyDecontrol: boolean;
}

export interface PlanningLevers {
  /** Upzoning / planning reform intensity (0..1). */
  upzoningIntensity: number;
  /** Enabling infrastructure intensity (0..1). */
  infrastructureEnablement: number;
  /** Lag (years) before infrastructure enablement shows up in capacity. */
  infrastructureLagYears: number;
}

export interface PublicCommunityLevers {
  /** Boost to completions from public/community build programs (share of baseline completions). */
  publicHousingBuildBoost: number;
  /** Acquisition share of existing stock per year (0..1). */
  publicHousingAcquisitionSharePerYear: number;
  /** Conversion share of private rental stock to social per year (0..1). */
  conversionToSocialSharePerYear: number;
}

export interface MigrationLevers {
  /** National net overseas migration shock applied to baseline migration (e.g., -0.1 = -10%). */
  netOverseasMigrationShock: number;
}

/**
 * Policy levers v2: extends v1 with grouped policy families.
 * Backwards-compatible: existing UI/model can keep reading v1 fields.
 */
export interface PolicyLeversV2 extends PolicyLevers {
  taxInvestor: TaxInvestorLevers;
  credit: CreditLevers;
  subsidies: SubsidyLevers;
  rental: RentalLevers;
  planning: PlanningLevers;
  publicCommunity: PublicCommunityLevers;
  migration: MigrationLevers;
}

export interface ScenarioParams {
  years: number;

  /**
   * Now: provide baselines for all major cities you want included.
   * (Capitals + other majors).
   */
  cities: CityBaseState[];

  policy: PolicyLevers | PolicyLeversV2;

  /**
   * Optional interest-rate path configuration (RBA-style scenarios or rules).
   */
  ratePath?: RatePathConfig;

  /**
   * Engine selection. Defaults to "aggregate" (backwards-compatible).
   */
  engine?: ModelEngine;

  /**
   * Optional advanced model configuration. Only used when engine === "advanced".
   */
  advanced?: AdvancedModelConfig;

  constants?: Partial<CoreConstants>;
  curves?: Partial<Curves>;
}

export const DEFAULT_CONSTANTS: CoreConstants = {
  personsPerHousehold: 2.5,
  renterShare: 0.31,
  mortgagedOwnerShare: 0.36,
  typicalLVR: 0.80,
  marketAdjustmentSpeed: 0.45,
  caps: {
    maxNominalPriceGrowth: 0.12,
    maxNominalRentGrowth: 0.10,
    minNominalPriceGrowth: -0.10,
    minNominalRentGrowth: -0.08,
  },
  stampDutyEffectiveRate: 0.035,
  annualTurnoverRate: 0.055,
  gdpHousingServicesShareBaseline: 0.10,
  mortgageStressShareOfIncome: 0.30,
  rentStressShareOfIncome: 0.30,
  divestmentToOwnerOccupierShare: 0.70,
  maxDivestmentSharePerYear: 0.03,
  constructionCapacity: {
    // Sustained growth above ~10–15%/yr is typically constrained by labour/materials/pipeline.
    maxCompletionsYoYIncrease: 0.12,
    // Downturns/cancellations can hit faster than growth.
    maxCompletionsYoYDecrease: 0.25,
  },
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function softsign(x: number): number {
  return x / (1 + Math.abs(x));
}

/**
 * Soft floor: replaces a hard clamp with a smooth curve that approaches but
 * rarely reaches the hard floor. Uses softsign compression below a threshold.
 *
 * - Above `threshold`: returns x unchanged.
 * - Below `threshold`: compresses toward `floor` using softsign (x/(1+|x|)).
 * - Result asymptotically approaches `floor` but never reaches it.
 *
 * This prevents clustering where many cities hit the same hard clamp and
 * produce identical CAGRs.
 */
function softFloor(x: number, threshold: number, floor: number): number {
  if (x >= threshold) return x;
  const range = threshold - floor;
  if (range <= 0) return x;
  const t = (threshold - x) / range;
  return threshold - range * t / (1 + t);
}

export const DEFAULT_CURVES: Curves = {
  priceSupplyGap: (gap) => {
    const g = clamp(gap, -0.10, 0.10);
    const shortage = Math.max(0, g);
    const surplus = Math.min(0, g);

    // Dampened coefficients to prevent runaway compounding over 20+ years.
    // Max shortage contribution ~0.16 at gap=+10%, vs previous ~0.50.
    const shortageBoost = 1.2 * shortage + 4 * shortage * shortage;
    const surplusDrag = 1.4 * surplus;
    return shortageBoost + surplusDrag;
  },

  rentSupplyGap: (gap) => {
    const g = clamp(gap, -0.10, 0.10);
    // Dampened: max ~0.11 at gap=+10%, vs previous ~0.30.
    const shortageBoost = 0.8 * Math.max(0, g) + 3 * Math.max(0, g) ** 2;
    const surplusDrag = 1.0 * Math.min(0, g);
    return shortageBoost + surplusDrag;
  },

  constructionResponse: (expectedPriceGrowth) => {
    const x = clamp(expectedPriceGrowth, -0.15, 0.25);
    const m = 1 + 1.8 * softsign(4 * x);
    return clamp(m, 0.7, 1.6);
  },

  migrationResponse: (housingCostIndexDelta) => {
    const d = clamp(housingCostIndexDelta, -0.20, 0.20);
    return -0.15 * d;
  },

  wageGrowth: (_year, base) => base,
  inflation: (_year, base) => base,

  investorDemandShock: (policyIntensity01) => {
    const x = clamp(policyIntensity01, 0, 1);
    return 0.05 * x + 0.12 * x * x;
  },

  rentalSupplyShockFromDivestment: (divestedShare) => {
    const s = clamp(divestedShare, 0, 0.10);
    return 0.85 * s;
  },
};

export function householdsFromPopulation(population: number, c: CoreConstants): number {
  return population / Math.max(0.1, c.personsPerHousehold);
}

export function amortizedAnnualPayment(opts: {
  principal: number;
  annualRate: number;
  termYears: number;
}): number {
  const { principal, annualRate, termYears } = opts;
  const r = annualRate;
  const n = termYears;
  if (n <= 0) return principal;
  if (r <= 0) return principal / n;
  const factor = (r * (1 + r) ** n) / ((1 + r) ** n - 1);
  return principal * factor;
}

export function effectiveDemandHouseholds(households: number, policy: PolicyLevers): number {
  // Keep in plausible policy range. Larger changes usually require macro shocks.
  const dr = clamp(policy.demandReduction, -0.05, 0.15);
  return households * (1 - dr);
}

export function supplyGapRatio(opts: {
  demandHouseholds: number;
  dwellingStock: number;
}): number {
  const { demandHouseholds, dwellingStock } = opts;
  if (dwellingStock <= 0) return 0;
  return (demandHouseholds - dwellingStock) / dwellingStock;
}

/**
 * Affordability feedback: when PTI is very high, demand self-corrects
 * (buyers priced out), dampening further price growth.
 * Returns a multiplier 0..1 applied to the gap signal.
 */
export function affordabilityDamping(opts: {
  medianPrice: number;
  medianAnnualWage: number;
}): number {
  const pti = opts.medianPrice / Math.max(1, opts.medianAnnualWage);
  // Below 8x: no damping. 8x-16x: linear ramp. Above 16x: 70% damped.
  if (pti <= 8) return 1;
  if (pti >= 16) return 0.3;
  return 1 - 0.7 * ((pti - 8) / 8);
}

/**
 * Price floor: prevents prices from falling below construction cost / land floor.
 * Returns a growth floor that softens as PTI approaches ~4x.
 */
export function priceFloorGrowth(opts: {
  medianPrice: number;
  medianAnnualWage: number;
  inflation: number;
}): number {
  const pti = opts.medianPrice / Math.max(1, opts.medianAnnualWage);
  // Below PTI 5x: push growth toward inflation (can't build cheaper than cost).
  // Above PTI 6x: no floor effect.
  if (pti >= 6) return -1; // no floor binding
  const floor = opts.inflation * clamp((6 - pti) / 2, 0, 1);
  return floor;
}

/**
 * Rent floor: rent should not fall below ~20% of wages long-term.
 */
export function rentFloorGrowth(opts: {
  medianAnnualRent: number;
  medianAnnualWage: number;
  inflation: number;
}): number {
  const rentShare = opts.medianAnnualRent / Math.max(1, opts.medianAnnualWage);
  if (rentShare >= 0.22) return -1; // no floor binding
  // Push rent growth toward inflation when rent share is very low
  const floor = opts.inflation * clamp((0.22 - rentShare) / 0.05, 0, 1);
  return floor;
}

export function computeNominalPriceGrowth(opts: {
  baselinePriceGrowth: number;
  gapRatio: number;
  c: CoreConstants;
  curves: Curves;
  medianPrice?: number;
  medianAnnualWage?: number;
  inflation?: number;
}): number {
  const { baselinePriceGrowth, gapRatio, c, curves } = opts;
  const delta = curves.priceSupplyGap(gapRatio);
  // Apply affordability damping to the gap signal
  const damping = (opts.medianPrice && opts.medianAnnualWage)
    ? affordabilityDamping({ medianPrice: opts.medianPrice, medianAnnualWage: opts.medianAnnualWage })
    : 1;
  // Baseline growth damping for extreme unaffordability:
  // When PTI is very high (>14x), even baseline growth slows as buyers are priced out.
  const baselineDamping = (opts.medianPrice && opts.medianAnnualWage)
    ? (() => {
        const pti = opts.medianPrice! / Math.max(1, opts.medianAnnualWage!);
        if (pti <= 14) return 1;
        if (pti >= 25) return 0.25;
        return 1 - 0.75 * ((pti - 14) / 11);
      })()
    : 1;
  const raw = baselinePriceGrowth * baselineDamping + c.marketAdjustmentSpeed * delta * damping;
  // Soft min clamp: use softFloor to prevent clustering at a single negative CAGR.
  // Hard cap on upside; soft approach to -10% floor on downside.
  const maxCapped = Math.min(raw, c.caps.maxNominalPriceGrowth);
  const clamped = softFloor(maxCapped, -0.03, c.caps.minNominalPriceGrowth);
  // Apply price floor
  if (opts.medianPrice && opts.medianAnnualWage && opts.inflation != null) {
    const floor = priceFloorGrowth({ medianPrice: opts.medianPrice, medianAnnualWage: opts.medianAnnualWage, inflation: opts.inflation });
    if (floor >= 0 && clamped < floor) return floor;
  }
  return clamped;
}

export function computeNominalRentGrowth(opts: {
  baselineRentGrowth: number;
  gapRatio: number;
  c: CoreConstants;
  curves: Curves;
  rentGrowthModifier: number;
  medianAnnualRent?: number;
  medianAnnualWage?: number;
  inflation?: number;
}): number {
  const { baselineRentGrowth, gapRatio, c, curves, rentGrowthModifier } = opts;
  const delta = curves.rentSupplyGap(gapRatio);
  // Apply rent affordability damping: when rent burden is already high, rent growth decelerates
  // (tenants leave, vacancies rise, landlords compete).
  const rentDamping = (opts.medianAnnualRent && opts.medianAnnualWage)
    ? (() => {
        const rb = opts.medianAnnualRent! / Math.max(1, opts.medianAnnualWage!);
        // Below 35%: no damping. 35%-50%: linear ramp. Above 50%: 60% damped.
        if (rb <= 0.35) return 1;
        if (rb >= 0.50) return 0.4;
        return 1 - 0.6 * ((rb - 0.35) / 0.15);
      })()
    : 1;
  // Baseline rent growth damping for extreme rent burden:
  // When rent exceeds ~40% of wages, baseline rent growth itself slows
  // (tenants leave, vacancies rise, market self-corrects).
  const baselineRentDamping = (opts.medianAnnualRent && opts.medianAnnualWage)
    ? (() => {
        const rb = opts.medianAnnualRent! / Math.max(1, opts.medianAnnualWage!);
        if (rb <= 0.40) return 1;
        if (rb >= 0.55) return 0.3;
        return 1 - 0.7 * ((rb - 0.40) / 0.15);
      })()
    : 1;
  const raw = baselineRentGrowth * baselineRentDamping + c.marketAdjustmentSpeed * delta * rentDamping + rentGrowthModifier;
  // Soft min clamp for rent: prevents clustering at the hard floor.
  const maxCappedRent = Math.min(raw, c.caps.maxNominalRentGrowth);
  const clamped = softFloor(maxCappedRent, -0.02, c.caps.minNominalRentGrowth);
  // Apply rent floor
  if (opts.medianAnnualRent && opts.medianAnnualWage && opts.inflation != null) {
    const floor = rentFloorGrowth({ medianAnnualRent: opts.medianAnnualRent, medianAnnualWage: opts.medianAnnualWage, inflation: opts.inflation });
    if (floor >= 0 && clamped < floor) return floor;
  }
  return clamped;
}

export function computeCompletionsNextYear(opts: {
  baselineCompletions: number;
  supplyBoost: number;
  expectedPriceGrowth: number;
  curves: Curves;
}): number {
  const { baselineCompletions, supplyBoost, expectedPriceGrowth, curves } = opts;
  // Keep in plausible policy range; capacity limits are applied separately year-to-year.
  const boost = clamp(supplyBoost, -0.10, 0.25);
  const induced = curves.constructionResponse(expectedPriceGrowth);
  const completions = baselineCompletions * (1 + boost) * induced;
  return Math.max(0, completions);
}

export function capCompletionsByCapacity(opts: {
  currentCompletions: number;
  proposedNextCompletions: number;
  c: CoreConstants;
}): number {
  const { currentCompletions, proposedNextCompletions, c } = opts;
  const cur = Math.max(0, currentCompletions);
  const next = Math.max(0, proposedNextCompletions);
  if (cur <= 0) return next;
  const up = Math.max(0, c.constructionCapacity.maxCompletionsYoYIncrease);
  const down = Math.max(0, c.constructionCapacity.maxCompletionsYoYDecrease);
  const hi = cur * (1 + up);
  const lo = cur * (1 - down);
  return clamp(next, lo, hi);
}

export function computeStampDutyRevenue(opts: {
  medianPrice: number;
  dwellingStock: number;
  annualTurnoverRate: number;
  stampDutyRate: number;
}): number {
  const { medianPrice, dwellingStock, annualTurnoverRate, stampDutyRate } = opts;
  const transactions = dwellingStock * annualTurnoverRate;
  return transactions * medianPrice * Math.max(0, stampDutyRate);
}

export function housingCostIndex(opts: {
  medianPrice: number;
  medianAnnualRent: number;
  wageIndex: number;
}): number {
  const { medianPrice, medianAnnualRent, wageIndex } = opts;
  const wage = Math.max(1e-9, wageIndex);
  return (medianPrice / wage) * 0.7 + (medianAnnualRent / wage) * 0.3;
}

export function ramp01(i: number, rampYears: number): number {
  if (rampYears <= 0) return 1;
  return clamp((i + 1) / rampYears, 0, 1);
}

export function negativeGearingSignedIntensity(mode: NegativeGearingMode, intensity01: number): number {
  const x = clamp(intensity01, 0, 1);
  if (mode === "remove") return +x;
  if (mode === "reverse") return -x;
  return 0;
}

export function resolveMethodology(params: ScenarioParams): {
  c: CoreConstants;
  curves: Curves;
} {
  return {
    c: { ...DEFAULT_CONSTANTS, ...(params.constants ?? {}) },
    curves: { ...DEFAULT_CURVES, ...(params.curves ?? {}) },
  };
}
