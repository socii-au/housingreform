export type PartyKey = "labor" | "coalition" | "greens" | "nationals" | "independent" | "bipartisan";

export const PARTY_META: Record<PartyKey, { label: string; color: string; textColor: string }> = {
  labor: { label: "Labor", color: "#d11a2a", textColor: "#ffffff" },
  coalition: { label: "Coalition", color: "#0038a8", textColor: "#ffffff" },
  greens: { label: "Greens", color: "#0ea34a", textColor: "#ffffff" },
  nationals: { label: "Nationals", color: "#f4c430", textColor: "#1f2937" },
  independent: { label: "Independents", color: "#7c3aed", textColor: "#ffffff" },
  bipartisan: { label: "Bipartisan/Regulators", color: "#6b7280", textColor: "#ffffff" },
};

export const PARTY_ORDER: PartyKey[] = ["labor", "coalition", "greens", "nationals", "independent", "bipartisan"];

export function PartyChip({ party }: { party: PartyKey }) {
  const meta = PARTY_META[party];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: meta.color,
        color: meta.textColor,
        letterSpacing: 0.2,
      }}
      aria-label={`Party support: ${meta.label}`}
      title={`Party support: ${meta.label}`}
    >
      {meta.label}
    </span>
  );
}

export const PRESET_PARTIES: Record<string, PartyKey[]> = {
  "ng-remove": ["labor"],
  "ng-remove-fast": ["greens"],
  "ng-restore": ["coalition"],
  "ownership-cap": ["greens"],
  "ownership-cap-aggressive": ["greens"],
  "supply-boost": ["labor"],
  comprehensive: ["independent"],
  "land-tax-transition": ["coalition"],
  "macroprudential-tightening": ["bipartisan"],
  "short-stay-clampdown": ["greens"],
  "public-housing-build": ["labor"],
  "migration-shock-down": ["coalition"],
  "all-levers": ["independent"],
};

export const GROUP_PARTIES: Record<string, PartyKey[]> = {
  "Negative Gearing": ["labor", "greens", "coalition"],
  "Ownership Cap": ["greens"],
  "Supply & Demand": ["labor", "coalition"],
  "Tax & investor incentives": ["coalition"],
  "Credit / macro-prudential": ["bipartisan"],
  "Demand-side subsidies": ["labor"],
  "Rental settings": ["greens", "labor"],
  "Planning / infrastructure": ["coalition", "labor"],
  "Public & community housing": ["labor", "greens"],
  "Population": ["coalition"],
};

export const POLICY_KEY_PARTIES: Record<string, PartyKey[]> = {
  "negativeGearingMode": ["labor", "greens", "coalition"],
  "negativeGearingIntensity": ["labor", "greens", "coalition"],
  "ownershipCapEnabled": ["greens"],
  "ownershipCapEnforcement": ["greens"],
  "excessInvestorStockShare": ["greens"],
  "divestmentPhased": ["greens"],
  "supplyBoost": ["labor", "coalition"],
  "demandReduction": ["labor", "coalition"],
  "rentGrowthModifier": ["greens", "labor"],
  "taxInvestor.cgtDiscountDelta": ["coalition"],
  "taxInvestor.landTaxShift": ["coalition"],
  "taxInvestor.vacancyTaxIntensity": ["coalition"],
  "taxInvestor.shortStayRegulationIntensity": ["greens"],
  "taxInvestor.foreignBuyerRestrictionIntensity": ["coalition"],
  "credit.serviceabilityBufferDelta": ["bipartisan"],
  "credit.dtiCapTightness": ["bipartisan"],
  "credit.investorLendingLimitTightness": ["bipartisan"],
  "subsidies.firstHomeBuyerSubsidyIntensity": ["labor"],
  "rental.rentAssistanceIntensity": ["labor"],
  "rental.rentRegulationCap": ["greens"],
  "rental.rentRegulationCoverage": ["greens"],
  "rental.vacancyDecontrol": ["greens"],
  "planning.upzoningIntensity": ["coalition", "labor"],
  "planning.infrastructureEnablement": ["coalition", "labor"],
  "planning.infrastructureLagYears": ["coalition", "labor"],
  "publicCommunity.publicHousingBuildBoost": ["labor", "greens"],
  "publicCommunity.publicHousingAcquisitionSharePerYear": ["labor", "greens"],
  "publicCommunity.conversionToSocialSharePerYear": ["labor", "greens"],
  "migration.netOverseasMigrationShock": ["coalition"],
  "stampDutyRateDelta": ["coalition"],
  "mortgageRateDelta": ["bipartisan"],
  "rampYears": ["bipartisan"],
};

export function summarizePartySupport(parties: PartyKey[]): { counts: Record<PartyKey, number>; top: PartyKey[] } {
  const counts = {} as Record<PartyKey, number>;
  PARTY_ORDER.forEach((p) => {
    counts[p] = 0;
  });
  parties.forEach((p) => {
    counts[p] = (counts[p] ?? 0) + 1;
  });
  const max = Math.max(0, ...Object.values(counts));
  const top = max > 0 ? PARTY_ORDER.filter((p) => counts[p] === max) : [];
  return { counts, top };
}
