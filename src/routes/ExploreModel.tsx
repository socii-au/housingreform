import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { ControlsPanel } from "../components/ControlsPanel";
import { useModel, scopeLabel } from "../model/ModelContext";
import { CITIES, ALL_STATES, STATE_NAMES, cityMeta } from "../model/regions";
import type { CityId, StateId } from "../model/regions";
import { HelpExpander } from "../components/shared/HelpText";
import { DEFAULT_POLICY_LEVERS_V2, POLICY_PARAMS, listAtBounds, listCalibrationFirstActive, toPolicyV2 } from "../model/policyRegistry";
import { buildRegionTimeline } from "../model/history/timeline";
import { resolveMethodology, type PolicyLeversV2 } from "../model/methodology";
import { sanitizeHistoryBundleWithReport } from "../security/sanitize";
import { SCENARIO_PRESETS } from "../model/presets";
import {
  PARTY_ORDER,
  PARTY_META,
  PartyChip,
  type PartyKey,
  POLICY_KEY_PARTIES,
  PRESET_PARTIES,
  summarizePartySupport,
} from "../components/policyParty";

const AustraliaCrisisMap = lazy(() =>
  import("../components/AustraliaCrisisMap").then((m) => ({ default: m.AustraliaCrisisMap }))
);
const PriceVsBaseline = lazy(() =>
  import("../components/charts/PriceVsBaseline").then((m) => ({ default: m.PriceVsBaseline }))
);
const WageVsHousingChart = lazy(() =>
  import("../components/charts/WageVsHousingChart").then((m) => ({ default: m.default }))
);
const DwellingStockArea = lazy(() =>
  import("../components/charts/OwnershipMixArea").then((m) => ({ default: m.DwellingStockArea }))
);
const DecileImpact = lazy(() =>
  import("../components/charts/DecileImpact").then((m) => ({ default: m.DecileImpact }))
);
const PolicyChannelsFlow = lazy(() =>
  import("../components/InvestorFlow").then((m) => ({ default: m.PolicyChannelsFlow }))
);
const SummaryCounter = lazy(() =>
  import("../components/PublicHousingCounter").then((m) => ({ default: m.SummaryCounter }))
);

/* ================================================================
   POLICY PRESETS — grouped for the hero dropdown
   ================================================================ */
const REFORM_PRESETS = SCENARIO_PRESETS.filter((p) =>
  ["ng-remove", "ng-remove-fast", "ng-restore", "ownership-cap", "ownership-cap-aggressive", "supply-boost", "cgt-repeal"].includes(p.id)
);

const EXPERT_PRESETS = SCENARIO_PRESETS.filter((p) =>
  ["land-tax-transition", "macroprudential-tightening", "short-stay-clampdown", "public-housing-build", "migration-shock-down", "immigration-cap"].includes(p.id)
);

/* ================================================================
   HELPER COMPONENTS
   ================================================================ */

function fmtAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

