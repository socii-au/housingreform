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

export interface YearState {
  year: Year;

  population: number;
  households: number;

  dwellingStock: number;
  completions: number;

  medianPrice: number;
  medianAnnualRent: number;

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
  stampDutyRevenue: number;
  wageIndex: number;
  /** Actual median annual wage in AUD */
  medianAnnualWage: number;
  housingCostIndex: number;
  /** Indexed values for comparison charts (year 0 = 100) */
  priceIndex: number;
  rentIndex: number;
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

  const st = params.cities.map((base) => ({
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
    mortgageRate: Math.max(0, base.mortgageRate + (policy.mortgageRateDelta ?? 0)),
    mortgageTermYears: base.mortgageTermYears,
    lastNominalPriceGrowth: BASELINE_NOMINAL_PRICE_GROWTH,
  }));

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
      demandHouseholds = demandHouseholds * combinedInvestorMult;

      const effectiveStockForGap = s.dwellingStock * (1 + investorChannels.divestedDwellingsShare);
      const gapRatio = supplyGapRatio({ demandHouseholds, dwellingStock: effectiveStockForGap });

      const wageGrowthBase = base.wageGrowthRate ?? 0.03;
      const wageGrowth = curves.wageGrowth(s.year, wageGrowthBase);
      const inflation = curves.inflation(s.year, BASELINE_INFLATION);
      s.wageIndex = s.wageIndex * (1 + wageGrowth);
      s.cpiIndex = s.cpiIndex * (1 + inflation);
      s.medianAnnualWage = s.medianAnnualWage * (1 + wageGrowth);

      const nominalPriceGrowth = computeNominalPriceGrowth({
        baselinePriceGrowth: BASELINE_NOMINAL_PRICE_GROWTH,
        gapRatio,
        c,
        curves,
      });

      const rentGapRatio =
        gapRatio + investorChannels.rentalSupplyShockShare + policyChannels.rentalSupplyShockShare;
      const nominalRentGrowth = computeNominalRentGrowth({
        baselineRentGrowth: BASELINE_NOMINAL_RENT_GROWTH,
        gapRatio: rentGapRatio,
        c,
        curves,
        rentGrowthModifier: (policy.rentGrowthModifier ?? 0) + policyChannels.rentGrowthModifier,
      });
      const cappedRentGrowth =
        policyChannels.rentGrowthCap != null && policyChannels.rentRegulationCoverage > 0
          ? (1 - policyChannels.rentRegulationCoverage) * nominalRentGrowth +
            policyChannels.rentRegulationCoverage * Math.min(nominalRentGrowth, policyChannels.rentGrowthCap)
          : nominalRentGrowth;

      s.medianPrice = s.medianPrice * (1 + nominalPriceGrowth);
      s.medianAnnualRent = s.medianAnnualRent * (1 + cappedRentGrowth);

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
      const principal = s.medianPrice * c.typicalLVR;
      const typicalMortgagePayment = amortizedAnnualPayment({
        principal,
        annualRate: s.mortgageRate,
        termYears: s.mortgageTermYears,
      });

