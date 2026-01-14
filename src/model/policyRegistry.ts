import type { PolicyLevers, PolicyLeversV2 } from "./methodology";

export type PolicyBound = { min: number; max: number };

export interface PolicyParamMeta {
  key: string;
  label: string;
  bounds: PolicyBound;
  /**
   * If true, UI should treat non-zero usage as requiring historical calibration for credibility.
   * (Model can still run, but should warn.)
   */
  calibrationFirst?: boolean;
  unit?: "share" | "pp" | "rate";
  description?: string;
}

export const DEFAULT_POLICY_LEVERS_V2: PolicyLeversV2 = {
  // Existing v1 fields (kept for backward compatibility)
  supplyBoost: 0,
  demandReduction: 0,
  stampDutyRateDelta: 0,
  mortgageRateDelta: 0,
  rentGrowthModifier: 0,
  negativeGearingMode: "none",
  negativeGearingIntensity: 0,
  ownershipCapEnabled: false,
  ownershipCapEnforcement: 0,
  excessInvestorStockShare: 0,
  divestmentPhased: true,
  rampYears: 5,

  // New grouped levers
  taxInvestor: {
    cgtDiscountDelta: 0,
    landTaxShift: 0,
    vacancyTaxIntensity: 0,
    shortStayRegulationIntensity: 0,
    foreignBuyerRestrictionIntensity: 0,
  },
  credit: {
    serviceabilityBufferDelta: 0,
    dtiCapTightness: 0,
    investorLendingLimitTightness: 0,
  },
  subsidies: {
    firstHomeBuyerSubsidyIntensity: 0,
  },
  rental: {
    rentAssistanceIntensity: 0,
    rentRegulationCap: null,
    rentRegulationCoverage: 0,
    vacancyDecontrol: true,
  },
  planning: {
    upzoningIntensity: 0,
    infrastructureEnablement: 0,
    infrastructureLagYears: 3,
  },
  publicCommunity: {
    publicHousingBuildBoost: 0,
    publicHousingAcquisitionSharePerYear: 0,
    conversionToSocialSharePerYear: 0,
  },
  migration: {
    netOverseasMigrationShock: 0,
  },
};

/**
 * Realistic bounds for levers (hard caps). These are intentionally conservative and can be revisited.
 */
