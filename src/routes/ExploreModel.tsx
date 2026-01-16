import { lazy, Suspense } from "react";
import { ControlsPanel } from "../components/ControlsPanel";
import { useModel, scopeLabel } from "../model/ModelContext";
import { HelpExpander } from "../components/shared/HelpText";
import { DEFAULT_POLICY_LEVERS_V2, POLICY_PARAMS, listAtBounds, listCalibrationFirstActive, toPolicyV2 } from "../model/policyRegistry";
import { buildRegionTimeline } from "../model/history/timeline";
import { resolveMethodology, type PolicyLeversV2 } from "../model/methodology";
import { sanitizeHistoryBundleWithReport } from "../security/sanitize";
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

function MicrodataWarningsBanner({ params }: { params: ReturnType<typeof useModel>["params"] }) {
  const micro = params.advanced?.microDistributions;
  const enabled = !!micro?.enabled;
  const meta = (micro?.microdata as any)?.meta as
    | {
        warnings?: string[];
        notes?: string[];
        inferredMappings?: boolean;
      }
    | undefined;

  if (!enabled) return null;

  const warnings = (meta?.warnings ?? []).slice();
  const inferred = !!meta?.inferredMappings;

  // Missing microdata is a common failure mode; make it explicit.
  const byCity = (micro?.microdata as any)?.byCity as Record<string, unknown[]> | undefined;
  if (!byCity || Object.keys(byCity).length === 0) {
    warnings.unshift("Microdata is enabled, but no byCity microdata was provided. Stress metrics will use the proxy.");
  }

  if (!inferred && warnings.length === 0) return null;

  return (
    <div className="callout warning" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Microdata mapping inferred</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        This run is using inferred column mappings for income/tenure/weights. For reliability, export the normalized
        schema (`income_annual_aud`, `tenure_code` as R/M/O, optional `weight`) or pass `fields` + `tenureMap`
        explicitly.
      </div>
      {warnings.length > 0 && (
        <ul style={{ margin: "8px 0 0 18px", fontSize: 13 }}>
          {warnings.slice(0, 3).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {meta?.notes?.length ? (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Show detection details</summary>
          <ul style={{ margin: "8px 0 0 18px", fontSize: 12, color: "var(--muted)" }}>
            {meta.notes.slice(0, 12).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}
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
    federal: [] as string[],
    state: [] as string[],
    industry: [] as string[],
    implementation: [] as string[],
    severity: {
      federal: "Low",
      state: "Low",
      industry: "Low",
      implementation: "Low",
    },
  };

  if (policy.negativeGearingMode !== "none") {
    score += 22;
    factors.federal.push("Federal tax changes are sensitive to Senate cross‑bench and independents.");
    factors.industry.push("Investor tax concessions are politically sensitive and face strong coordinated pushback.");
    factors.industry.push("Past reform attempts suggest high likelihood of campaign-style opposition.");
  }
  if (policy.ownershipCapEnabled) {
    score += 28;
    factors.implementation.push("Ownership caps trigger legal risk and constitutional challenges.");
    factors.implementation.push("Administrative enforcement complexity can delay passage and weaken design.");
    factors.industry.push("Likely opposition from property investment lobbies and landlord associations.");
  }
  if (policy.taxInvestor.landTaxShift > 0.2 || policy.stampDutyRateDelta < -0.01) {
    score += 12;
    factors.federal.push("State revenue exposure creates intergovernmental friction.");
    factors.state.push("State parliaments control land tax and stamp duty; reform requires state buy‑in.");
    factors.implementation.push("Transition funding and compensation become major negotiation points.");
  }
  if (policy.taxInvestor.cgtDiscountDelta < -0.1) {
    score += 10;
    factors.federal.push("Federal tax measures are exposed to Senate cross‑bench bargaining.");
    factors.industry.push("CGT discount reductions often trigger coordinated investor and media lobbying.");
  }
  if (policy.taxInvestor.vacancyTaxIntensity > 0.2 || policy.taxInvestor.shortStayRegulationIntensity > 0.2) {
    score += 8;
    factors.industry.push("Short‑stay platforms, hosts, and landlord groups commonly oppose vacancy/STR rules.");
    factors.industry.push("Tourism operators and local business groups often weigh in on short‑stay rules.");
    factors.implementation.push("Local government capacity to enforce is a common bottleneck.");
  }
  if (policy.rental.rentRegulationCoverage > 0.2 || policy.rental.rentRegulationCap != null) {
    score += 16;
    factors.state.push("Tenancy law changes are state‑based and can vary widely by jurisdiction.");
    factors.industry.push("Rent caps or broad coverage face landlord, agent, and investor opposition.");
    factors.industry.push("Risk of reduced rental listings is a frequent political argument.");
  }
  if (policy.credit.serviceabilityBufferDelta > 0.01 || policy.credit.dtiCapTightness > 0.2) {
    score += 8;
    factors.federal.push("Macro‑prudential tightening faces regulator caution (APRA/RBA).");
    factors.industry.push("Banking sector lobbying is influential on prudential settings.");
    factors.industry.push("Credit tightening can be framed as first‑home‑buyer exclusion.");
  }
  if (policy.publicCommunity.publicHousingBuildBoost > 0.1 || policy.publicCommunity.publicHousingAcquisitionSharePerYear > 0.02) {
    score += 10;
    factors.state.push("Large public build/acquisition requires long‑term funding certainty.");
    factors.industry.push("Construction capacity and land availability constrain delivery speed.");
    factors.implementation.push("Procurement timelines and social housing pipeline governance add friction.");
  }
  if (policy.supplyBoost > 0.15 || policy.planning.upzoningIntensity > 0.3) {
    score += 9;
    factors.state.push("Planning reforms are state‑led with local council veto points.");
    factors.state.push("Local planning appeal processes can slow delivery.");
    factors.industry.push("Upzoning and rapid supply shifts face NIMBY opposition.");
    factors.implementation.push("Infrastructure sequencing and developer feasibility can slow rollouts.");
  }
  if (policy.migration.netOverseasMigrationShock < -0.1) {
    score += 7;
    factors.federal.push("Federal migration settings can be sensitive to Senate cross‑bench deals.");
    factors.industry.push("Education sector, business groups, and unions often lobby on migration settings.");
    factors.implementation.push("Migration cuts intersect with workforce shortages and growth objectives.");
  }

  if (policy.subsidies.firstHomeBuyerSubsidyIntensity > 0.15) {
    score += 4;
    factors.federal.push("Budget scrutiny increases when subsidies are large or ongoing.");
    factors.industry.push("Large buyer subsidies can be criticized for inflating prices.");
  }
  if (policy.rental.rentAssistanceIntensity > 0.15) {
    score += 4;
    factors.federal.push("Rent assistance expansions increase fiscal costs and budget scrutiny.");
    factors.industry.push("Landlord pass‑through risk is a common policy critique.");
  }
  if (policy.taxInvestor.foreignBuyerRestrictionIntensity > 0.3) {
    score += 6;
    factors.federal.push("Diplomatic and trade considerations can slow federal reforms.");
    factors.industry.push("Foreign buyer restrictions can create trade and investment tensions.");
  }
  if (policy.taxInvestor.vacancyTaxIntensity > 0.4) {
    score += 4;
    factors.implementation.push("High vacancy tax settings raise enforcement and measurement challenges.");
    factors.implementation.push("Data sharing between agencies becomes a political and technical hurdle.");
  }
  if (policy.credit.investorLendingLimitTightness > 0.3) {
    score += 6;
    factors.federal.push("APRA/RBA coordination can slow rapid changes.");
    factors.industry.push("Investor lending limits often meet coordinated banking sector pushback.");
  }
  if (policy.planning.infrastructureEnablement > 0.4) {
    score += 6;
    factors.state.push("Infrastructure enablement requires multi‑year capital plans and approvals.");
    factors.implementation.push("State treasury capacity and project pipelines can constrain timing.");
  }
  if (policy.publicCommunity.conversionToSocialSharePerYear > 0.02) {
    score += 6;
    factors.implementation.push("Rental conversion programs can face legal and compensation disputes.");
    factors.industry.push("Private rental market groups typically resist compulsory conversion programs.");
  }
  if (policy.ownershipCapEnabled && policy.ownershipCapEnforcement > 0.5) {
    score += 6;
    factors.implementation.push("High enforcement levels can trigger privacy and compliance pushback.");
    factors.implementation.push("Data matching across agencies raises governance and civil‑liberty concerns.");
  }
  if (policy.negativeGearingMode === "remove" && policy.negativeGearingIntensity > 0.5) {
    score += 6;
    factors.industry.push("Rapid phase‑outs often amplify short‑term political backlash.");
    factors.industry.push("Investor sentiment impacts can become a headline risk.");
  }
  if (policy.demandReduction > 0.1) {
    score += 5;
    factors.industry.push("Large demand reductions can be framed as harming household wealth.");
    factors.industry.push("Retiree and investor advocacy groups can mobilize quickly.");
  }
  if (policy.supplyBoost > 0.2) {
    score += 5;
    factors.industry.push("Construction unions and contractors can resist aggressive cost compression.");
    factors.implementation.push("Very large supply boosts may be seen as unrealistic within workforce limits.");
  }

  factors.implementation.push("Implementation complexity increases when multiple levers are combined.");
  factors.federal.push("Stakeholder alignment (state vs federal) is often the decisive constraint.");
  factors.state.push("State legislative calendars and election cycles can delay or dilute reforms.");

  const severityFromCount = (n: number): "Low" | "Medium" | "High" =>
    n >= 4 ? "High" : n >= 2 ? "Medium" : "Low";
  factors.severity = {
    federal: severityFromCount(factors.federal.length),
    state: severityFromCount(factors.state.length),
    industry: severityFromCount(factors.industry.length),
    implementation: severityFromCount(factors.implementation.length),
  };

  score = Math.min(100, score);

  const rating =
    score <= 18 ? "Easy" :
    score <= 32 ? "Moderate" :
    score <= 52 ? "Challenging" :
    score <= 72 ? "Hard" : "Highly Improbable";

  const summary = rating === "Easy"
    ? "Low conflict with entrenched interests; likely to pass if politically prioritized."
    : rating === "Moderate"
    ? "Some pushback expected, but feasible with negotiation."
    : rating === "Challenging"
    ? "Multiple stakeholder veto points; passage likely needs strong mandate."
    : rating === "Hard"
    ? "Significant industry and political resistance expected."
    : "Would likely require exceptional political alignment or crisis conditions.";

  return { rating, score, factors, summary };
}

function ScopeIndicator({ scope, cityCount }: { scope: ReturnType<typeof useModel>["scope"]; cityCount: number }) {
  const label = scopeLabel(scope);
  const icon =
    scope.level === "national" ? "🇦🇺" :
    scope.level === "state" ? "📍" : "🏙️";

  return (
    <div className="scope-badge">
      <span>{icon}</span>
      <span>{label}</span>
      {scope.level === "national" && (
        <span className="muted">({cityCount} cities)</span>
      )}
    </div>
  );
}

function CalibrationWarningsBanner({
  params,
  calibrationReport,
}: {
  params: ReturnType<typeof useModel>["params"];
  calibrationReport: ReturnType<typeof useModel>["calibrationReport"];
}) {
  const policy = toPolicyV2(params.policy as any);
  const activeCalibrationFirst = listCalibrationFirstActive(policy);
  const atBounds = listAtBounds(policy);

  const calEnabled = !!params.advanced?.calibration?.enabled;
  const hasHistory = !!params.advanced?.calibration?.historyByCity;

  const warnings: string[] = [];
  if (activeCalibrationFirst.length > 0 && (!calEnabled || !hasHistory)) {
    warnings.push(
      "Calibration-first levers are active but no historical series are attached. Treat results as directional."
    );
  }
  if (atBounds.length > 0) {
    warnings.push(
      `Some levers are at hard bounds (the model clamps to realistic ranges): ${atBounds.slice(0, 4).join(", ")}${
        atBounds.length > 4 ? "…" : ""
      }`
    );
  }
  (calibrationReport?.warnings ?? []).slice(0, 2).forEach((w) => warnings.push(w));

  if (warnings.length === 0) return null;

  return (
    <div className="callout warning" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Calibration & bounds</div>
      <ul style={{ margin: "8px 0 0 18px", fontSize: 13 }}>
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function HistoryWarningsBanner({
  params,
}: {
  params: ReturnType<typeof useModel>["params"];
}) {
  const bundle = params.advanced?.calibration?.historyBundle as any;
  if (!bundle) return null;
  const warnings: string[] = [];
  const metaWarnings = bundle?.meta?.warnings as string[] | undefined;
  const notes = bundle?.meta?.notes as string[] | undefined;
  if (Array.isArray(metaWarnings) && metaWarnings.length) warnings.push(...metaWarnings.slice(0, 3));
  if (warnings.length === 0) return null;
  return (
    <div className="callout warning" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Historical data coverage</div>
      <ul style={{ margin: "8px 0 0 18px", fontSize: 13 }}>
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
      {Array.isArray(notes) && notes.length ? (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Show history notes</summary>
          <ul style={{ margin: "8px 0 0 18px", fontSize: 12, color: "var(--muted)" }}>
            {notes.slice(0, 10).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function SanitizationBanner({ params }: { params: ReturnType<typeof useModel>["params"] }) {
  const msgs: string[] = [];

  const microMeta = (params.advanced?.microDistributions as any)?.microdata?.meta as any;
  const m = microMeta?.sanitization;
  if (m && (m.droppedCityKeys || m.droppedRows || m.truncatedRows)) {
    msgs.push(
      `Microdata sanitized: dropped ${m.droppedCityKeys} invalid city keys, dropped ${m.droppedRows} non-object rows, truncated ${m.truncatedRows} rows (cap ${m.maxRowsPerCity}/city).`
    );
  }

  const hb = params.advanced?.calibration?.historyBundle as any;
  if (hb) {
    const rep = sanitizeHistoryBundleWithReport(hb).report;
    if (rep.ok && (rep.droppedCityKeys || rep.cappedPoints)) {
      msgs.push(
        `History bundle sanitized: dropped ${rep.droppedCityKeys} invalid city keys, capped ${rep.cappedPoints} year-points (max ${rep.maxYears} years).`
      );
    }
  }

  if (msgs.length === 0) return null;
  return (
    <div className="callout warning" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Input sanitization applied</div>
      <ul style={{ margin: "8px 0 0 18px", fontSize: 13 }}>
        {msgs.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

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
  } = useModel();

  const { years } = scopedView;
  const first = years[0];

  if (!first || years.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 16 }}>⏳</div>
        <div className="h2">Loading simulation...</div>
        <div className="muted">Calculating outcomes for {params.cities.length} cities</div>
      </div>
    );
  }

  // Get decile data from city-level if available
  const decileRows =
    selectedCityData?.years[selectedCityData.years.length - 1]?.deciles.rows ?? null;

  // Timeline for charts (historical + projected if available and enabled)
  const { c } = resolveMethodology(params);
  const timelineView = showHistory
    ? buildRegionTimeline({
        outputs,
        scope,
        historyBundle: params.advanced?.calibration?.historyBundle as any,
        cities: params.cities,
        c,
        stampDutyRate: c.stampDutyEffectiveRate + ((params.policy as any).stampDutyRateDelta ?? 0),
        year0: first.year,
        indexBase: historyIndexBase,
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

  const policy = toPolicyV2(params.policy as any);
  const defaultPolicy = DEFAULT_POLICY_LEVERS_V2;
  const policyDifficulty = assessPolicyDifficulty(policy);

  const getByPath = (obj: any, path: string) => {
    return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  };

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
      const different = param.key === "rental.rentRegulationCap" ? current !== baseline : current !== baseline;
      if (!different) return;
      changes.push({
        key: param.key,
        label: param.label,
        value: formatPolicyValue(param.key, current),
        parties: POLICY_KEY_PARTIES[param.key] ?? [],
      });
    });

    if (policy.negativeGearingMode !== defaultPolicy.negativeGearingMode) {
      changes.push({
        key: "negativeGearingMode",
        label: "Negative gearing mode",
        value: policy.negativeGearingMode,
        parties: POLICY_KEY_PARTIES.negativeGearingMode ?? [],
      });
    }
    if (policy.negativeGearingIntensity !== defaultPolicy.negativeGearingIntensity) {
      changes.push({
        key: "negativeGearingIntensity",
        label: "Negative gearing intensity",
        value: formatPolicyValue("negativeGearingIntensity", policy.negativeGearingIntensity),
        parties: POLICY_KEY_PARTIES.negativeGearingIntensity ?? [],
      });
    }
    if (policy.ownershipCapEnabled !== defaultPolicy.ownershipCapEnabled) {
      changes.push({
        key: "ownershipCapEnabled",
        label: "Ownership cap",
        value: policy.ownershipCapEnabled ? "enabled" : "disabled",
        parties: POLICY_KEY_PARTIES.ownershipCapEnabled ?? [],
      });
    }
    if (policy.ownershipCapEnforcement !== defaultPolicy.ownershipCapEnforcement) {
      changes.push({
        key: "ownershipCapEnforcement",
        label: "Ownership cap enforcement",
        value: formatPolicyValue("ownershipCapEnforcement", policy.ownershipCapEnforcement),
        parties: POLICY_KEY_PARTIES.ownershipCapEnforcement ?? [],
      });
    }
    if (policy.excessInvestorStockShare !== defaultPolicy.excessInvestorStockShare) {
      changes.push({
        key: "excessInvestorStockShare",
        label: "Excess investor stock share",
        value: formatPolicyValue("excessInvestorStockShare", policy.excessInvestorStockShare),
        parties: POLICY_KEY_PARTIES.excessInvestorStockShare ?? [],
      });
    }
    if (policy.divestmentPhased !== defaultPolicy.divestmentPhased) {
      changes.push({
        key: "divestmentPhased",
        label: "Divestment phasing",
        value: policy.divestmentPhased ? "phased" : "immediate",
        parties: POLICY_KEY_PARTIES.divestmentPhased ?? [],
      });
    }
    if (policy.stampDutyRateDelta !== defaultPolicy.stampDutyRateDelta) {
      changes.push({
        key: "stampDutyRateDelta",
        label: "Stamp duty rate delta",
        value: formatPolicyValue("stampDutyRateDelta", policy.stampDutyRateDelta),
        parties: POLICY_KEY_PARTIES.stampDutyRateDelta ?? [],
      });
    }
    if (policy.mortgageRateDelta !== defaultPolicy.mortgageRateDelta) {
      changes.push({
        key: "mortgageRateDelta",
        label: "Mortgage rate delta",
        value: formatPolicyValue("mortgageRateDelta", policy.mortgageRateDelta),
        parties: POLICY_KEY_PARTIES.mortgageRateDelta ?? [],
      });
    }
    if (policy.rampYears !== defaultPolicy.rampYears) {
      changes.push({
        key: "rampYears",
        label: "Policy ramp years",
        value: formatPolicyValue("rampYears", policy.rampYears),
        parties: POLICY_KEY_PARTIES.rampYears ?? [],
      });
    }
    return changes;
  })();

  const activePresets = selectedPresets.filter((p) => p !== "baseline");
  const presetParties = activePresets.flatMap((p) => PRESET_PARTIES[p] ?? []);
  const manualParties = manualChanges.flatMap((c) => c.parties);
  const partySummary = summarizePartySupport([...presetParties, ...manualParties]);

  const partyKeyLabel = partySummary.top.length
    ? partySummary.top.map((p) => PARTY_META[p].label).join(" / ")
    : "None (baseline only)";

  return (
    <div className="explore-layout">
      {/* Sidebar with controls */}
      <aside className="explore-sidebar">
        <ControlsPanel />
      </aside>

      {/* Main content area with charts */}
      <div className="explore-main">
        <div className="explore-header">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Explore the model</h1>
            <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 14 }}>
              Adjust controls on the left. Results update instantly.
            </p>
            <p className="muted" style={{ margin: "6px 0 0 0", fontSize: 12 }}>
              This model is a free tool developed by the not-for-profit consumer advocacy and research team at SOCii.
            </p>
          </div>
          <ScopeIndicator scope={scope} cityCount={params.cities.length} />
        </div>

        <CalibrationWarningsBanner params={params} calibrationReport={calibrationReport} />
        <SanitizationBanner params={params} />
        <HistoryWarningsBanner params={params} />
        <MicrodataWarningsBanner params={params} />

        {/* Year filter for fast map focus */}
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Year focus</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Jump to a specific year; charts and map will highlight that year.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                className="select-field"
                value={selectedYear}
                onChange={(e) => setFocusYear(Number(e.target.value))}
                aria-label="Select focus year"
              >
                {(chartSeries as any).map((p: any) => (
                  <option key={`yr-${p.year}`} value={p.year}>
                    {p.year}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-reset"
                onClick={() => setFocusYear(null)}
                title="Return to latest year"
              >
                Latest
              </button>
            </div>
          </div>
        </div>

        {/* Regional crisis heatmap (national context, live-updating by hovered year) */}
        <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading map…</div>}>
          <AustraliaCrisisMap
            outputs={outputs}
            params={params as any}
            year={selectedYear}
            historyBundle={params.advanced?.calibration?.historyBundle as any}
            title={`Regional crisis heatmap — ${scopeLabel(scope)}`}
            scope={scope}
          />
        </Suspense>

        {/* Primary charts - immediately visible */}
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

        {/* Summary metrics */}
        <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading summary…</div>}>
          <SummaryCounter />
        </Suspense>

        {/* Wage vs Housing comparison */}
        <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading chart…</div>}>
          <WageVsHousingChart
            years={chartSeries as any}
            scopeLabel={scopeLabel(scope)}
            cutoverYear={cutoverYear}
            onHoverYear={setFocusYear}
          />
        </Suspense>

        {/* Secondary charts */}
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

        {/* Decile analysis */}
        {decileRows && (
          <div className="decile-section">
            <div className="section-header">
              <h2 className="h2" style={{ margin: 0 }}>Distributional impact</h2>
              <span className="badge-warning">Proxy estimate</span>
            </div>
            <Suspense fallback={<div className="card" style={{ padding: 16 }}>Loading distribution…</div>}>
              <DecileImpact rows={decileRows} />
            </Suspense>
          </div>
        )}

        {/* Interpretation guide - collapsible */}
        <details className="help-panel">
          <summary className="help-panel-trigger">
            <span>💡</span>
            <span>How to interpret results</span>
          </summary>
          <div className="help-panel-content">
            <HelpExpander summary="Understanding the charts" defaultOpen>
              <ul>
                <li><strong>Price/Rent index:</strong> 100 = no change, 200 = doubled</li>
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

        {/* Policy summary */}
        <div className="card" style={{ padding: 16, marginTop: 14 }}>
          <div className="h2" style={{ marginTop: 0 }}>Policy summary</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Summary of selected policies and their typical party associations. This is informational only and not an endorsement.
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Color key:</span>
            {PARTY_ORDER.map((p) => (
              <PartyChip key={`legend-${p}`} party={p} />
            ))}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Active presets</div>
              {activePresets.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>Baseline only (no preset selected).</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {activePresets.map((p) => (
                    <li key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span>{p}</span>
                      {(PRESET_PARTIES[p] ?? []).map((party) => (
                        <PartyChip key={`${p}-${party}`} party={party} />
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Manual adjustments</div>
              {manualChanges.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>No manual policy changes from baseline.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {manualChanges.map((c) => (
                    <li key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span>{c.label}: <strong>{c.value}</strong></span>
                      {c.parties.map((party) => (
                        <PartyChip key={`${c.key}-${party}`} party={party as any} />
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ paddingTop: 6, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Most represented party in selected policies</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{partyKeyLabel}</span>
                {partySummary.top.map((p) => (
                  <PartyChip key={`top-${p}`} party={p} />
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Based on the count of party associations across your selected policies (presets + manual adjustments).
              </div>
            </div>

            <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Feasibility & pushback assessment</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>
                  Difficulty: <strong>{policyDifficulty.rating}</strong>
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  (score {policyDifficulty.score}/100)
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {policyDifficulty.summary}
              </div>
              {Object.values(policyDifficulty.factors).some((xs) => Array.isArray(xs) && xs.length > 0) && (
                <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                  {(
                    [
                      ["Federal", policyDifficulty.factors.federal, policyDifficulty.factors.severity.federal],
                      ["State", policyDifficulty.factors.state, policyDifficulty.factors.severity.state],
                      ["Industry", policyDifficulty.factors.industry, policyDifficulty.factors.severity.industry],
                      ["Implementation", policyDifficulty.factors.implementation, policyDifficulty.factors.severity.implementation],
                    ] as Array<[string, string[], "Low" | "Medium" | "High"]>
                  ).map(([label, items, severity]) =>
                    items.length ? (
                      <details key={label} className="help-panel" style={{ padding: 10 }}>
                        <summary className="help-panel-trigger" style={{ gap: 8 }}>
                          <span>{label}</span>
                          <span className="muted" style={{ fontSize: 11 }}>
                            Severity: <strong>{severity}</strong>
                          </span>
                        </summary>
                        <div className="help-panel-content">
                          <ul style={{ margin: "8px 0 0 18px" }}>
                            {items.map((f, i) => (
                              <li key={`${label}-${i}`}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    ) : null
                  )}
                </div>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                Heuristic assessment only; actual feasibility depends on timing, coalitions, and implementation details.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
