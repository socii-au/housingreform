/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  CoreConstants,
  Curves,
  ScenarioParams,
  Year,
  resolveMethodology,
  householdsFromPopulation,
  effectiveDemandHouseholds,
  supplyGapRatio,
  computeNominalPriceGrowth,
  computeNominalRentGrowth,
  computeCompletionsNextYear,
  capCompletionsByCapacity,
  amortizedAnnualPayment,
  computeStampDutyRevenue,
  housingCostIndex,
  ramp01,
  negativeGearingSignedIntensity,
} from "./methodology";

import { CityId, StateId, Scope, cityMeta, scopeKey } from "./regions";
import { expectedNominalPriceGrowth } from "./advanced/expectations";
import { portfolioInvestorDemandMultiplier } from "./advanced/portfolio";
import { reallocateNetMigrationAcrossCities } from "./advanced/spatialEquilibrium";
import { extractCityMicrodata, MicroRecord } from "./advanced/microdata";
import { clampPolicyV2, toPolicyV2 } from "./policyRegistry";
import { computePolicyChannelsForCityYear } from "./policies";
import { computeRatePath, rateDemandMultiplier, resolveBaseRateFromHistory } from "./ratePath";

export interface YearState {
  year: Year;

  population: number;
  households: number;

  dwellingStock: number;
  completions: number;

  medianPrice: number;
  medianAnnualRent: number;
  /** Typical annual insurance premium (ex tax) for a representative household. */
  insurancePremiumExTax: number;
  /** Tax/levy component applied to insurance premium. */
  insurancePremiumTax: number;
  /** Insurance premium including tax/levy component. */
  insurancePremiumIncTax: number;
  /** Nominal insurance growth for the year. */
  insuranceGrowth: number;
  /** Cumulative rent paid to date (annual rent summed). */
  cumulativeRentPaid: number;
  /** Cumulative insurance paid to date (inc tax). */
  cumulativeInsurancePaid: number;

  wageIndex: number;
  cpiIndex: number;
  /** Actual median annual wage in AUD */
  medianAnnualWage: number;

  mortgageRate: number;

  demandHouseholds: number;
  gapRatio: number;

  nominalPriceGrowth: number;
  nominalRentGrowth: number;

  stampDutyRevenue: number;

  policyChannels: {
    investorDemandMultiplier: number;
    portfolioInvestorDemandMultiplier?: number;
    divestedDwellingsShare: number;
    rentalSupplyShockShare: number;
    rentAssistanceShareOfRent?: number;
  };

  affordability: {
    priceToIncomeIndex: number;
    rentToIncomeIndex: number;
    insuranceToIncomeIndex: number;
    typicalMortgagePayment: number;
    typicalMortgagePaymentShareOfIncome: number;
    typicalRentShareOfIncome: number;
  };

  deciles: DecileOutputs;
}

export interface ScenarioSummary {
  year0: Year;
  yearN: Year;
  medianPriceChangePct: number;
  medianRentChangePct: number;
  insurancePremiumChangePct: number;
  medianWageChangePct: number;
  dwellingStockChangePct: number;
  stampDutyRevenueChangePct: number;
  housingCostIndexChangePct: number;
}

export interface RegionYearState {
  year: Year;
  population: number;
  dwellingStock: number;
  medianPrice: number;
  medianAnnualRent: number;
  insurancePremiumExTax: number;
  insurancePremiumTax: number;
  insurancePremiumIncTax: number;
  insuranceToIncomeIndex: number;
  cumulativeRentPaid: number;
  cumulativeInsurancePaid: number;
  stampDutyRevenue: number;
  wageIndex: number;
  /** Actual median annual wage in AUD */
  medianAnnualWage: number;
  housingCostIndex: number;
  /** Indexed values for comparison charts (year 0 = 100) */
  priceIndex: number;
  rentIndex: number;
  insuranceIndex: number;
}

export interface RegionScenarioOutputs {
  id: string;
  label: string;
  scope: Scope;
  years: RegionYearState[];
  summary: ScenarioSummary;
}

export interface CityScenarioOutputs {
  cityId: CityId;
  cityName: string;
  state: StateId;
  years: YearState[];
  summary: ScenarioSummary;
}

export interface ScenarioOutputs {
  params: ScenarioParams;

  byCity: Record<CityId, CityScenarioOutputs>;

  /**
   * Aggregations computed from city outputs:
   * - NATIONAL (all cities included)
   * - each STATE (subset)
   * - each CITY (for uniform API)
   */
  byRegion: Record<string, RegionScenarioOutputs>;
}

/**
 * Decile logic (placeholder proxy)
 */
export type Decile = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface DecileRow {
  decile: Decile;
  income: number;
  rentCost: number;
  mortgageCost: number;
  rentShare: number;
  mortgageShare: number;
  rentStress: boolean;
  mortgageStress: boolean;
  depositRequired: number;
  depositShareOfIncome: number;
}

