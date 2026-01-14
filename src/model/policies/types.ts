import type { CityBaseState, PolicyLeversV2 } from "../methodology";

export interface PolicyChannelDelta {
  investorDemandMultiplier: number;
  ownerOccDemandMultiplier: number;

  /** Added to rent gap ratio: + = tighter rental market, - = looser (more rental availability). */
  rentalSupplyShockShare: number;

  /** Additive modifier on nominal rent growth (e.g., -0.01 = -1pp). */
  rentGrowthModifier: number;

  /**
   * Optional rent regulation cap and coverage. Applied in runScenario as a weighted clamp:
   * growth' = (1-coverage)*growth + coverage*min(growth, cap)
   */
  rentGrowthCap: number | null;
  rentRegulationCoverage: number;
  vacancyDecontrol: boolean;

  /** Multiply baseline completions before capacity capping. */
  completionsMultiplier: number;
  /** Additive completions per year (e.g. public build program). */
  additionalCompletions: number;
  /** Capacity lift applied to YoY completion growth cap (0..something). */
  capacityLift: number;

  /** Multiplier on annual turnover rate (affects stamp duty revenue proxy). */
  turnoverMultiplier: number;
  /** Additional stamp duty rate delta from tax reforms (added on top of v1 lever). */
  stampDutyRateDelta: number;
  /** Additional mortgage rate delta from credit policies (added on top of v1 lever). */
  mortgageRateDelta: number;

  /** Multiplier on baseline net migration per year. */
  netMigrationMultiplier: number;
  /** Additive net migration adjustment per year. */
  netMigrationAdd: number;

  /** Renter income supplement expressed as share of annual rent (used for stress only). */
  rentAssistanceShareOfRent: number;

  notes: string[];
  saturations: string[];
}

export function emptyDelta(): PolicyChannelDelta {
  return {
    investorDemandMultiplier: 1,
    ownerOccDemandMultiplier: 1,
    rentalSupplyShockShare: 0,
    rentGrowthModifier: 0,
    rentGrowthCap: null,
    rentRegulationCoverage: 0,
    vacancyDecontrol: true,
    completionsMultiplier: 1,
    additionalCompletions: 0,
    capacityLift: 0,
    turnoverMultiplier: 1,
    stampDutyRateDelta: 0,
    mortgageRateDelta: 0,
    netMigrationMultiplier: 1,
    netMigrationAdd: 0,
    rentAssistanceShareOfRent: 0,
    notes: [],
    saturations: [],
  };
}

export interface PolicyContext {
  yearIndex: number;
  base: CityBaseState;
  policy: PolicyLeversV2;
}