export const POLICY_PARAMS: PolicyParamMeta[] = [
  // Existing
  { key: "supplyBoost", label: "Supply boost", bounds: { min: -0.10, max: 0.25 }, unit: "share" },
  { key: "demandReduction", label: "Demand reduction", bounds: { min: -0.05, max: 0.15 }, unit: "share" },

  // Tax/investor
  {
    key: "taxInvestor.cgtDiscountDelta",
    label: "CGT discount change",
    bounds: { min: -0.25, max: 0.25 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "taxInvestor.landTaxShift",
    label: "Stamp duty -> land tax shift",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "taxInvestor.vacancyTaxIntensity",
    label: "Vacancy tax intensity",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "taxInvestor.shortStayRegulationIntensity",
    label: "Short-stay regulation intensity",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "taxInvestor.foreignBuyerRestrictionIntensity",
    label: "Foreign buyer restriction intensity",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },

  // Credit / macroprudential
  {
    key: "credit.serviceabilityBufferDelta",
    label: "Serviceability buffer delta",
    bounds: { min: -0.02, max: 0.03 },
    unit: "rate",
    calibrationFirst: true,
  },
  {
    key: "credit.dtiCapTightness",
    label: "DTI cap tightness",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "credit.investorLendingLimitTightness",
    label: "Investor lending limit tightness",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },

  // Subsidies
  {
    key: "subsidies.firstHomeBuyerSubsidyIntensity",
    label: "First home buyer subsidy intensity",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },

  // Rental settings
  {
    key: "rental.rentAssistanceIntensity",
    label: "Rent assistance intensity",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "rental.rentRegulationCoverage",
    label: "Rent regulation coverage",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },

  // Planning / infrastructure
  {
    key: "planning.upzoningIntensity",
    label: "Upzoning intensity",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "planning.infrastructureEnablement",
    label: "Infrastructure enablement",
    bounds: { min: 0, max: 1 },
    unit: "share",
    calibrationFirst: true,
  },

  // Public/community
  {
    key: "publicCommunity.publicHousingBuildBoost",
    label: "Public housing build boost",
    bounds: { min: 0, max: 0.20 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "publicCommunity.publicHousingAcquisitionSharePerYear",
    label: "Public housing acquisition share/yr",
    bounds: { min: 0, max: 0.01 },
    unit: "share",
    calibrationFirst: true,
  },
  {
    key: "publicCommunity.conversionToSocialSharePerYear",
    label: "Private-to-social conversion share/yr",
    bounds: { min: 0, max: 0.01 },
    unit: "share",
    calibrationFirst: true,
  },

  // Migration
  {
    key: "migration.netOverseasMigrationShock",
    label: "Net overseas migration shock",
    bounds: { min: -0.30, max: 0.30 },
    unit: "share",
    calibrationFirst: true,
  },
];

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function getPolicyValue(policy: any, key: string): any {
  const parts = key.split(".");
  let cur: any = policy;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function listCalibrationFirstActive(policy: PolicyLeversV2): string[] {
  const p = toPolicyV2(policy);
  const out: string[] = [];
  POLICY_PARAMS.forEach((m) => {
    if (!m.calibrationFirst) return;
    const v = getPolicyValue(p as any, m.key);
    const dv = getPolicyValue(DEFAULT_POLICY_LEVERS_V2 as any, m.key);
    if (typeof v === "number") {
      if (Math.abs(v - (typeof dv === "number" ? dv : 0)) > 1e-9) out.push(m.label);
    } else if (typeof v === "boolean") {
      if (v !== (typeof dv === "boolean" ? dv : false)) out.push(m.label);
    } else if (v != null) {
      if (v !== dv) out.push(m.label);
    }
  });
  return out;
}

export function listAtBounds(policy: PolicyLeversV2): string[] {
  const p = toPolicyV2(policy);
  const out: string[] = [];
  POLICY_PARAMS.forEach((m) => {
    const v = getPolicyValue(p as any, m.key);
    if (typeof v !== "number") return;
    const { min, max } = m.bounds;
    if (Math.abs(v - min) < 1e-12 || Math.abs(v - max) < 1e-12) out.push(m.label);
  });
  return out;
}

export function toPolicyV2(policy: PolicyLevers | PolicyLeversV2): PolicyLeversV2 {
  const p = policy as any;
  // If it already has groups, assume v2.
  if (p.taxInvestor && p.credit && p.rental) return p as PolicyLeversV2;
  return {
    ...DEFAULT_POLICY_LEVERS_V2,
    ...(policy as PolicyLevers),
  };
}

export function clampPolicyV2(policy: PolicyLevers | PolicyLeversV2): PolicyLeversV2 {
  const p = toPolicyV2(policy);
  // Clamp v1 fields that remain central
  const supplyBoost = clamp(p.supplyBoost, -0.10, 0.25);
  const demandReduction = clamp(p.demandReduction, -0.05, 0.15);
  const stampDutyRateDelta = clamp(p.stampDutyRateDelta, -0.03, 0.03);
  const mortgageRateDelta = clamp(p.mortgageRateDelta, -0.03, 0.05);
  const rentGrowthModifier = clamp(p.rentGrowthModifier, -0.05, 0.05);
  const ownershipCapEnforcement = clamp(p.ownershipCapEnforcement, 0, 1);
  const excessInvestorStockShare = clamp(p.excessInvestorStockShare, 0, 0.50);
  const negativeGearingIntensity = clamp(p.negativeGearingIntensity, 0, 1);
  const rampYears = clamp(p.rampYears, 0, 15);

  return {
    ...p,
    supplyBoost,
    demandReduction,
    stampDutyRateDelta,
    mortgageRateDelta,
    rentGrowthModifier,
    ownershipCapEnforcement,
    excessInvestorStockShare,
    negativeGearingIntensity,
    rampYears,
    taxInvestor: {
      ...p.taxInvestor,
      cgtDiscountDelta: clamp(p.taxInvestor.cgtDiscountDelta, -0.25, 0.25),
      landTaxShift: clamp(p.taxInvestor.landTaxShift, 0, 1),
      vacancyTaxIntensity: clamp(p.taxInvestor.vacancyTaxIntensity, 0, 1),
      shortStayRegulationIntensity: clamp(p.taxInvestor.shortStayRegulationIntensity, 0, 1),
      foreignBuyerRestrictionIntensity: clamp(p.taxInvestor.foreignBuyerRestrictionIntensity, 0, 1),
    },
    credit: {
      ...p.credit,
      serviceabilityBufferDelta: clamp(p.credit.serviceabilityBufferDelta, -0.02, 0.03),
      dtiCapTightness: clamp(p.credit.dtiCapTightness, 0, 1),
      investorLendingLimitTightness: clamp(p.credit.investorLendingLimitTightness, 0, 1),
    },
    subsidies: {
      ...p.subsidies,
      firstHomeBuyerSubsidyIntensity: clamp(p.subsidies.firstHomeBuyerSubsidyIntensity, 0, 1),
    },
    rental: {
      ...p.rental,
      rentAssistanceIntensity: clamp(p.rental.rentAssistanceIntensity, 0, 1),
      rentRegulationCoverage: clamp(p.rental.rentRegulationCoverage, 0, 1),
      rentRegulationCap: p.rental.rentRegulationCap == null ? null : clamp(p.rental.rentRegulationCap, -0.05, 0.08),
    },
    planning: {
      ...p.planning,
      upzoningIntensity: clamp(p.planning.upzoningIntensity, 0, 1),
      infrastructureEnablement: clamp(p.planning.infrastructureEnablement, 0, 1),
      infrastructureLagYears: clamp(p.planning.infrastructureLagYears, 0, 10),
    },
    publicCommunity: {
      ...p.publicCommunity,
      publicHousingBuildBoost: clamp(p.publicCommunity.publicHousingBuildBoost, 0, 0.20),
      publicHousingAcquisitionSharePerYear: clamp(p.publicCommunity.publicHousingAcquisitionSharePerYear, 0, 0.01),
      conversionToSocialSharePerYear: clamp(p.publicCommunity.conversionToSocialSharePerYear, 0, 0.01),
    },
    migration: {
      ...p.migration,
      netOverseasMigrationShock: clamp(p.migration.netOverseasMigrationShock, -0.30, 0.30),
    },
  };
}