export interface DecileOutputs {
  rows: DecileRow[];
  stressRates: {
    rentersInStressShare: number;
    mortgagedOwnersInStressShare: number;
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return (to - from) / from;
}

function defaultInsuranceBases(base: ScenarioParams["cities"][number]): {
  homeExTax: number;
  landlordExTax: number;
} {
  const homeFallback = Math.max(600, base.medianPrice * 0.0012);
  const homeExTax = base.annualHomeInsuranceBase ?? homeFallback;
  const landlordExTax = base.annualLandlordInsuranceBase ?? homeExTax * 1.25;
  return { homeExTax, landlordExTax };
}

function computeRentSeries(opts: {
  base: ScenarioParams["cities"][number];
  yearIndex: number;
  prevRent: number;
  baselineRentGrowth: number;
  gapRatio: number;
  investorDemandShock: number;
  supplyGrowthDelta: number;
  populationGrowthDelta: number;
  wageGrowthDelta: number;
  c: CoreConstants;
  curves: Curves;
  rentGrowthModifier: number;
  rentGrowthCap: number | null;
  rentRegulationCoverage: number;
}): {
  nextRent: number;
  nominalRentGrowth: number;
  cappedRentGrowth: number;
} {
  const {
    base,
    prevRent,
    baselineRentGrowth,
    gapRatio,
    investorDemandShock,
    supplyGrowthDelta,
    populationGrowthDelta,
    wageGrowthDelta,
    c,
    curves,
    rentGrowthModifier,
    rentGrowthCap,
    rentRegulationCoverage,
  } = opts;

  const elasticityInvestor = base.rentElasticityToInvestorDemand ?? 0.25;
  const elasticitySupply = base.rentElasticityToSupply ?? 0.35;
  const elasticityPopulation = base.rentElasticityToPopulation ?? 0.30;
  const elasticityWage = base.rentElasticityToWage ?? 0.15;

  const rentGrowthBaseline =
    baselineRentGrowth +
    investorDemandShock * elasticityInvestor -
    supplyGrowthDelta * elasticitySupply +
    populationGrowthDelta * elasticityPopulation +
    wageGrowthDelta * elasticityWage;

  const nominalRentGrowth = computeNominalRentGrowth({
    baselineRentGrowth: rentGrowthBaseline,
    gapRatio,
    c,
    curves,
    rentGrowthModifier,
  });

  const cappedRentGrowth =
    rentGrowthCap != null && rentRegulationCoverage > 0
      ? (1 - rentRegulationCoverage) * nominalRentGrowth +
        rentRegulationCoverage * Math.min(nominalRentGrowth, rentGrowthCap)
      : nominalRentGrowth;

  return {
    nextRent: prevRent * (1 + cappedRentGrowth),
    nominalRentGrowth,
    cappedRentGrowth,
  };
}

function computeInsuranceSeries(opts: {
  base: ScenarioParams["cities"][number];
  prevPremiumExTax: number;
  inflation: number;
  medianIncomeProxy: number;
}): {
  premiumExTax: number;
  premiumTax: number;
  premiumIncTax: number;
  insuranceGrowth: number;
  insuranceToIncomeIndex: number;
} {
  const { base, prevPremiumExTax, inflation, medianIncomeProxy } = opts;
  const baseInflation = base.insuranceInflationBaseline ?? inflation;
  const claimsPremium = base.insuranceClaimsInflationPremium ?? 0.01;
  const climateTrend = base.insuranceClimateTrend ?? 0.003;
  const climateMultiplier = base.climateRiskMultiplier ?? 1;
  const insuranceGrowth = baseInflation + claimsPremium + climateTrend * climateMultiplier;

  const premiumExTax = prevPremiumExTax * (1 + insuranceGrowth);
  const taxRate = base.insuranceTaxRateEffective ?? 0.12;
  const premiumTax = premiumExTax * Math.max(0, taxRate);
  const premiumIncTax = premiumExTax + premiumTax;
  const insuranceToIncomeIndex = premiumIncTax / Math.max(1, medianIncomeProxy);

  return {
    premiumExTax,
    premiumTax,
    premiumIncTax,
    insuranceGrowth,
    insuranceToIncomeIndex,
  };
}

function syntheticIncomeByDecile(opts: { medianIncome: number }): Record<Decile, number> {
  const { medianIncome } = opts;
  const multipliers: Record<Decile, number> = {
    1: 0.40,
    2: 0.52,
    3: 0.62,
    4: 0.73,
    5: 0.85,
    6: 0.98,
    7: 1.15,
    8: 1.38,
    9: 1.75,
    10: 2.60,
  };
  const out = {} as Record<Decile, number>;
  (Object.keys(multipliers) as unknown as Decile[]).forEach((d) => {
    out[d] = medianIncome * multipliers[d];
  });
  return out;
}

function computeDecilesProxy(opts: {
  c: CoreConstants;
  medianPrice: number;
  medianAnnualRent: number;
  wageIndex: number;
  microdata?: MicroRecord[] | null;
  rentAssistanceShareOfRent?: number;
  mortgageRate: number;
  mortgageTermYears: number;
}): DecileOutputs {
  const { c, medianPrice, medianAnnualRent, wageIndex, microdata, rentAssistanceShareOfRent, mortgageRate, mortgageTermYears } = opts;
  const effectiveRent = medianAnnualRent * (1 - Math.max(0, Math.min(0.8, rentAssistanceShareOfRent ?? 0)));

  // If microdata provided: compute tenure-specific stress rates and decile rows from sample.
  if (microdata && microdata.length >= 20) {
    const sorted = [...microdata].sort((a, b) => a.income - b.income);
    const n = sorted.length;

    const principal = medianPrice * c.typicalLVR;
    const annualMortgagePayment = amortizedAnnualPayment({
      principal,
      annualRate: mortgageRate,
      termYears: mortgageTermYears,
    });
    const depositRequired = medianPrice * (1 - c.typicalLVR);

    const deciles: DecileRow[] = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as Decile[]).map((d) => {
      const lo = Math.floor(((d - 1) / 10) * n);
      const hi = Math.max(lo + 1, Math.floor((d / 10) * n));
      const slice = sorted.slice(lo, hi);
      const income =
        slice.reduce((acc, r) => acc + r.income * (r.weight ?? 1), 0) /
        Math.max(1e-9, slice.reduce((acc, r) => acc + (r.weight ?? 1), 0));
      const rentCost = effectiveRent;
      const mortgageCost = annualMortgagePayment;
      const rentShare = rentCost / Math.max(1, income);
      const mortgageShare = mortgageCost / Math.max(1, income);
      return {
        decile: d,
        income,
        rentCost,
        mortgageCost,
        rentShare,
        mortgageShare,
        rentStress: rentShare >= c.rentStressShareOfIncome,
        mortgageStress: mortgageShare >= c.mortgageStressShareOfIncome,
        depositRequired,
        depositShareOfIncome: depositRequired / Math.max(1, income),
      };
    });

    const renters = microdata.filter((r) => r.tenure === "renter");
    const mortgaged = microdata.filter((r) => r.tenure === "mortgaged");
    const renterW = Math.max(1e-9, renters.reduce((a, r) => a + (r.weight ?? 1), 0));
    const mortW = Math.max(1e-9, mortgaged.reduce((a, r) => a + (r.weight ?? 1), 0));

    const rentersInStressShare =
      renters.reduce((acc, r) => {
        const w = r.weight ?? 1;
        const share = effectiveRent / Math.max(1, r.income);
        return acc + (share >= c.rentStressShareOfIncome ? w : 0);
      }, 0) / renterW;

    const mortgagedOwnersInStressShare =
      mortgaged.reduce((acc, r) => {
        const w = r.weight ?? 1;
        const share = annualMortgagePayment / Math.max(1, r.income);
        return acc + (share >= c.mortgageStressShareOfIncome ? w : 0);
      }, 0) / mortW;

    return {
      rows: deciles,
      stressRates: {
        rentersInStressShare,
        mortgagedOwnersInStressShare,
      },
    };
  }

  const MEDIAN_INCOME_AT_WAGE_INDEX_100 = 90000;
  const medianIncome = (wageIndex / 100) * MEDIAN_INCOME_AT_WAGE_INDEX_100;

  const incomeByDecile = syntheticIncomeByDecile({ medianIncome });

  const principal = medianPrice * c.typicalLVR;
  const annualMortgagePayment = amortizedAnnualPayment({
    principal,
    annualRate: mortgageRate,
    termYears: mortgageTermYears,
  });

  const depositRequired = medianPrice * (1 - c.typicalLVR);

  const rows: DecileRow[] = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as Decile[]).map((decile) => {
    const income = Math.max(1, incomeByDecile[decile]);
    const rentCost = effectiveRent;
    const mortgageCost = annualMortgagePayment;

    const rentShare = rentCost / income;
    const mortgageShare = mortgageCost / income;

    return {
      decile,
      income,
      rentCost,
      mortgageCost,
      rentShare,
      mortgageShare,
      rentStress: rentShare >= c.rentStressShareOfIncome,
      mortgageStress: mortgageShare >= c.mortgageStressShareOfIncome,
      depositRequired,
      depositShareOfIncome: depositRequired / income,
    };
  });

  return {
    rows,
    stressRates: {
      rentersInStressShare: rows.filter((r) => r.rentStress).length / rows.length,
      mortgagedOwnersInStressShare: rows.filter((r) => r.mortgageStress).length / rows.length,
    },
  };
}

