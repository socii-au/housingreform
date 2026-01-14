import type { CityBaseState, PolicyLeversV2 } from "../methodology";
import type { PolicyChannelDelta, PolicyContext } from "./types";
import { emptyDelta } from "./types";
import { taxInvestorChannels } from "./taxInvestor";
import { macroprudentialChannels } from "./macroprudential";
import { subsidyChannels } from "./subsidies";
import { rentalChannels } from "./rental";
import { planningChannels } from "./planning";
import { publicHousingChannels } from "./publicHousing";
import { migrationChannels } from "./migration";

function mul(a: number, b: number): number {
  return a * b;
}

function add(a: number, b: number): number {
  return a + b;
}

function mergeDeltas(parts: PolicyChannelDelta[]): PolicyChannelDelta {
  const out = emptyDelta();
  parts.forEach((p) => {
    out.investorDemandMultiplier = mul(out.investorDemandMultiplier, p.investorDemandMultiplier);
    out.ownerOccDemandMultiplier = mul(out.ownerOccDemandMultiplier, p.ownerOccDemandMultiplier);
    out.rentalSupplyShockShare = add(out.rentalSupplyShockShare, p.rentalSupplyShockShare);
    out.rentGrowthModifier = add(out.rentGrowthModifier, p.rentGrowthModifier);

    // Rent regulation: take the most binding cap (lowest) if both specify.
    if (p.rentGrowthCap != null) {
      out.rentGrowthCap =
        out.rentGrowthCap == null ? p.rentGrowthCap : Math.min(out.rentGrowthCap, p.rentGrowthCap);
    }
    out.rentRegulationCoverage = Math.max(out.rentRegulationCoverage, p.rentRegulationCoverage);
    out.vacancyDecontrol = out.vacancyDecontrol && p.vacancyDecontrol;

    out.completionsMultiplier = mul(out.completionsMultiplier, p.completionsMultiplier);
    out.additionalCompletions = add(out.additionalCompletions, p.additionalCompletions);
    out.capacityLift = add(out.capacityLift, p.capacityLift);

    out.turnoverMultiplier = mul(out.turnoverMultiplier, p.turnoverMultiplier);
    out.stampDutyRateDelta = add(out.stampDutyRateDelta, p.stampDutyRateDelta);
    out.mortgageRateDelta = add(out.mortgageRateDelta, p.mortgageRateDelta);

    out.netMigrationMultiplier = mul(out.netMigrationMultiplier, p.netMigrationMultiplier);
    out.netMigrationAdd = add(out.netMigrationAdd, p.netMigrationAdd);

    out.rentAssistanceShareOfRent = Math.max(out.rentAssistanceShareOfRent, p.rentAssistanceShareOfRent);

    out.notes.push(...p.notes);
    out.saturations.push(...p.saturations);
  });
  return out;
}

export function computePolicyChannelsForCityYear(opts: {
  yearIndex: number;
  base: CityBaseState;
  policy: PolicyLeversV2;
}): PolicyChannelDelta {
  const ctx: PolicyContext = {
    yearIndex: opts.yearIndex,
    base: opts.base,
    policy: opts.policy,
  };
  return mergeDeltas([
    taxInvestorChannels(ctx),
    macroprudentialChannels(ctx),
    subsidyChannels(ctx),
    rentalChannels(ctx),
    planningChannels(ctx),
    publicHousingChannels(ctx),
    migrationChannels(ctx),
  ]);
}