function fmtPctSigned(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function WarningsBanner({ params, calibrationReport }: { params: any; calibrationReport: any }) {
  const policy = toPolicyV2(params.policy as any);
  const activeCalibrationFirst = listCalibrationFirstActive(policy);
  const atBounds = listAtBounds(policy);

  const calEnabled = !!params.advanced?.calibration?.enabled;
  const hasHistory = !!params.advanced?.calibration?.historyByCity;

  const warnings: string[] = [];
  if (activeCalibrationFirst.length > 0 && (!calEnabled || !hasHistory)) {
    warnings.push("Calibration-first levers are active but no historical series are attached. Treat results as directional.");
  }
  if (atBounds.length > 0) {
    warnings.push(`Some levers are at hard bounds: ${atBounds.slice(0, 4).join(", ")}${atBounds.length > 4 ? "…" : ""}`);
  }
  (calibrationReport?.warnings ?? []).slice(0, 2).forEach((w: string) => warnings.push(w));

  const hb = params.advanced?.calibration?.historyBundle as any;
  if (hb) {
    const rep = sanitizeHistoryBundleWithReport(hb).report;
    if (rep.ok && (rep.droppedCityKeys || rep.cappedPoints)) {
      warnings.push(`History bundle sanitized: dropped ${rep.droppedCityKeys} city keys, capped ${rep.cappedPoints} points.`);
    }
  }

  const micro = params.advanced?.microDistributions;
  if (micro?.enabled) {
    const byCity = (micro?.microdata as any)?.byCity as Record<string, unknown[]> | undefined;
    if (!byCity || Object.keys(byCity).length === 0) {
      warnings.push("Microdata enabled but no byCity data provided. Stress metrics use the proxy.");
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div className="xp-warnings">
      {warnings.map((w, i) => (
        <div key={i} className="callout warning" style={{ padding: "8px 12px", fontSize: 13 }}>
          {w}
        </div>
      ))}
    </div>
  );
}

type PolicyDifficulty = {
  rating: "Easy" | "Moderate" | "Challenging" | "Hard" | "Highly Improbable";
  score: number;
  factors: {
    federal: string[];
    state: string[];
    industry: string[];
    implementation: string[];
    severity: {
      federal: "Low" | "Medium" | "High";
      state: "Low" | "Medium" | "High";
      industry: "Low" | "Medium" | "High";
      implementation: "Low" | "Medium" | "High";
    };
  };
  summary: string;
};

function assessPolicyDifficulty(policy: PolicyLeversV2): PolicyDifficulty {
  let score = 10;
  const factors: PolicyDifficulty["factors"] = {
    federal: [], state: [], industry: [], implementation: [],
    severity: { federal: "Low", state: "Low", industry: "Low", implementation: "Low" },
  };

  if (policy.negativeGearingMode !== "none") {
    score += 22;
    factors.federal.push("Federal tax changes are sensitive to Senate cross-bench.");
    factors.industry.push("Investor tax concessions face strong coordinated pushback.");
  }
  if (policy.ownershipCapEnabled) {
    score += 28;
    factors.implementation.push("Ownership caps trigger legal risk and constitutional challenges.");
    factors.industry.push("Likely opposition from property investment lobbies.");
  }
  if (policy.taxInvestor.landTaxShift > 0.2 || policy.stampDutyRateDelta < -0.01) {
    score += 12;
    factors.state.push("State revenue exposure creates intergovernmental friction.");
  }
  if (policy.taxInvestor.cgtDiscountDelta < -0.1) { score += 10; factors.federal.push("CGT discount reductions trigger investor lobbying."); }
  if (policy.taxInvestor.vacancyTaxIntensity > 0.2 || policy.taxInvestor.shortStayRegulationIntensity > 0.2) {
    score += 8; factors.industry.push("Short-stay platforms and hosts commonly oppose vacancy/STR rules.");
  }
  if (policy.rental.rentRegulationCoverage > 0.2) { score += 16; factors.state.push("Tenancy law changes vary by jurisdiction."); }
  if (policy.credit.serviceabilityBufferDelta > 0.01 || policy.credit.dtiCapTightness > 0.2) {
    score += 8; factors.federal.push("Macro-prudential tightening faces regulator caution.");
  }
  if (policy.publicCommunity.publicHousingBuildBoost > 0.1) { score += 10; factors.state.push("Large public builds require long-term funding certainty."); }
  if (policy.supplyBoost > 0.15 || policy.planning.upzoningIntensity > 0.3) {
    score += 9; factors.state.push("Planning reforms face local council veto points.");
  }
  if (policy.migration.netOverseasMigrationShock < -0.1) {
    score += 7; factors.federal.push("Migration settings intersect with workforce shortages.");
  }
  if (policy.subsidies.firstHomeBuyerSubsidyIntensity > 0.15) score += 4;
  if (policy.rental.rentAssistanceIntensity > 0.15) score += 4;
  if (policy.taxInvestor.foreignBuyerRestrictionIntensity > 0.3) score += 6;
  if (policy.demandReduction > 0.1) score += 5;

  factors.implementation.push("Complexity increases when multiple levers are combined.");
  factors.federal.push("Stakeholder alignment (state vs federal) is often the decisive constraint.");

  const severityFromCount = (n: number): "Low" | "Medium" | "High" => n >= 4 ? "High" : n >= 2 ? "Medium" : "Low";
  factors.severity = {
    federal: severityFromCount(factors.federal.length),
    state: severityFromCount(factors.state.length),
    industry: severityFromCount(factors.industry.length),
    implementation: severityFromCount(factors.implementation.length),
  };

  score = Math.min(100, score);
  const rating = score <= 18 ? "Easy" : score <= 32 ? "Moderate" : score <= 52 ? "Challenging" : score <= 72 ? "Hard" : "Highly Improbable";
  const summary = rating === "Easy" ? "Low conflict; likely to pass if politically prioritized."
    : rating === "Moderate" ? "Some pushback expected, but feasible with negotiation."
    : rating === "Challenging" ? "Multiple stakeholder veto points; passage likely needs strong mandate."
    : rating === "Hard" ? "Significant industry and political resistance expected."
    : "Would require exceptional political alignment or crisis conditions.";

  return { rating, score, factors, summary };
}

/* ================================================================
   MAIN PAGE COMPONENT
   ================================================================ */
export function ExploreModel() {
  const {
    scope,
    scopedView,
    selectedCityData,
    params,
    outputs,
    calibrationReport,
    showHistory,
    historyIndexBase,
    focusYear,
    setFocusYear,
    selectedPresets,
    togglePreset,
    selectNational,
    selectState,
    selectCity,
  } = useModel();

  const { years } = scopedView;
  const first = years[0];

  /* Bottom sheet state for advanced controls */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showIndirectReforms, setShowIndirectReforms] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    if (!sheetOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [sheetOpen, closeSheet]);

  /* Loading state */
  if (!first || years.length === 0) {
    return (
      <div style={{ padding: 80, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16, animation: "spin 1s linear infinite" }}>⏳</div>
        <h2 className="h2">Loading simulation...</h2>
        <p className="muted">Calculating outcomes for {params.cities.length} cities</p>
      </div>
    );
  }

  /* Derived data */
  const decileRows = selectedCityData?.years[selectedCityData.years.length - 1]?.deciles.rows ?? null;
  const { c } = resolveMethodology(params);
  const timelineView = showHistory
    ? buildRegionTimeline({
        outputs, scope,
        historyBundle: params.advanced?.calibration?.historyBundle as any,
        cities: params.cities, c,
        stampDutyRate: c.stampDutyEffectiveRate + ((params.policy as any).stampDutyRateDelta ?? 0),
        year0: first.year, indexBase: historyIndexBase,
      })
    : null;
  const chartSeries = timelineView ? timelineView.timeline : years;
  const cutoverYear = timelineView ? timelineView.cutoverYear : first.year;
  const selectedYear = focusYear ?? (chartSeries as any)[(chartSeries as any).length - 1]?.year ?? first.year;
  const baseValueForIndex = (() => {
    const baseYear = historyIndexBase === "year0" ? first.year : chartSeries[0]?.year;
    const basePoint = chartSeries.find((p: any) => p.year === baseYear) as any;
    return {
      medianPrice: (basePoint?.medianPrice ?? first.medianPrice) as number,
      medianAnnualRent: (basePoint?.medianAnnualRent ?? first.medianAnnualRent) as number,
    };
  })();

  /* Policy analysis */
  const policy = toPolicyV2(params.policy as any);
  const defaultPolicy = DEFAULT_POLICY_LEVERS_V2;
  const policyDifficulty = assessPolicyDifficulty(policy);

  const getByPath = (obj: any, path: string) => path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  const formatPolicyValue = (key: string, value: any): string => {
    if (value == null) return "n/a";
    if (key.includes("rentRegulationCap")) return `${Math.round(value * 100)}% cap`;
    if (typeof value === "boolean") return value ? "enabled" : "disabled";
    if (Math.abs(value) < 1e-9) return "0";
    if (key.includes("Rate") || key.includes("Delta")) return `${(value * 100).toFixed(1)}pp`;
    if (key.includes("Intensity") || key.includes("Share") || key.includes("Boost")) return `${Math.round(value * 100)}%`;
    if (key.includes("LagYears") || key.includes("rampYears")) return `${value} years`;
    return `${Math.round(value * 100)}%`;
  };

  const manualChanges = (() => {
    const changes: { key: string; label: string; value: string; parties: PartyKey[] }[] = [];
    POLICY_PARAMS.forEach((param) => {
      const current = getByPath(policy as any, param.key);
      const baseline = getByPath(defaultPolicy as any, param.key);
      if (current === baseline) return;
      changes.push({ key: param.key, label: param.label, value: formatPolicyValue(param.key, current), parties: POLICY_KEY_PARTIES[param.key] ?? [] });
    });
    if (policy.negativeGearingMode !== defaultPolicy.negativeGearingMode) changes.push({ key: "negativeGearingMode", label: "Negative gearing mode", value: policy.negativeGearingMode, parties: POLICY_KEY_PARTIES.negativeGearingMode ?? [] });
    if (policy.negativeGearingIntensity !== defaultPolicy.negativeGearingIntensity) changes.push({ key: "negativeGearingIntensity", label: "NG intensity", value: formatPolicyValue("negativeGearingIntensity", policy.negativeGearingIntensity), parties: POLICY_KEY_PARTIES.negativeGearingIntensity ?? [] });
    if (policy.ownershipCapEnabled !== defaultPolicy.ownershipCapEnabled) changes.push({ key: "ownershipCapEnabled", label: "Ownership cap", value: policy.ownershipCapEnabled ? "enabled" : "disabled", parties: POLICY_KEY_PARTIES.ownershipCapEnabled ?? [] });
    if (policy.ownershipCapEnforcement !== defaultPolicy.ownershipCapEnforcement) changes.push({ key: "ownershipCapEnforcement", label: "Cap enforcement", value: formatPolicyValue("ownershipCapEnforcement", policy.ownershipCapEnforcement), parties: POLICY_KEY_PARTIES.ownershipCapEnforcement ?? [] });
    if (policy.excessInvestorStockShare !== defaultPolicy.excessInvestorStockShare) changes.push({ key: "excessInvestorStockShare", label: "Excess investor stock", value: formatPolicyValue("excessInvestorStockShare", policy.excessInvestorStockShare), parties: POLICY_KEY_PARTIES.excessInvestorStockShare ?? [] });
    if (policy.divestmentPhased !== defaultPolicy.divestmentPhased) changes.push({ key: "divestmentPhased", label: "Divestment phasing", value: policy.divestmentPhased ? "phased" : "immediate", parties: POLICY_KEY_PARTIES.divestmentPhased ?? [] });
    if (policy.stampDutyRateDelta !== defaultPolicy.stampDutyRateDelta) changes.push({ key: "stampDutyRateDelta", label: "Stamp duty delta", value: formatPolicyValue("stampDutyRateDelta", policy.stampDutyRateDelta), parties: POLICY_KEY_PARTIES.stampDutyRateDelta ?? [] });
    if (policy.rampYears !== defaultPolicy.rampYears) changes.push({ key: "rampYears", label: "Policy ramp", value: formatPolicyValue("rampYears", policy.rampYears), parties: POLICY_KEY_PARTIES.rampYears ?? [] });
    return changes;
  })();

  const activePresets = selectedPresets.filter((p) => p !== "baseline");
  const presetParties = activePresets.flatMap((p) => PRESET_PARTIES[p] ?? []);
  const manualParties = manualChanges.flatMap((c) => c.parties);
  const partySummary = summarizePartySupport([...presetParties, ...manualParties]);
  const partyKeyLabel = partySummary.top.length ? partySummary.top.map((p) => PARTY_META[p].label).join(" / ") : "None (baseline)";

  /* Summary stats for map info cards */
  const lastYear = years[years.length - 1];
  const priceChange = first.medianPrice > 0 ? (lastYear.medianPrice - first.medianPrice) / first.medianPrice : 0;
  const rentChange = first.medianAnnualRent > 0 ? (lastYear.medianAnnualRent - first.medianAnnualRent) / first.medianAnnualRent : 0;
  const dwellingGrowth = first.dwellingStock > 0 ? (lastYear.dwellingStock - first.dwellingStock) : 0;

  /* Feasibility meter color */
  const feasColor = policyDifficulty.score <= 18 ? "#16a34a" : policyDifficulty.score <= 32 ? "#22c55e" : policyDifficulty.score <= 52 ? "#ca8a04" : policyDifficulty.score <= 72 ? "#ea580c" : "#dc2626";

  return (
    <>
      {/* FAB for advanced controls */}
      <button type="button" className="fab" onClick={() => setSheetOpen(true)} aria-label="Open advanced controls" aria-expanded={sheetOpen}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-.97l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.18 7.18 0 0 0-1.67-.97l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.25-1.17.59-1.67.97l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.49.49 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.97s.03.66.07.97l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.5.38 1.06.72 1.67.97l.38 2.65c.05.24.26.42.49.42h4c.24 0 .44-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.67-.97l2.49 1c.22.08.49 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65Z" fill="currentColor"/>
        </svg>
      </button>

      {/* Bottom sheet for advanced controls */}
      {sheetOpen && (
        <>
          <div className="bottomSheetBackdrop" onClick={closeSheet} aria-hidden="true" />
          <div className="bottomSheet" role="dialog" aria-modal="true" aria-label="Advanced controls">
            <div className="bottomSheetHandle" />
            <div className="bottomSheetHeader">
              <h3 className="h3" style={{ margin: 0 }}>Advanced Controls</h3>
              <button type="button" className="drawerClose" onClick={closeSheet} aria-label="Close controls">✕</button>
            </div>
            <div className="bottomSheetBody">
              <ControlsPanel />
            </div>
          </div>
        </>
      )}

      <div className="explore-flow">

        {/* ============================================
            SECTION 1 — HERO: POLICY SELECTION CTA
           ============================================ */}
        <section className="xp-hero" aria-labelledby="xp-hero-heading">
          <div className="xp-hero-inner">
            <h1 id="xp-hero-heading">What happens if Australia changes its housing policy?</h1>
            <p className="xp-hero-subtitle">
              Select one or more policy reforms below, then scroll to see how they affect housing prices,
              rents, and affordability across the country.
            </p>

            <div className="xp-hero-controls">
              {/* Quick-pick reform pills */}
              <div style={{ flex: "1 1 100%" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
                  Reforms
                </div>
                <div className="xp-hero-pills">
                  {REFORM_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`xp-policy-pill ${selectedPresets.includes(preset.id) ? "active" : ""}`}
                      onClick={() => togglePreset(preset.id)}
                      aria-pressed={selectedPresets.includes(preset.id)}
                    >
                      <span className="pill-check" aria-hidden="true">
                        {selectedPresets.includes(preset.id) ? "✓" : ""}
                      </span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Indirect reforms (show/hide) */}
              <div style={{ flex: "1 1 100%" }}>
                {showIndirectReforms ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 10 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>
                        Indirect reforms
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowIndirectReforms(false)}
                        aria-label="Hide indirect reforms"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: 12,
                          color: "#64748b",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Hide
                      </button>
                    </div>
                    <div className="xp-hero-pills">
                      {EXPERT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`xp-policy-pill ${selectedPresets.includes(preset.id) ? "active" : ""}`}
                          onClick={() => togglePreset(preset.id)}
                          aria-pressed={selectedPresets.includes(preset.id)}
                        >
                          <span className="pill-check" aria-hidden="true">
                            {selectedPresets.includes(preset.id) ? "✓" : ""}
                          </span>
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowIndirectReforms(true)}
                    aria-expanded="false"
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      background: "rgba(100, 116, 139, 0.1)",
                      border: "1px solid rgba(100, 116, 139, 0.3)",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#64748b",
                      cursor: "pointer",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    Show indirect reforms
                  </button>
                )}
              </div>

              {/* Actions row */}
              <div className="xp-hero-actions">
                <button
                  type="button"
                  className="xp-btn-advanced"
                  onClick={() => setSheetOpen(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z" fill="currentColor"/>
                  </svg>
                  Fine-tune controls
                </button>

                {selectedPresets.length > 1 && (
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    Stacking {selectedPresets.length} scenarios — effects combine
                  </span>
                )}
              </div>
            </div>

            {/* Scope row: current view badge + Select State + Select City */}
            <div className="xp-scope-row">
              <div className="scope-badge">
                <span>{scope.level === "national" ? "🇦🇺" : scope.level === "state" ? "📍" : "🏙️"}</span>
                <span>{scopeLabel(scope)}</span>
                {scope.level === "national" && <span style={{ opacity: 0.7 }}>({params.cities.length} cities)</span>}
              </div>
              <label className="xp-scope-select-wrap" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>Select State</span>
                <select
                  aria-label="Select State"
                  value={scope.level === "national" ? "NATIONAL" : scope.level === "state" ? scope.state : cityMeta(scope.city).state}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "NATIONAL") selectNational();
                    else selectState(v as StateId);
                  }}
                  className="xp-scope-select"
                >
                  <option value="NATIONAL">National</option>
                  {ALL_STATES.map((st) => (
                    <option key={st} value={st}>{STATE_NAMES[st]}</option>
                  ))}
                </select>
              </label>
              {(scope.level === "state" || scope.level === "city") && (() => {
                const currentState: StateId = scope.level === "state" ? scope.state : cityMeta(scope.city).state;
                const citiesInState = params.cities
                  .filter((c) => cityMeta(c.cityId).state === currentState)
                  .map((c) => ({ id: c.cityId, name: cityMeta(c.cityId).name }))
                  .sort((a, b) => a.name.localeCompare(b.name));
                return (
                  <label className="xp-scope-select-wrap" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>Select City</span>
                    <select
                      aria-label="Select City"
                      value={scope.level === "city" ? scope.city : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) selectCity(v as CityId);
                      }}
                      className="xp-scope-select"
                    >
                      <option value="">Select city</option>
                      {citiesInState.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                );
              })()}
              <label className="xp-scope-select-wrap" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>Jump to year:</span>
                <select
                  id="xp-year-select"
                  aria-label="Jump to year"
                  value={selectedYear}
                  onChange={(e) => setFocusYear(Number(e.target.value))}
                  className="xp-scope-select"
                  style={{ minWidth: 80 }}
                >
                  {(chartSeries as any).map((p: any) => (
                    <option key={`yr-${p.year}`} value={p.year}>{p.year}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setFocusYear(null)}
                style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(125, 211, 252, 0.25)", background: "rgba(255, 255, 255, 0.08)", color: "#7dd3fc", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Latest
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                This model is a free tool by the not-for-profit research team at SOCii. Results update instantly.
              </span>
            </div>
          </div>
        </section>

        {/* ============================================
            AFFORDABILITY TABLE — updates with policy & year
           ============================================ */}
        {(() => {
          const byCity = outputs?.byCity ?? {};
          const capitalIds = CITIES.filter((c) => c.isCapital).map((c) => c.id);
          const includedCapitals = capitalIds.filter((id) => params.cities.some((c) => c.cityId === id));
          const year0 = first?.year ?? 0;
          const findYearState = (cityId: CityId, year: number) => {
            const city = byCity[cityId];
            if (!city?.years?.length) return null;
            const exact = city.years.find((y: any) => y.year === year);
            if (exact) return exact;
            const sorted = [...city.years].sort((a: any, b: any) => a.year - b.year);
            let prev = sorted[0];
            for (const y of sorted) {
              if (y.year >= year) return y.year - year <= year - prev.year ? y : prev;
              prev = y;
            }
            return prev;
          };
          const fmtAUDTable = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
          const fmtAUDK = (n: number) => n >= 1e6 ? fmtAUDTable(n) : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(n / 1000) * 1000);
          const dirColor = (current: number, baseline: number) => {
            if (baseline === 0 || current === baseline) return undefined;
            return current > baseline ? "#dc2626" : "#16a34a";
          };
          /* Table uses 10% deposit (90% LVR), 30-year term. Model's typicalMortgagePayment is for 80% LVR; scale to 90% for display. */
          const depositShare = 0.10;
          const lvrTable = 1 - depositShare; /* 0.90 */
          const lvrModel = 0.80;
          const repayScale = lvrTable / lvrModel; /* 1.125 */
          const postTaxShare = 0.30;
          const effectiveTaxRate = 0.28;

          const rows = includedCapitals.map((cityId) => {
            const base = findYearState(cityId, year0);
            const current = findYearState(cityId, selectedYear);
            const name = CITIES.find((c) => c.id === cityId)?.name ?? cityId;
            const price = current?.medianPrice ?? 0;
            const priceBase = base?.medianPrice ?? price;
            const deposit = price * depositShare;
            const depositBase = priceBase * depositShare;
            const loan = price * lvrTable;
            const loanBase = priceBase * lvrTable;
            const annualRepayModel = (current as any)?.affordability?.typicalMortgagePayment ?? 0;
            const annualRepayModelBase = (base as any)?.affordability?.typicalMortgagePayment ?? annualRepayModel;
            const annualRepay = annualRepayModel * repayScale;
            const annualRepayBase = annualRepayModelBase * repayScale;
            const postTaxAnnual = (annualRepay / postTaxShare) || 0;
            const postTaxAnnualBase = (annualRepayBase / postTaxShare) || 0;
            const incomeReq = postTaxAnnual > 0 ? postTaxAnnual / (1 - effectiveTaxRate) : 0;
            const incomeReqBase = postTaxAnnualBase > 0 ? postTaxAnnualBase / (1 - effectiveTaxRate) : 0;
            const monthlyRepay = annualRepay / 12;
            const monthlyRepayBase = annualRepayBase / 12;
            return {
              name,
              cityId,
              medianPrice: price,
              medianPriceBase: priceBase,
              deposit,
              depositBase,
              loan,
              loanBase,
              monthlyRepay,
              monthlyRepayBase,
              incomeReq,
              incomeReqBase,
            };
          }).filter((r) => r.medianPrice > 0 || r.medianPriceBase > 0);

          if (rows.length === 0) return null;

          return (
            <section className="xp-section" style={{ background: "var(--surface-alt)" }} aria-labelledby="affordability-table-heading">
              <div className="xp-section-inner">
                <h2 id="affordability-table-heading" className="h2" style={{ marginBottom: 8 }}>
                  Annual income needed to afford a property in each capital city
                </h2>
                <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Before-tax income required so that monthly mortgage repayments (90% LVR at the simulated rate) equal 30% of post-tax income. Year {selectedYear}. Values are colour-coded vs start of simulation (year {year0}) — green = lower than baseline, red = higher.
                </p>
                <div className="card" style={{ padding: 0, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#15803d", color: "white" }}>
                        <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700 }}>Capital city</th>
                        <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700 }}>Median property value</th>
                        <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700 }}>Deposit (10%)</th>
                        <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700 }}>Loan amount</th>
                        <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700 }}>Monthly repayment</th>
                        <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700 }}>Income required, individual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.cityId} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.name}</td>
                          <td style={{ textAlign: "right", padding: "10px 12px", color: dirColor(r.medianPrice, r.medianPriceBase) }}>{fmtAUDK(r.medianPrice)}</td>
                          <td style={{ textAlign: "right", padding: "10px 12px", color: dirColor(r.deposit, r.depositBase) }}>{fmtAUDK(r.deposit)}</td>
                          <td style={{ textAlign: "right", padding: "10px 12px", color: dirColor(r.loan, r.loanBase) }}>{fmtAUDK(r.loan)}</td>
                          <td style={{ textAlign: "right", padding: "10px 12px", color: dirColor(r.monthlyRepay, r.monthlyRepayBase) }}>{fmtAUDTable(r.monthlyRepay)}</td>
                          <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: dirColor(r.incomeReq, r.incomeReqBase) }}>{r.incomeReq >= 1000 ? fmtAUDK(r.incomeReq) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 12, marginBottom: 0, lineHeight: 1.5, maxWidth: "72ch" }}>
                  <strong>Assumptions:</strong> Deposit 10% of property value (90% loan-to-value ratio). Mortgage term 30 years. Interest rate is the simulated mortgage rate for that city and year from the model. &quot;Income required, individual&quot; is the before-tax annual income such that monthly mortgage repayments equal 30% of post-tax income (approximate Australian tax applied to convert to gross income). Lenders mortgage insurance and other fees not included. This table is illustrative only and does not constitute lending or financial advice.
                </p>
              </div>
            </section>
          );
        })()}

        {/* ============================================
            SECTION 2 — MAP + KEY METRICS
           ============================================ */}
        <section className="xp-section xp-map-section" aria-labelledby="xp-map-heading">
          <div className="xp-section-inner">
            <WarningsBanner params={params} calibrationReport={calibrationReport} />

            <Suspense fallback={<div className="card" style={{ padding: 32, textAlign: "center" }}>Loading map…</div>}>
              <AustraliaCrisisMap
                outputs={outputs}
                params={params as any}
                year={selectedYear}
                historyBundle={params.advanced?.calibration?.historyBundle as any}
                title={`Regional crisis heatmap — ${scopeLabel(scope)}`}
                scope={scope}
              />
            </Suspense>

            <div className="xp-map-meta">
              <div className="xp-map-card">
                <div className="xp-map-card-title">Median price change</div>
                <div className="xp-map-card-value" style={{ color: priceChange > 0.5 ? "#dc2626" : priceChange > 0.2 ? "#ca8a04" : "#16a34a" }}>
                  {fmtPctSigned(priceChange)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {fmtAUD(first.medianPrice)} → {fmtAUD(lastYear.medianPrice)} over {params.years} years
                </div>
              </div>
              <div className="xp-map-card">
                <div className="xp-map-card-title">Median rent change</div>
                <div className="xp-map-card-value" style={{ color: rentChange > 0.4 ? "#dc2626" : rentChange > 0.15 ? "#ca8a04" : "#16a34a" }}>
                  {fmtPctSigned(rentChange)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {fmtAUD(first.medianAnnualRent)}/yr → {fmtAUD(lastYear.medianAnnualRent)}/yr
                </div>
              </div>
              <div className="xp-map-card">
                <div className="xp-map-card-title">Net new dwellings</div>
                <div className="xp-map-card-value">
                  {dwellingGrowth > 0 ? "+" : ""}{new Intl.NumberFormat("en-AU").format(Math.round(dwellingGrowth))}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Total stock growth over simulation period
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            SECTION 3 — HOUSING PRICES / RENTAL PRICES
           ============================================ */}
        <section className="xp-section xp-charts-twin" aria-labelledby="xp-charts-heading">
          <div className="xp-section-inner">
            <h2 className="h2" id="xp-charts-heading" style={{ margin: "0 0 6px" }}>Price &amp; Rent Trajectories</h2>
            <p className="muted" style={{ fontSize: 14, margin: "0 0 16px" }}>
              How housing prices and rents evolve under your selected policies.
            </p>

            <div className="xp-charts-tip">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 16v-4m0-4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Hover or tap a year on either chart to see that year highlighted on the map above.
            </div>

            <div className="chart-grid-primary">
              <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading chart…</div>}>
                <PriceVsBaseline
                  title="Housing prices"
                  series={chartSeries as any}
                  dataKey="medianPrice"
                  baseValue={baseValueForIndex.medianPrice}
                  cutoverYear={cutoverYear}
                  onHoverYear={setFocusYear}
                />
              </Suspense>
              <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading chart…</div>}>
                <PriceVsBaseline
                  title="Rents"
                  series={chartSeries as any}
                  dataKey="medianAnnualRent"
                  baseValue={baseValueForIndex.medianAnnualRent}
                  cutoverYear={cutoverYear}
                  onHoverYear={setFocusYear}
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* ============================================
            WAGE VS HOUSING GROWTH — NATIONAL
           ============================================ */}
        <section className="xp-section xp-segment" aria-labelledby="xp-wage-heading">
          <div className="xp-section-inner">
            <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading chart…</div>}>
              <WageVsHousingChart
                years={chartSeries as any}
                scopeLabel={scopeLabel(scope)}
                cutoverYear={cutoverYear}
                onHoverYear={setFocusYear}
              />
            </Suspense>
          </div>
        </section>

        {/* ============================================
            HOUSING STOCK & POLICY EFFECTS
           ============================================ */}
        <section className="xp-section xp-segment" aria-labelledby="xp-secondary-heading">
          <div className="xp-section-inner">
            <h2 className="h2" id="xp-secondary-heading" style={{ margin: "0 0 12px" }}>Housing Stock &amp; Policy Effects</h2>
            <div className="chart-grid-secondary">
              <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading chart…</div>}>
                <DwellingStockArea series={chartSeries as any} onHoverYear={setFocusYear} />
              </Suspense>
              {selectedCityData && (
                <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading chart…</div>}>
                  <PolicyChannelsFlow series={selectedCityData.years} />
                </Suspense>
              )}
            </div>
          </div>
        </section>

        {/* ============================================
            SECTION 4 — POLICY SUMMARY + PARTY ALIGNMENT
           ============================================ */}
        <section className="xp-section xp-policy-summary" aria-labelledby="xp-policy-heading">
          <div className="xp-section-inner">
            <h2 className="h2" id="xp-policy-heading" style={{ margin: "0 0 6px" }}>Policy Summary &amp; Political Alignment</h2>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
              Summary of selected policies and their typical party associations. Informational only, not an endorsement.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Color key:</span>
              {PARTY_ORDER.map((p) => <PartyChip key={`legend-${p}`} party={p} />)}
            </div>

            <div className="xp-policy-grid">
              {/* Active presets */}
              <div className="xp-policy-block">
                <h3>Active presets</h3>
                {activePresets.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>Baseline only (no preset selected).</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {activePresets.map((p) => (
                      <li key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span>{SCENARIO_PRESETS.find((sp) => sp.id === p)?.name ?? p}</span>
                        {(PRESET_PARTIES[p] ?? []).map((party) => <PartyChip key={`${p}-${party}`} party={party} />)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Manual adjustments */}
              <div className="xp-policy-block">
                <h3>Manual adjustments</h3>
                {manualChanges.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>No manual changes from baseline.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {manualChanges.map((ch) => (
                      <li key={ch.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span>{ch.label}: <strong>{ch.value}</strong></span>
                        {ch.parties.map((party) => <PartyChip key={`${ch.key}-${party}`} party={party as any} />)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Most represented party */}
              <div className="xp-policy-block">
                <h3>Most represented party</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>{partyKeyLabel}</span>
                  {partySummary.top.map((p) => <PartyChip key={`top-${p}`} party={p} />)}
                </div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Based on party associations across your selected policies.
                </p>
              </div>

              {/* Feasibility assessment */}
              <div className="xp-policy-block">
                <h3>Feasibility &amp; pushback</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{policyDifficulty.rating}</span>
                  <span className="muted" style={{ fontSize: 12 }}>({policyDifficulty.score}/100)</span>
                </div>
                <div className="xp-feasibility-meter">
                  <div className="xp-feasibility-fill" style={{ width: `${policyDifficulty.score}%`, background: feasColor }} />
                </div>
                <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>{policyDifficulty.summary}</p>

                {Object.values(policyDifficulty.factors).some((xs) => Array.isArray(xs) && xs.length > 0) && (
                  <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12 }}>
                    {(
                      [
                        ["Federal", policyDifficulty.factors.federal, policyDifficulty.factors.severity.federal],
                        ["State", policyDifficulty.factors.state, policyDifficulty.factors.severity.state],
                        ["Industry", policyDifficulty.factors.industry, policyDifficulty.factors.severity.industry],
                        ["Implementation", policyDifficulty.factors.implementation, policyDifficulty.factors.severity.implementation],
                      ] as Array<[string, string[], "Low" | "Medium" | "High"]>
                    ).map(([label, items, severity]) =>
                      items.length ? (
                        <details key={label} className="help-panel" style={{ padding: 8 }}>
                          <summary className="help-panel-trigger" style={{ gap: 8, padding: "8px 10px", minHeight: 36 }}>
                            <span>{label}</span>
                            <span className="muted" style={{ fontSize: 11 }}>Severity: <strong>{severity}</strong></span>
                          </summary>
                          <div className="help-panel-content" style={{ padding: "0 10px 10px" }}>
                            <ul style={{ margin: "6px 0 0 16px" }}>
                              {items.map((f, i) => <li key={`${label}-${i}`}>{f}</li>)}
                            </ul>
                          </div>
                        </details>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            SECTION 5 — SUMMARY METRICS
           ============================================ */}
        <section className="xp-section xp-segment" aria-labelledby="xp-summary-heading">
          <div className="xp-section-inner">
            <h2 className="h2" id="xp-summary-heading" style={{ margin: "0 0 12px" }}>Scenario Summary</h2>
            <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading summary…</div>}>
              <SummaryCounter />
            </Suspense>
          </div>
        </section>

        {/* ============================================
            SECTION 6 — DECILE ANALYSIS
           ============================================ */}
        {decileRows && (
          <section className="xp-section xp-segment" aria-labelledby="xp-decile-heading">
            <div className="xp-section-inner">
              <div className="section-header">
                <h2 className="h2" id="xp-decile-heading" style={{ margin: 0 }}>Distributional Impact</h2>
                <span className="badge-warning">Proxy estimate</span>
              </div>
              <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading distribution…</div>}>
                <DecileImpact rows={decileRows} />
              </Suspense>
            </div>
          </section>
        )}

        {/* ============================================
            SECTION 9 — INTERPRETATION GUIDE
           ============================================ */}
        <section className="xp-section xp-segment">
          <div className="xp-section-inner">
            <details className="help-panel">
              <summary className="help-panel-trigger">
                <span>💡</span>
                <span>How to interpret results</span>
              </summary>
              <div className="help-panel-content">
                <HelpExpander summary="Understanding the charts" defaultOpen>
                  <ul>
                    <li><strong>Price and rent charts:</strong> Show median values in Australian dollars over time</li>
                    <li><strong>Stock vs demand:</strong> Gap = market tightness</li>
                    <li><strong>Trend colors:</strong> Green = improving, Red = worsening</li>
                  </ul>
                </HelpExpander>
                <HelpExpander summary="Common questions">
                  <ul>
                    <li><strong>Why do rents increase with NG removal?</strong> Short-term rental supply shock</li>
                    <li><strong>Why delayed ownership cap effects?</strong> Divestment over ramp period</li>
                  </ul>
                </HelpExpander>
              </div>
            </details>
          </div>
        </section>

      </div>
    </>
  );
}
