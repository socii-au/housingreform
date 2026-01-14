import { ControlsPanel } from "../components/ControlsPanel";
import { DecileImpact } from "../components/charts/DecileImpact";
import { DwellingStockArea } from "../components/charts/OwnershipMixArea";
import { PriceVsBaseline } from "../components/charts/PriceVsBaseline";
import WageVsHousingChart from "../components/charts/WageVsHousingChart";
import { AustraliaCrisisMap } from "../components/AustraliaCrisisMap";
import { PolicyChannelsFlow } from "../components/InvestorFlow";
import { SummaryCounter } from "../components/PublicHousingCounter";
import { useModel, scopeLabel } from "../model/ModelContext";
import { HelpExpander } from "../components/shared/HelpText";
import { listAtBounds, listCalibrationFirstActive, toPolicyV2 } from "../model/policyRegistry";
import { buildRegionTimeline } from "../model/history/timeline";
import { resolveMethodology } from "../model/methodology";
import { sanitizeHistoryBundleWithReport } from "../security/sanitize";

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
          </div>
          <ScopeIndicator scope={scope} cityCount={params.cities.length} />
        </div>

        <CalibrationWarningsBanner params={params} calibrationReport={calibrationReport} />
        <SanitizationBanner params={params} />
        <HistoryWarningsBanner params={params} />
        <MicrodataWarningsBanner params={params} />

        {/* Regional crisis heatmap (national context, live-updating by hovered year) */}
        <AustraliaCrisisMap
          outputs={outputs}
          params={params as any}
          year={selectedYear}
          historyBundle={params.advanced?.calibration?.historyBundle as any}
          title="Regional crisis heatmap (Australia)"
        />

        {/* Primary charts - immediately visible */}
        <div className="chart-grid-primary">
          <PriceVsBaseline
            title="Housing prices"
            series={chartSeries as any}
            dataKey="medianPrice"
            baseValue={baseValueForIndex.medianPrice}
            cutoverYear={cutoverYear}
            onHoverYear={setFocusYear}
          />
          <PriceVsBaseline
            title="Rents"
            series={chartSeries as any}
            dataKey="medianAnnualRent"
            baseValue={baseValueForIndex.medianAnnualRent}
            cutoverYear={cutoverYear}
            onHoverYear={setFocusYear}
          />
        </div>

        {/* Summary metrics */}
        <SummaryCounter />

        {/* Wage vs Housing comparison */}
        <WageVsHousingChart
          years={chartSeries as any}
          scopeLabel={scopeLabel(scope)}
          cutoverYear={cutoverYear}
          onHoverYear={setFocusYear}
        />

        {/* Secondary charts */}
        <div className="chart-grid-secondary">
          <DwellingStockArea series={chartSeries as any} onHoverYear={setFocusYear} />
          {selectedCityData && (
            <PolicyChannelsFlow series={selectedCityData.years} />
          )}
        </div>

        {/* Decile analysis */}
        {decileRows && (
          <div className="decile-section">
            <div className="section-header">
              <h2 className="h2" style={{ margin: 0 }}>Distributional impact</h2>
              <span className="badge-warning">Proxy estimate</span>
            </div>
            <DecileImpact rows={decileRows} />
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
      </div>
    </div>
  );
}