function computeInvestorPolicyChannels(opts: {
  curves: Curves;
  c: CoreConstants;
  yearIndex: number;
  investorDwellingShare: number;
  policy: ScenarioParams["policy"];
  dwellingStock: number;
}): {
  investorDemandMultiplier: number;
  divestedDwellingsShare: number;
  rentalSupplyShockShare: number;
} {
  const { curves, c, yearIndex, investorDwellingShare, policy, dwellingStock } = opts;

  const ramp = ramp01(yearIndex, policy.rampYears ?? 0);

  const ngSigned = negativeGearingSignedIntensity(policy.negativeGearingMode, policy.negativeGearingIntensity ?? 0);
  const ngEffect = curves.investorDemandShock(Math.abs(ngSigned)) * Math.sign(ngSigned);

  const capOn = policy.ownershipCapEnabled ? 1 : 0;
  const capEnforcement = clamp((policy.ownershipCapEnforcement ?? 0) * ramp * capOn, 0, 1);

  const capDemandEffect = 0.10 * capEnforcement * clamp(investorDwellingShare, 0, 0.50);

  const excessShare = clamp(policy.excessInvestorStockShare ?? 0, 0, 0.50);
  const eligibleExcessStockShareOfTotal = clamp(investorDwellingShare * excessShare * capEnforcement, 0, 0.20);

  const maxPerYear = c.maxDivestmentSharePerYear;
  const divestmentSpeed = policy.divestmentPhased ? 0.35 : 1.0;
  const divestedDwellingsShare = clamp(eligibleExcessStockShareOfTotal * divestmentSpeed, 0, maxPerYear);

  const rentalSupplyShockShare =
    curves.rentalSupplyShockFromDivestment(divestedDwellingsShare) * c.divestmentToOwnerOccupierShare;

  const totalInvestorDemandShock = (ngEffect + capDemandEffect) * ramp;
  const investorDemandMultiplier = clamp(1 - totalInvestorDemandShock, 0.80, 1.10);

  return {
    investorDemandMultiplier,
    divestedDwellingsShare,
    rentalSupplyShockShare,
  };
}