      const priceToIncomeIndex = s.medianPrice / Math.max(1, medianIncomeProxy);
      const rentToIncomeIndex = s.medianAnnualRent / Math.max(1, medianIncomeProxy);
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
        nominalRentGrowth,
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
          typicalMortgagePayment,
          typicalMortgagePaymentShareOfIncome,
          typicalRentShareOfIncome,
        },
        deciles,
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
        stampDutyRevenue: y.stampDutyRevenue,
        wageIndex: (y.medianAnnualWage / Math.max(1e-9, baseWage)) * 100,
        medianAnnualWage: y.medianAnnualWage,
        housingCostIndex: hci,
        priceIndex: (y.medianPrice / Math.max(1e-9, basePrice)) * 100,
        rentIndex: (y.medianAnnualRent / Math.max(1e-9, baseRent)) * 100,
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

    const hci = housingCostIndex({ medianPrice, medianAnnualRent, wageIndex });

    // Indexed values (year 0 = 100)
    const priceIndex = (medianPrice / basePrice) * 100;
    const rentIndex = (medianAnnualRent / baseRent) * 100;
    const wageIdx = (medianAnnualWage / baseWage) * 100;

    years.push({
      year,
      population,
      dwellingStock,
      medianPrice,
      medianAnnualRent,
      stampDutyRevenue,
      wageIndex: wageIdx,
      medianAnnualWage,
      housingCostIndex: hci,
      priceIndex,
      rentIndex,
    });
  }

  const first = years[0];
  const last = years[years.length - 1];

  const summary: ScenarioSummary = {
    year0: first.year,
    yearN: last.year,
    medianPriceChangePct: pctChange(first.medianPrice, last.medianPrice),
    medianRentChangePct: pctChange(first.medianAnnualRent, last.medianAnnualRent),
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
  const BASELINE_NOMINAL_RENT_GROWTH = estimateAvgLogGrowth(hist?.medianAnnualRent) ?? 0.035;
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

  let mortgageRate = Math.max(0, base.mortgageRate + (policy.mortgageRateDelta ?? 0));
  const mortgageTermYears = base.mortgageTermYears;

  const hci0 = housingCostIndex({ medianPrice, medianAnnualRent, wageIndex });

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

    demandHouseholds =
      demandHouseholds * investorChannels.investorDemandMultiplier * policyChannels.investorDemandMultiplier;

    const effectiveStockForGap = dwellingStock * (1 + investorChannels.divestedDwellingsShare);
    const gapRatio = supplyGapRatio({ demandHouseholds, dwellingStock: effectiveStockForGap });

    const wageGrowth = curves.wageGrowth(year, BASELINE_WAGE_GROWTH);
    const inflation = curves.inflation(year, BASELINE_INFLATION);
    wageIndex = wageIndex * (1 + wageGrowth);
    cpiIndex = cpiIndex * (1 + inflation);
    medianAnnualWage = medianAnnualWage * (1 + wageGrowth);

    const nominalPriceGrowth = computeNominalPriceGrowth({
      baselinePriceGrowth: BASELINE_NOMINAL_PRICE_GROWTH,
      gapRatio,
      c,
      curves,
    });

    const rentGapRatio =
      gapRatio + investorChannels.rentalSupplyShockShare + policyChannels.rentalSupplyShockShare;

    const nominalRentGrowth = computeNominalRentGrowth({
      baselineRentGrowth: BASELINE_NOMINAL_RENT_GROWTH,
      gapRatio: rentGapRatio,
      c,
      curves,
      rentGrowthModifier: (policy.rentGrowthModifier ?? 0) + policyChannels.rentGrowthModifier,
    });
    const cappedRentGrowth =
      policyChannels.rentGrowthCap != null && policyChannels.rentRegulationCoverage > 0
        ? (1 - policyChannels.rentRegulationCoverage) * nominalRentGrowth +
          policyChannels.rentRegulationCoverage * Math.min(nominalRentGrowth, policyChannels.rentGrowthCap)
        : nominalRentGrowth;

    medianPrice = medianPrice * (1 + nominalPriceGrowth);
    medianAnnualRent = medianAnnualRent * (1 + cappedRentGrowth);

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
    const principal = medianPrice * c.typicalLVR;
    const typicalMortgagePayment = amortizedAnnualPayment({
      principal,
      annualRate: mortgageRate,
      termYears: mortgageTermYears,
    });

    const priceToIncomeIndex = medianPrice / Math.max(1, medianIncomeProxy);
    const rentToIncomeIndex = medianAnnualRent / Math.max(1, medianIncomeProxy);
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
      nominalRentGrowth,
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
        typicalMortgagePayment,
        typicalMortgagePaymentShareOfIncome,
        typicalRentShareOfIncome,
      },
      deciles,
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
        stampDutyRevenue: y.stampDutyRevenue,
        wageIndex: (y.medianAnnualWage / Math.max(1e-9, baseWage)) * 100,
        medianAnnualWage: y.medianAnnualWage,
        housingCostIndex: hci,
        priceIndex: (y.medianPrice / Math.max(1e-9, basePrice)) * 100,
        rentIndex: (y.medianAnnualRent / Math.max(1e-9, baseRent)) * 100,
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