function runScenarioCoupledAdvanced(params: ScenarioParams): ScenarioOutputs {
  const { c, curves } = resolveMethodology(params);
  const policy = clampPolicyV2(params.policy);
  const cityIds = params.cities.map((b) => b.cityId);

  const BASELINE_NOMINAL_PRICE_GROWTH = 0.04;
  const BASELINE_NOMINAL_RENT_GROWTH = 0.035;
  const BASELINE_INFLATION = 0.028;

  const st = params.cities.map((base) => {
    const insuranceBases = defaultInsuranceBases(base);
    const investorShare = clamp(base.investorDwellingShare, 0, 0.6);
    const insurancePremiumExTax =
      insuranceBases.homeExTax * (1 - investorShare) + insuranceBases.landlordExTax * investorShare;
    const insurancePremiumTax = insurancePremiumExTax * (base.insuranceTaxRateEffective ?? 0.12);
    const insurancePremiumIncTax = insurancePremiumExTax + insurancePremiumTax;
    const baseRate = resolveBaseRateFromHistory({
      historyBundle: params.advanced?.calibration?.historyBundle,
      fallbackMortgageRate: base.mortgageRate,
      mortgageSpread: params.ratePath?.mortgageSpread,
    });
    return {
    base,
    meta: cityMeta(base.cityId),
    year: base.year0,
    population: base.population,
    dwellingStock: base.dwellingStock,
    completions: base.annualCompletions,
    medianPrice: base.medianPrice,
    medianAnnualRent: base.medianAnnualRent,
    wageIndex: base.wageIndex,
    cpiIndex: base.cpiIndex,
    medianAnnualWage: base.medianAnnualWage ?? 85_000,
    mortgageRate: Math.max(0, baseRate + (policy.mortgageRateDelta ?? 0)),
    mortgageTermYears: base.mortgageTermYears,
    lastNominalPriceGrowth: BASELINE_NOMINAL_PRICE_GROWTH,
    insurancePremiumExTax,
    insurancePremiumTax,
    insurancePremiumIncTax,
    cumulativeRentPaid: 0,
    cumulativeInsurancePaid: 0,
      baseRate,
  };
  });

  const yearsByCity: Record<CityId, YearState[]> = {} as Record<CityId, YearState[]>;
  cityIds.forEach((id) => (yearsByCity[id] = []));

  for (let t = 0; t < params.years; t++) {
    // Precompute policy channels per city-year (used for migration shock and other city-level deltas).
    const policyByCity: Record<CityId, ReturnType<typeof computePolicyChannelsForCityYear>> = {} as any;
    cityIds.forEach((id) => {
      const base = params.cities.find((b) => b.cityId === id)!;
      policyByCity[id] = computePolicyChannelsForCityYear({
        yearIndex: t,
        base,
        policy,
      });
    });

    const utilityByCity: Record<CityId, number> = {} as Record<CityId, number>;
    const baseNetMig: Record<CityId, number> = {} as Record<CityId, number>;

    for (const s of st) {
      const hci = housingCostIndex({
        medianPrice: s.medianPrice,
        medianAnnualRent: s.medianAnnualRent,
        wageIndex: s.wageIndex,
      });

      const w = params.advanced?.spatialEquilibrium?.utilityWeights ?? {
        logWage: 1.0,
        logHousingCost: -1.1,
        amenity: 0.25,
      };
      const amenity = params.advanced?.spatialEquilibrium?.amenityByCity?.[s.base.cityId] ?? 0;
      utilityByCity[s.base.cityId] =
        w.logWage * Math.log(Math.max(1, s.medianAnnualWage)) +
        w.logHousingCost * Math.log(Math.max(1e-9, hci)) +
        w.amenity * amenity;

      baseNetMig[s.base.cityId] = s.base.netMigrationPerYear;
    }

    // Apply migration policy shock before spatial reallocation.
    cityIds.forEach((id) => {
      const ch = policyByCity[id];
      baseNetMig[id] = (baseNetMig[id] ?? 0) * (ch.netMigrationMultiplier ?? 1) + (ch.netMigrationAdd ?? 0);
    });

    const netMigAlloc = reallocateNetMigrationAcrossCities({
      cityIds,
      baseNetMigrationByCity: baseNetMig,
      utilityByCity,
      config: params.advanced?.spatialEquilibrium,
    });

    for (const s of st) {
      const base = s.base;

      const households = householdsFromPopulation(s.population, c);
      const policyChannels = policyByCity[base.cityId];
      let demandHouseholds = effectiveDemandHouseholds(households, policy);
      demandHouseholds = demandHouseholds * policyChannels.ownerOccDemandMultiplier;

      const investorChannels = computeInvestorPolicyChannels({
        curves,
        c,
        yearIndex: t,
        investorDwellingShare: base.investorDwellingShare,
        policy,
        dwellingStock: s.dwellingStock,
      });

      const expectedGrowth = expectedNominalPriceGrowth({
        year: s.year,
        baseline: BASELINE_NOMINAL_PRICE_GROWTH,
        lastObservedNominalPriceGrowth: s.lastNominalPriceGrowth,
        fundamentalsAnchor: BASELINE_NOMINAL_PRICE_GROWTH,
        config: params.advanced?.expectations,
      });
      const rentalYield = s.medianAnnualRent / Math.max(1e-9, s.medianPrice);
      const portfolioMult = portfolioInvestorDemandMultiplier({
        expectedNominalPriceGrowth: expectedGrowth,
        rentalYield,
        mortgageRate: s.mortgageRate,
        config: params.advanced?.portfolio,
      });

      const combinedInvestorMult =
        investorChannels.investorDemandMultiplier *
        portfolioMult *
        policyChannels.investorDemandMultiplier;
      const rateMult = rateDemandMultiplier({ baseRate: s.baseRate, currentRate: s.mortgageRate });
      demandHouseholds = demandHouseholds * combinedInvestorMult * rateMult;

      const effectiveStockForGap = s.dwellingStock * (1 + investorChannels.divestedDwellingsShare);
      const gapRatio = supplyGapRatio({ demandHouseholds, dwellingStock: effectiveStockForGap });

      const wageGrowthBase = base.wageGrowthRate ?? 0.03;
      const wageGrowth = curves.wageGrowth(s.year, wageGrowthBase);
      const inflation = curves.inflation(s.year, BASELINE_INFLATION);
      s.mortgageRate = computeRatePath({
        yearIndex: t,
        prevRate: s.mortgageRate,
        inflation,
        outputGap: clamp(gapRatio, -0.05, 0.05),
        config: params.ratePath ? { ...params.ratePath, baseRate: s.baseRate } : undefined,
      });
      s.mortgageRate = Math.max(0, s.mortgageRate + (policy.mortgageRateDelta ?? 0));
      s.wageIndex = s.wageIndex * (1 + wageGrowth);
      s.cpiIndex = s.cpiIndex * (1 + inflation);
      s.medianAnnualWage = s.medianAnnualWage * (1 + wageGrowth);

      const nominalPriceGrowth = computeNominalPriceGrowth({
        baselinePriceGrowth: BASELINE_NOMINAL_PRICE_GROWTH,
        gapRatio,
        c,
        curves,
      });

      const completionsNext = computeCompletionsNextYear({
        baselineCompletions: base.annualCompletions * policyChannels.completionsMultiplier,
        supplyBoost: policy.supplyBoost ?? 0,
        expectedPriceGrowth: nominalPriceGrowth,
        curves,
      });
      const completionsNextWithPublic = completionsNext + policyChannels.additionalCompletions;
      const effectiveC =
        policyChannels.capacityLift > 0
          ? {
              ...c,
              constructionCapacity: {
                ...c.constructionCapacity,
                maxCompletionsYoYIncrease: c.constructionCapacity.maxCompletionsYoYIncrease * (1 + policyChannels.capacityLift),
              },
            }
          : c;
      const completionsNextCapped = capCompletionsByCapacity({
        currentCompletions: s.completions,
        proposedNextCompletions: completionsNextWithPublic,
        c: effectiveC,
      });

      const demolitions = s.dwellingStock * Math.max(0, base.demolitionRate);
      s.dwellingStock = Math.max(0, s.dwellingStock + s.completions - demolitions);

      const baselineSupplyGrowthRate =
        (base.annualCompletions - base.demolitionRate * s.dwellingStock) / Math.max(1, s.dwellingStock);
      const supplyGrowthRate =
        (completionsNextCapped - demolitions) / Math.max(1, s.dwellingStock);
      const supplyGrowthDelta = supplyGrowthRate - baselineSupplyGrowthRate;

      const netMigrationExpected =
        base.netMigrationPerYear * policyChannels.netMigrationMultiplier + policyChannels.netMigrationAdd;
      const baselinePopGrowthRate =
        base.naturalPopGrowthRate + base.netMigrationPerYear / Math.max(1, s.population);
      const populationGrowthRate =
        base.naturalPopGrowthRate + netMigrationExpected / Math.max(1, s.population);
      const populationGrowthDelta = populationGrowthRate - baselinePopGrowthRate;
      const wageGrowthDelta = wageGrowth - (base.wageGrowthRate ?? 0.03);

      const rentGapRatio =
        gapRatio + investorChannels.rentalSupplyShockShare + policyChannels.rentalSupplyShockShare;
      const investorDemandShock = clamp(1 - combinedInvestorMult, -0.2, 0.4);
      const rentResult = computeRentSeries({
        base,
        yearIndex: t,
        prevRent: s.medianAnnualRent,
        baselineRentGrowth: base.rentGrowthBaseline ?? BASELINE_NOMINAL_RENT_GROWTH,
        gapRatio: rentGapRatio,
        investorDemandShock,
        supplyGrowthDelta,
        populationGrowthDelta,
        wageGrowthDelta,
        c,
        curves,
        rentGrowthModifier: (policy.rentGrowthModifier ?? 0) + policyChannels.rentGrowthModifier,
        rentGrowthCap: policyChannels.rentGrowthCap,
        rentRegulationCoverage: policyChannels.rentRegulationCoverage,
      });

      s.medianPrice = s.medianPrice * (1 + nominalPriceGrowth);
      s.medianAnnualRent = rentResult.nextRent;

      const turnoverRate = Math.max(0.01, Math.min(0.12, c.annualTurnoverRate * policyChannels.turnoverMultiplier));
      const stampDutyRate = Math.max(
        0,
        c.stampDutyEffectiveRate + (policy.stampDutyRateDelta ?? 0) + policyChannels.stampDutyRateDelta
      );
      const stampDutyRevenue = computeStampDutyRevenue({
        medianPrice: s.medianPrice,
        dwellingStock: s.dwellingStock,
        annualTurnoverRate: turnoverRate,
        stampDutyRate,
      });

      const medianIncomeProxy = (s.wageIndex / 100) * 90000;
      const insurance = computeInsuranceSeries({
        base,
        prevPremiumExTax: s.insurancePremiumExTax,
        inflation,
        medianIncomeProxy,
      });
      s.insurancePremiumExTax = insurance.premiumExTax;
      s.insurancePremiumTax = insurance.premiumTax;
      s.insurancePremiumIncTax = insurance.premiumIncTax;

      s.cumulativeRentPaid += s.medianAnnualRent;
      s.cumulativeInsurancePaid += s.insurancePremiumIncTax;
      const principal = s.medianPrice * c.typicalLVR;
      const typicalMortgagePayment = amortizedAnnualPayment({
        principal,
        annualRate: s.mortgageRate,
        termYears: s.mortgageTermYears,
      });

      const priceToIncomeIndex = s.medianPrice / Math.max(1, medianIncomeProxy);
      const rentToIncomeIndex = s.medianAnnualRent / Math.max(1, medianIncomeProxy);
      const insuranceToIncomeIndex = s.insurancePremiumIncTax / Math.max(1, medianIncomeProxy);
      const typicalMortgagePaymentShareOfIncome = typicalMortgagePayment / Math.max(1, medianIncomeProxy);
      const typicalRentShareOfIncome = s.medianAnnualRent / Math.max(1, medianIncomeProxy);

      const deciles = computeDecilesProxy({
        c,
        medianPrice: s.medianPrice,
        medianAnnualRent: s.medianAnnualRent,
        wageIndex: s.wageIndex,
        microdata:
          params.advanced?.microDistributions?.enabled
            ? extractCityMicrodata(params.advanced?.microDistributions?.microdata, base.cityId)
            : null,
        rentAssistanceShareOfRent: policyChannels.rentAssistanceShareOfRent,
        mortgageRate: s.mortgageRate,
        mortgageTermYears: s.mortgageTermYears,
      });

      yearsByCity[base.cityId].push({
        year: s.year,
        population: s.population,
        households,
        dwellingStock: s.dwellingStock,
        completions: s.completions,
        medianPrice: s.medianPrice,
        medianAnnualRent: s.medianAnnualRent,
        wageIndex: s.wageIndex,
        cpiIndex: s.cpiIndex,
        medianAnnualWage: s.medianAnnualWage,
        mortgageRate: s.mortgageRate,
        demandHouseholds,
        gapRatio,
        nominalPriceGrowth,
        nominalRentGrowth: rentResult.nominalRentGrowth,
        stampDutyRevenue,
        policyChannels: {
          investorDemandMultiplier: combinedInvestorMult,
          portfolioInvestorDemandMultiplier: portfolioMult,
          divestedDwellingsShare: investorChannels.divestedDwellingsShare,
          rentalSupplyShockShare: investorChannels.rentalSupplyShockShare,
          rentAssistanceShareOfRent: policyChannels.rentAssistanceShareOfRent,
        },
        affordability: {
          priceToIncomeIndex,
          rentToIncomeIndex,
        insuranceToIncomeIndex,
          typicalMortgagePayment,
          typicalMortgagePaymentShareOfIncome,
          typicalRentShareOfIncome,
        },
        deciles,
      insurancePremiumExTax: s.insurancePremiumExTax,
      insurancePremiumTax: s.insurancePremiumTax,
      insurancePremiumIncTax: s.insurancePremiumIncTax,
      insuranceGrowth: insurance.insuranceGrowth,
      cumulativeRentPaid: s.cumulativeRentPaid,
      cumulativeInsurancePaid: s.cumulativeInsurancePaid,
      });

      const netMigration = netMigAlloc[base.cityId] ?? base.netMigrationPerYear;
      s.population = s.population * (1 + base.naturalPopGrowthRate) + netMigration;
      s.completions = completionsNextCapped;
      s.year += 1;
      s.lastNominalPriceGrowth = nominalPriceGrowth;
    }
  }

  const byCity: Record<CityId, CityScenarioOutputs> = {} as Record<CityId, CityScenarioOutputs>;
  st.forEach((s) => {
    const series = yearsByCity[s.base.cityId];
    const first = series[0];
    const last = series[series.length - 1];
    const hciFirst = housingCostIndex({
      medianPrice: first.medianPrice,
      medianAnnualRent: first.medianAnnualRent,
      wageIndex: first.wageIndex,
    });
    const hciLast = housingCostIndex({
      medianPrice: last.medianPrice,
      medianAnnualRent: last.medianAnnualRent,
      wageIndex: last.wageIndex,
    });
    byCity[s.base.cityId] = {
      cityId: s.base.cityId,
      cityName: s.base.cityName,
      state: s.meta.state,
      years: series,
      summary: {
        year0: first.year,
        yearN: last.year,
        medianPriceChangePct: pctChange(first.medianPrice, last.medianPrice),
        medianRentChangePct: pctChange(first.medianAnnualRent, last.medianAnnualRent),
        insurancePremiumChangePct: pctChange(first.insurancePremiumIncTax, last.insurancePremiumIncTax),
        medianWageChangePct: pctChange(first.medianAnnualWage, last.medianAnnualWage),
        dwellingStockChangePct: pctChange(first.dwellingStock, last.dwellingStock),
        stampDutyRevenueChangePct: pctChange(first.stampDutyRevenue, last.stampDutyRevenue),
        housingCostIndexChangePct: pctChange(hciFirst, hciLast),
      },
    };
  });

  const byRegion: Record<string, RegionScenarioOutputs> = {};

  // NATIONAL
  const nationalScope: Scope = { level: "national" };
  byRegion[scopeKey(nationalScope)] = aggregateRegion({
    scope: nationalScope,
    label: "National",
    cityIds,
    byCity,
    baselines: params.cities,
  });

  // STATES
  const byState = new Map<StateId, CityId[]>();
  cityIds.forEach((id) => {
    const stId = cityMeta(id).state;
    const arr = byState.get(stId) ?? [];
    arr.push(id);
    byState.set(stId, arr);
  });

  (Array.from(byState.keys()) as StateId[]).forEach((stId) => {
    const scope: Scope = { level: "state", state: stId };
    byRegion[scopeKey(scope)] = aggregateRegion({
      scope,
      label: stId,
      cityIds: byState.get(stId)!,
      byCity,
      baselines: params.cities,
    });
  });

  // CITIES (uniform API)
  cityIds.forEach((id) => {
    const scope: Scope = { level: "city", city: id };
    const city = byCity[id];
    const basePrice = city.years[0].medianPrice;
    const baseRent = city.years[0].medianAnnualRent;
    const baseWage = city.years[0].medianAnnualWage;
    const baseInsurance = city.years[0].insurancePremiumIncTax;
    const years: RegionYearState[] = city.years.map((y) => {
      const hci = housingCostIndex({
        medianPrice: y.medianPrice,
        medianAnnualRent: y.medianAnnualRent,
        wageIndex: y.wageIndex,
      });
      return {
        year: y.year,
        population: y.population,
        dwellingStock: y.dwellingStock,
        medianPrice: y.medianPrice,
        medianAnnualRent: y.medianAnnualRent,
        insurancePremiumExTax: y.insurancePremiumExTax,
        insurancePremiumTax: y.insurancePremiumTax,
        insurancePremiumIncTax: y.insurancePremiumIncTax,
        insuranceToIncomeIndex: y.affordability.insuranceToIncomeIndex,
        cumulativeRentPaid: y.cumulativeRentPaid,
        cumulativeInsurancePaid: y.cumulativeInsurancePaid,
        stampDutyRevenue: y.stampDutyRevenue,
        wageIndex: (y.medianAnnualWage / Math.max(1e-9, baseWage)) * 100,
        medianAnnualWage: y.medianAnnualWage,
        housingCostIndex: hci,
        priceIndex: (y.medianPrice / Math.max(1e-9, basePrice)) * 100,
        rentIndex: (y.medianAnnualRent / Math.max(1e-9, baseRent)) * 100,
        insuranceIndex: (y.insurancePremiumIncTax / Math.max(1e-9, baseInsurance)) * 100,
      };
    });

    const first = years[0];
    const last = years[years.length - 1];
    byRegion[scopeKey(scope)] = {
      id: scopeKey(scope),
      label: city.cityName,
      scope,
      years,
      summary: {
        year0: first.year,
        yearN: last.year,
        medianPriceChangePct: pctChange(first.medianPrice, last.medianPrice),
        medianRentChangePct: pctChange(first.medianAnnualRent, last.medianAnnualRent),
        insurancePremiumChangePct: pctChange(first.insurancePremiumIncTax, last.insurancePremiumIncTax),
        medianWageChangePct: pctChange(first.medianAnnualWage, last.medianAnnualWage),
        dwellingStockChangePct: pctChange(first.dwellingStock, last.dwellingStock),
        stampDutyRevenueChangePct: pctChange(first.stampDutyRevenue, last.stampDutyRevenue),
        housingCostIndexChangePct: pctChange(first.housingCostIndex, last.housingCostIndex),
      },
    };
  });

  return { params, byCity, byRegion };
}

/**
 * Build an aggregate "region series" from a subset of cities.
 */
function aggregateRegion(opts: {
  scope: Scope;
  label: string;
  cityIds: CityId[];
  byCity: Record<CityId, CityScenarioOutputs>;
  baselines: ScenarioParams["cities"];
}): RegionScenarioOutputs {
  const { scope, label, cityIds, byCity, baselines } = opts;

  if (cityIds.length === 0) {
    throw new Error(`Cannot aggregate region with no cities: ${label}`);
  }

  const yearsN = byCity[cityIds[0]].years.length;

  const years: RegionYearState[] = [];

  // First pass: compute first-year values for indexing
  const firstYearCityRows = cityIds.map((id) => byCity[id].years[0]);
  const firstYearWeights = cityIds.map((id) => {
    const baseline = baselines.find((b) => b.cityId === id);
    if (baselines.some((b) => typeof b.weight === "number")) return baseline?.weight ?? 0;
    return byCity[id].years[0].population;
  });
  const firstYearWSum = Math.max(1e-9, firstYearWeights.reduce((a, b) => a + b, 0));
  const firstYearWNorm = firstYearWeights.map((w) => w / firstYearWSum);
  const basePrice = firstYearCityRows.reduce((acc, r, i) => acc + r.medianPrice * firstYearWNorm[i], 0);
  const baseRent = firstYearCityRows.reduce((acc, r, i) => acc + r.medianAnnualRent * firstYearWNorm[i], 0);
  const baseWage = firstYearCityRows.reduce((acc, r, i) => acc + r.medianAnnualWage * firstYearWNorm[i], 0);
  const baseInsurance = firstYearCityRows.reduce(
    (acc, r, i) => acc + r.insurancePremiumIncTax * firstYearWNorm[i],
    0
  );

  for (let t = 0; t < yearsN; t++) {
    const cityRows = cityIds.map((id) => byCity[id].years[t]);

    const weightsProvided = baselines.some((b) => typeof b.weight === "number");
    const weights = cityIds.map((id) => {
      const baseline = baselines.find((b) => b.cityId === id);
      if (weightsProvided) return baseline?.weight ?? 0;
      return byCity[id].years[t].population;
    });

    const wSum = Math.max(1e-9, weights.reduce((a, b) => a + b, 0));
    const wNorm = weights.map((w) => w / wSum);

    const year = cityRows[0].year;

    const population = cityRows.reduce((acc, r) => acc + r.population, 0);
    const dwellingStock = cityRows.reduce((acc, r) => acc + r.dwellingStock, 0);
    const stampDutyRevenue = cityRows.reduce((acc, r) => acc + r.stampDutyRevenue, 0);

    const medianPrice = cityRows.reduce((acc, r, i) => acc + r.medianPrice * wNorm[i], 0);
    const medianAnnualRent = cityRows.reduce((acc, r, i) => acc + r.medianAnnualRent * wNorm[i], 0);
    const wageIndex = cityRows.reduce((acc, r, i) => acc + r.wageIndex * wNorm[i], 0);
    const medianAnnualWage = cityRows.reduce((acc, r, i) => acc + r.medianAnnualWage * wNorm[i], 0);
    const insurancePremiumExTax = cityRows.reduce((acc, r, i) => acc + r.insurancePremiumExTax * wNorm[i], 0);
    const insurancePremiumTax = cityRows.reduce((acc, r, i) => acc + r.insurancePremiumTax * wNorm[i], 0);
    const insurancePremiumIncTax = cityRows.reduce((acc, r, i) => acc + r.insurancePremiumIncTax * wNorm[i], 0);
    const cumulativeRentPaid = cityRows.reduce((acc, r, i) => acc + r.cumulativeRentPaid * wNorm[i], 0);
    const cumulativeInsurancePaid = cityRows.reduce((acc, r, i) => acc + r.cumulativeInsurancePaid * wNorm[i], 0);

    const hci = housingCostIndex({ medianPrice, medianAnnualRent, wageIndex });

    // Indexed values (year 0 = 100)
    const priceIndex = (medianPrice / basePrice) * 100;
    const rentIndex = (medianAnnualRent / baseRent) * 100;
    const wageIdx = (medianAnnualWage / baseWage) * 100;
    const insuranceIndex = (insurancePremiumIncTax / Math.max(1e-9, baseInsurance)) * 100;
    const insuranceToIncomeIndex = insurancePremiumIncTax / Math.max(1, medianAnnualWage);

    years.push({
      year,
      population,
      dwellingStock,
      medianPrice,
      medianAnnualRent,
      insurancePremiumExTax,
      insurancePremiumTax,
      insurancePremiumIncTax,
      insuranceToIncomeIndex,
      cumulativeRentPaid,
      cumulativeInsurancePaid,
      stampDutyRevenue,
      wageIndex: wageIdx,
      medianAnnualWage,
      housingCostIndex: hci,
      priceIndex,
      rentIndex,
      insuranceIndex,
    });
  }

  const first = years[0];
  const last = years[years.length - 1];

  const summary: ScenarioSummary = {
    year0: first.year,
    yearN: last.year,
    medianPriceChangePct: pctChange(first.medianPrice, last.medianPrice),
    medianRentChangePct: pctChange(first.medianAnnualRent, last.medianAnnualRent),
    insurancePremiumChangePct: pctChange(first.insurancePremiumIncTax, last.insurancePremiumIncTax),
    medianWageChangePct: pctChange(first.medianAnnualWage, last.medianAnnualWage),
    dwellingStockChangePct: pctChange(first.dwellingStock, last.dwellingStock),
    stampDutyRevenueChangePct: pctChange(first.stampDutyRevenue, last.stampDutyRevenue),
    housingCostIndexChangePct: pctChange(first.housingCostIndex, last.housingCostIndex),
  };

  return {
    id: scopeKey(scope),
    label,
    scope,
    years,
    summary,
  };
}

function runCity(params: ScenarioParams, cityIndex: number): CityScenarioOutputs {
  const { c, curves } = resolveMethodology(params);
  const policy = clampPolicyV2(params.policy);
  const base = params.cities[cityIndex];
  const meta = cityMeta(base.cityId);

  // Baselines: can be estimated from historical series if provided (calibration hook).
  const hist = params.advanced?.calibration?.enabled
    ? params.advanced?.calibration?.historyByCity?.[base.cityId]
    : undefined;

  const estimateAvgLogGrowth = (xs?: number[]): number | null => {
    if (!xs || xs.length < 3) return null;
    const diffs: number[] = [];
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1];
      const b = xs[i];
      if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) continue;
      diffs.push(Math.log(b / a));
    }
    if (diffs.length === 0) return null;
    return diffs.reduce((acc, d) => acc + d, 0) / diffs.length;
  };

  const BASELINE_NOMINAL_PRICE_GROWTH = estimateAvgLogGrowth(hist?.medianPrice) ?? 0.04;
  const BASELINE_NOMINAL_RENT_GROWTH =
    base.rentGrowthBaseline ?? estimateAvgLogGrowth(hist?.medianAnnualRent) ?? 0.035;
  // Use city-specific wage growth rate if available
  const BASELINE_WAGE_GROWTH = estimateAvgLogGrowth(hist?.medianAnnualWage) ?? base.wageGrowthRate ?? 0.03;
  const BASELINE_INFLATION = 0.028;

  const years: YearState[] = [];

  let year = base.year0;
  let population = base.population;
  let dwellingStock = base.dwellingStock;
  let completions = base.annualCompletions;

  let medianPrice = base.medianPrice;
  let medianAnnualRent = base.medianAnnualRent;

  let wageIndex = base.wageIndex;
  let cpiIndex = base.cpiIndex;
  // Track actual wage starting from city's baseline
  let medianAnnualWage = base.medianAnnualWage ?? 85_000;

  const baseRate = resolveBaseRateFromHistory({
    historyBundle: params.advanced?.calibration?.historyBundle,
    fallbackMortgageRate: base.mortgageRate,
    mortgageSpread: params.ratePath?.mortgageSpread,
  });
  let mortgageRate = Math.max(0, baseRate + (policy.mortgageRateDelta ?? 0));
  const mortgageTermYears = base.mortgageTermYears;

  const hci0 = housingCostIndex({ medianPrice, medianAnnualRent, wageIndex });

  const insuranceBases = defaultInsuranceBases(base);
  const investorShare = clamp(base.investorDwellingShare, 0, 0.6);
  let insurancePremiumExTax =
    insuranceBases.homeExTax * (1 - investorShare) + insuranceBases.landlordExTax * investorShare;
  let insurancePremiumTax = insurancePremiumExTax * (base.insuranceTaxRateEffective ?? 0.12);
  let insurancePremiumIncTax = insurancePremiumExTax + insurancePremiumTax;
  let cumulativeRentPaid = 0;
  let cumulativeInsurancePaid = 0;

  for (let i = 0; i < params.years; i++) {
    const households = householdsFromPopulation(population, c);

    const policyChannels = computePolicyChannelsForCityYear({
      yearIndex: i,
      base,
      policy,
    });

    let demandHouseholds = effectiveDemandHouseholds(households, policy);
    demandHouseholds = demandHouseholds * policyChannels.ownerOccDemandMultiplier;

    const investorChannels = computeInvestorPolicyChannels({
      curves,
      c,
      yearIndex: i,
      investorDwellingShare: base.investorDwellingShare,
      policy,
      dwellingStock,
    });

    const combinedInvestorMult =
      investorChannels.investorDemandMultiplier * policyChannels.investorDemandMultiplier;
    const rateMult = rateDemandMultiplier({ baseRate, currentRate: mortgageRate });
    demandHouseholds = demandHouseholds * combinedInvestorMult * rateMult;

    const effectiveStockForGap = dwellingStock * (1 + investorChannels.divestedDwellingsShare);
    const gapRatio = supplyGapRatio({ demandHouseholds, dwellingStock: effectiveStockForGap });

    const wageGrowth = curves.wageGrowth(year, BASELINE_WAGE_GROWTH);
    const inflation = curves.inflation(year, BASELINE_INFLATION);
    mortgageRate = computeRatePath({
      yearIndex: i,
      prevRate: mortgageRate,
      inflation,
      outputGap: clamp(gapRatio, -0.05, 0.05),
      config: params.ratePath ? { ...params.ratePath, baseRate } : undefined,
    });
    mortgageRate = Math.max(0, mortgageRate + (policy.mortgageRateDelta ?? 0));
    wageIndex = wageIndex * (1 + wageGrowth);
    cpiIndex = cpiIndex * (1 + inflation);
    medianAnnualWage = medianAnnualWage * (1 + wageGrowth);

    const nominalPriceGrowth = computeNominalPriceGrowth({
      baselinePriceGrowth: BASELINE_NOMINAL_PRICE_GROWTH,
      gapRatio,
      c,
      curves,
    });

    const completionsNext = computeCompletionsNextYear({
      baselineCompletions: base.annualCompletions * policyChannels.completionsMultiplier,
      supplyBoost: policy.supplyBoost ?? 0,
      expectedPriceGrowth: nominalPriceGrowth,
      curves,
    });
    const completionsNextWithPublic = completionsNext + policyChannels.additionalCompletions;
    const effectiveC =
      policyChannels.capacityLift > 0
        ? {
            ...c,
            constructionCapacity: {
              ...c.constructionCapacity,
              maxCompletionsYoYIncrease: c.constructionCapacity.maxCompletionsYoYIncrease * (1 + policyChannels.capacityLift),
            },
          }
        : c;
    const completionsNextCapped = capCompletionsByCapacity({
      currentCompletions: completions,
      proposedNextCompletions: completionsNextWithPublic,
      c: effectiveC,
    });

    const demolitions = dwellingStock * Math.max(0, base.demolitionRate);
    dwellingStock = Math.max(0, dwellingStock + completions - demolitions);

    const baselineSupplyGrowthRate =
      (base.annualCompletions - base.demolitionRate * dwellingStock) / Math.max(1, dwellingStock);
    const supplyGrowthRate =
      (completionsNextCapped - demolitions) / Math.max(1, dwellingStock);
    const supplyGrowthDelta = supplyGrowthRate - baselineSupplyGrowthRate;

    const netMigrationExpected =
      base.netMigrationPerYear * policyChannels.netMigrationMultiplier + policyChannels.netMigrationAdd;
    const baselinePopGrowthRate =
      base.naturalPopGrowthRate + base.netMigrationPerYear / Math.max(1, population);
    const populationGrowthRate =
      base.naturalPopGrowthRate + netMigrationExpected / Math.max(1, population);
    const populationGrowthDelta = populationGrowthRate - baselinePopGrowthRate;
    const wageGrowthDelta = wageGrowth - (base.wageGrowthRate ?? BASELINE_WAGE_GROWTH);

    const rentGapRatio =
      gapRatio + investorChannels.rentalSupplyShockShare + policyChannels.rentalSupplyShockShare;
    const investorDemandShock = clamp(1 - combinedInvestorMult, -0.2, 0.4);
    const rentResult = computeRentSeries({
      base,
      yearIndex: i,
      prevRent: medianAnnualRent,
      baselineRentGrowth: BASELINE_NOMINAL_RENT_GROWTH,
      gapRatio: rentGapRatio,
      investorDemandShock,
      supplyGrowthDelta,
      populationGrowthDelta,
      wageGrowthDelta,
      c,
      curves,
      rentGrowthModifier: (policy.rentGrowthModifier ?? 0) + policyChannels.rentGrowthModifier,
      rentGrowthCap: policyChannels.rentGrowthCap,
      rentRegulationCoverage: policyChannels.rentRegulationCoverage,
    });

    medianPrice = medianPrice * (1 + nominalPriceGrowth);
    medianAnnualRent = rentResult.nextRent;

    const turnoverRate = Math.max(0.01, Math.min(0.12, c.annualTurnoverRate * policyChannels.turnoverMultiplier));
    const stampDutyRate = Math.max(
      0,
      c.stampDutyEffectiveRate + (policy.stampDutyRateDelta ?? 0) + policyChannels.stampDutyRateDelta
    );
    const stampDutyRevenue = computeStampDutyRevenue({
      medianPrice,
      dwellingStock,
      annualTurnoverRate: turnoverRate,
      stampDutyRate,
    });

    const medianIncomeProxy = (wageIndex / 100) * 90000;
    const insurance = computeInsuranceSeries({
      base,
      prevPremiumExTax: insurancePremiumExTax,
      inflation,
      medianIncomeProxy,
    });
    insurancePremiumExTax = insurance.premiumExTax;
    insurancePremiumTax = insurance.premiumTax;
    insurancePremiumIncTax = insurance.premiumIncTax;

    cumulativeRentPaid += medianAnnualRent;
    cumulativeInsurancePaid += insurancePremiumIncTax;
    const principal = medianPrice * c.typicalLVR;
    const typicalMortgagePayment = amortizedAnnualPayment({
      principal,
      annualRate: mortgageRate,
      termYears: mortgageTermYears,
    });

    const priceToIncomeIndex = medianPrice / Math.max(1, medianIncomeProxy);
    const rentToIncomeIndex = medianAnnualRent / Math.max(1, medianIncomeProxy);
    const insuranceToIncomeIndex = insurancePremiumIncTax / Math.max(1, medianIncomeProxy);
    const typicalMortgagePaymentShareOfIncome = typicalMortgagePayment / Math.max(1, medianIncomeProxy);
    const typicalRentShareOfIncome = medianAnnualRent / Math.max(1, medianIncomeProxy);

    const deciles = computeDecilesProxy({
      c,
      medianPrice,
      medianAnnualRent,
      wageIndex,
      microdata:
        params.advanced?.microDistributions?.enabled
          ? extractCityMicrodata(params.advanced?.microDistributions?.microdata, base.cityId)
          : null,
      rentAssistanceShareOfRent: policyChannels.rentAssistanceShareOfRent,
      mortgageRate,
      mortgageTermYears,
    });

    years.push({
      year,
      population,
      households,
      dwellingStock,
      completions,
      medianPrice,
      medianAnnualRent,
      wageIndex,
      cpiIndex,
      medianAnnualWage,
      mortgageRate,
      demandHouseholds,
      gapRatio,
      nominalPriceGrowth,
      nominalRentGrowth: rentResult.nominalRentGrowth,
      stampDutyRevenue,
      policyChannels: {
        investorDemandMultiplier: investorChannels.investorDemandMultiplier,
        divestedDwellingsShare: investorChannels.divestedDwellingsShare,
        rentalSupplyShockShare: investorChannels.rentalSupplyShockShare,
        rentAssistanceShareOfRent: policyChannels.rentAssistanceShareOfRent,
      },
      affordability: {
        priceToIncomeIndex,
        rentToIncomeIndex,
        insuranceToIncomeIndex,
        typicalMortgagePayment,
        typicalMortgagePaymentShareOfIncome,
        typicalRentShareOfIncome,
      },
      deciles,
      insurancePremiumExTax,
      insurancePremiumTax,
      insurancePremiumIncTax,
      insuranceGrowth: insurance.insuranceGrowth,
      cumulativeRentPaid,
      cumulativeInsurancePaid,
    });

    const hci = housingCostIndex({ medianPrice, medianAnnualRent, wageIndex });
    const hciDelta = (hci - hci0) / Math.max(1e-9, hci0);
    const migrationAdj = curves.migrationResponse(hciDelta);

    const netMigration =
      (base.netMigrationPerYear * policyChannels.netMigrationMultiplier + policyChannels.netMigrationAdd) *
      (1 + migrationAdj);
    population = population * (1 + base.naturalPopGrowthRate) + netMigration;

    completions = completionsNextCapped;
    year += 1;
  }

  const first = years[0];
  const last = years[years.length - 1];

  const hciFirst = housingCostIndex({
    medianPrice: first.medianPrice,
    medianAnnualRent: first.medianAnnualRent,
    wageIndex: first.wageIndex,
  });
  const hciLast = housingCostIndex({
    medianPrice: last.medianPrice,
    medianAnnualRent: last.medianAnnualRent,
    wageIndex: last.wageIndex,
  });

  const summary: ScenarioSummary = {
    year0: first.year,
    yearN: last.year,
    medianPriceChangePct: pctChange(first.medianPrice, last.medianPrice),
    medianRentChangePct: pctChange(first.medianAnnualRent, last.medianAnnualRent),
    insurancePremiumChangePct: pctChange(first.insurancePremiumIncTax, last.insurancePremiumIncTax),
    medianWageChangePct: pctChange(first.medianAnnualWage, last.medianAnnualWage),
    dwellingStockChangePct: pctChange(first.dwellingStock, last.dwellingStock),
    stampDutyRevenueChangePct: pctChange(first.stampDutyRevenue, last.stampDutyRevenue),
    housingCostIndexChangePct: pctChange(hciFirst, hciLast),
  };

  return {
    cityId: base.cityId,
    cityName: base.cityName,
    state: meta.state,
    years,
    summary,
  };
}

/**
 * Main run: computes byCity, then builds byRegion:
 * - NATIONAL (all cities included)
 * - each STATE (subset)
 * - each CITY (for uniform API)
 */
export function runScenario(params: ScenarioParams): ScenarioOutputs {
  if (params.engine === "advanced" && params.advanced?.spatialEquilibrium?.enabled) {
    return runScenarioCoupledAdvanced(params);
  }
  const byCity = {} as Record<CityId, CityScenarioOutputs>;

  for (let i = 0; i < params.cities.length; i++) {
    const out = runCity(params, i);
    byCity[out.cityId] = out;
  }

  const includedCityIds = params.cities.map((c) => c.cityId);

  // Build state groupings from registry
  const byState = new Map<StateId, CityId[]>();
  includedCityIds.forEach((id) => {
    const st = cityMeta(id).state;
    const arr = byState.get(st) ?? [];
    arr.push(id);
    byState.set(st, arr);
  });

  const byRegion: Record<string, RegionScenarioOutputs> = {};

  // NATIONAL
  const nationalScope: Scope = { level: "national" };
  byRegion[scopeKey(nationalScope)] = aggregateRegion({
    scope: nationalScope,
    label: "National",
    cityIds: includedCityIds,
    byCity,
    baselines: params.cities,
  });

  // STATES
  (Array.from(byState.keys()) as StateId[]).forEach((st) => {
    const scope: Scope = { level: "state", state: st };
    byRegion[scopeKey(scope)] = aggregateRegion({
      scope,
      label: st,
      cityIds: byState.get(st)!,
      byCity,
      baselines: params.cities,
    });
  });

  // CITIES as "regions" (for uniform API)
  includedCityIds.forEach((id) => {
    const scope: Scope = { level: "city", city: id };
    const city = byCity[id];
    
    const basePrice = city.years[0].medianPrice;
    const baseRent = city.years[0].medianAnnualRent;
    const baseWage = city.years[0].medianAnnualWage;
    const baseInsurance = city.years[0].insurancePremiumIncTax;

    const years: RegionYearState[] = city.years.map((y) => {
      const hci = housingCostIndex({
        medianPrice: y.medianPrice,
        medianAnnualRent: y.medianAnnualRent,
        wageIndex: y.wageIndex,
      });
      return {
        year: y.year,
        population: y.population,
        dwellingStock: y.dwellingStock,
        medianPrice: y.medianPrice,
        medianAnnualRent: y.medianAnnualRent,
        insurancePremiumExTax: y.insurancePremiumExTax,
        insurancePremiumTax: y.insurancePremiumTax,
        insurancePremiumIncTax: y.insurancePremiumIncTax,
        insuranceToIncomeIndex: y.affordability.insuranceToIncomeIndex,
        cumulativeRentPaid: y.cumulativeRentPaid,
        cumulativeInsurancePaid: y.cumulativeInsurancePaid,
        stampDutyRevenue: y.stampDutyRevenue,
        wageIndex: (y.medianAnnualWage / Math.max(1e-9, baseWage)) * 100,
        medianAnnualWage: y.medianAnnualWage,
        housingCostIndex: hci,
        priceIndex: (y.medianPrice / Math.max(1e-9, basePrice)) * 100,
        rentIndex: (y.medianAnnualRent / Math.max(1e-9, baseRent)) * 100,
        insuranceIndex: (y.insurancePremiumIncTax / Math.max(1e-9, baseInsurance)) * 100,
      };
    });

    const first = years[0];
    const last = years[years.length - 1];

    byRegion[scopeKey(scope)] = {
      id: scopeKey(scope),
      label: city.cityName,
      scope,
      years,
      summary: {
        year0: first.year,
        yearN: last.year,
        medianPriceChangePct: pctChange(first.medianPrice, last.medianPrice),
        medianRentChangePct: pctChange(first.medianAnnualRent, last.medianAnnualRent),
        insurancePremiumChangePct: pctChange(first.insurancePremiumIncTax, last.insurancePremiumIncTax),
        medianWageChangePct: pctChange(first.medianAnnualWage, last.medianAnnualWage),
        dwellingStockChangePct: pctChange(first.dwellingStock, last.dwellingStock),
        stampDutyRevenueChangePct: pctChange(first.stampDutyRevenue, last.stampDutyRevenue),
        housingCostIndexChangePct: pctChange(first.housingCostIndex, last.housingCostIndex),
      },
    };
  });

  return { params, byCity, byRegion };
}

/**
 * UI helper: get a scoped view from outputs.
 */
export function getScopedView(outputs: ScenarioOutputs, scope: Scope): RegionScenarioOutputs {
  const key = scopeKey(scope);
  const found = outputs.byRegion[key];
  if (!found) {
    throw new Error(`Scope not found in outputs: ${key}. Did you include those cities in params.cities?`);
  }
  return found;
}

/**
 * Get all available scope keys from outputs.
 */
export function getAvailableScopes(outputs: ScenarioOutputs): string[] {
  return Object.keys(outputs.byRegion);
}
