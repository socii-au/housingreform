import { useModel, scopeLabel } from "../model/ModelContext";
import { HELP, HelpExpander, InfoTooltip } from "./shared/HelpText";

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-AU").format(Math.round(n));
}

function fmtAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function SummaryCard({
  label,
  value,
  detail,
  tooltip,
  trend,
}: {
  label: string;
  value: string;
  detail?: string;
  tooltip?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColors = {
    up: "#dc2626",
    down: "#16a34a",
    neutral: "#6b7280",
  };
  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {value}
        {trend && (
          <span style={{ fontSize: 14, color: trendColors[trend] }}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      {detail && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function MetricExplainer({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={{ padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: 6, fontSize: 12 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div className="muted">{description}</div>
    </div>
  );
}

export function SummaryCounter() {
  const { scope, scopedView, params } = useModel();
  const summaryHelp = HELP.summary;

  const { years, summary } = scopedView;
  const first = years[0];
  const last = years[years.length - 1];

  if (!first || !last) {
    return null;
  }

  const newDwellings = last.dwellingStock - first.dwellingStock;
  const simulationYears = summary.yearN - summary.year0;

  // Determine trends for color coding
  const priceTrend =
    summary.medianPriceChangePct > 0.5 ? "up" :
    summary.medianPriceChangePct < 0.2 ? "down" : "neutral";
  const rentTrend =
    summary.medianRentChangePct > 0.5 ? "up" :
    summary.medianRentChangePct < 0.2 ? "down" : "neutral";
  const costIndexTrend =
    summary.housingCostIndexChangePct > 0.3 ? "up" :
    summary.housingCostIndexChangePct < 0.1 ? "down" : "neutral";

  // Calculate some additional context
  const priceGrowthPA = Math.pow(1 + summary.medianPriceChangePct, 1 / simulationYears) - 1;
  const rentGrowthPA = Math.pow(1 + summary.medianRentChangePct, 1 / simulationYears) - 1;
  const populationChange = last.population - first.population;
  const dwellingsPerCapita = newDwellings / populationChange;

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h2" style={{ marginBottom: 4 }}>
        Scenario summary — {scopeLabel(scope)}
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Key outcomes over the {simulationYears} year simulation period.
      </div>

      <div className="grid2">
        <SummaryCard
          label={summaryHelp.priceChange.title}
          value={fmtPct(summary.medianPriceChangePct)}
          detail={`${fmtAUD(first.medianPrice)} → ${fmtAUD(last.medianPrice)} (${fmtPct(priceGrowthPA)}/yr)`}
          tooltip={summaryHelp.priceChange.description}
          trend={priceTrend}
        />
        <SummaryCard
          label={summaryHelp.rentChange.title}
          value={fmtPct(summary.medianRentChangePct)}
          detail={`${fmtAUD(first.medianAnnualRent)} → ${fmtAUD(last.medianAnnualRent)}/yr (${fmtPct(rentGrowthPA)}/yr)`}
          tooltip={summaryHelp.rentChange.description}
          trend={rentTrend}
        />
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <SummaryCard
          label={summaryHelp.newDwellings.title}
          value={fmtInt(newDwellings)}
          detail={`Stock: ${fmtInt(first.dwellingStock)} → ${fmtInt(last.dwellingStock)} | ${dwellingsPerCapita.toFixed(2)} per new resident`}
          tooltip={summaryHelp.newDwellings.description}
        />
        <SummaryCard
          label={summaryHelp.housingCostIndex.title}
          value={fmtPct(summary.housingCostIndexChangePct)}
          detail="Composite of price + rent vs wages"
          tooltip={summaryHelp.housingCostIndex.description}
          trend={costIndexTrend}
        />
      </div>

      {/* Additional context */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <MetricExplainer
          title="Population growth"
          description={`+${fmtInt(populationChange)} (${fmtPct(populationChange / first.population)})`}
        />
        <MetricExplainer
          title="Years modeled"
          description={`${summary.year0} → ${summary.yearN} (${simulationYears} years)`}
        />
        <MetricExplainer
          title="Ramp period"
          description={`${params.policy.rampYears} years to full policy effect`}
        />
      </div>

      <HelpExpander summary="Understanding these metrics">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><strong>Price/rent change:</strong> {summaryHelp.priceChange.interpretation}</li>
          <li><strong>Net dwellings:</strong> {summaryHelp.newDwellings.interpretation}</li>
          <li><strong>Housing cost index:</strong> {summaryHelp.housingCostIndex.interpretation}</li>
        </ul>
      </HelpExpander>

      <HelpExpander summary="Reading the trend indicators">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><span style={{ color: "#dc2626" }}>↑ Red:</span> Fast growth — affordability worsening</li>
          <li><span style={{ color: "#6b7280" }}>→ Gray:</span> Moderate growth — mixed impact</li>
          <li><span style={{ color: "#16a34a" }}>↓ Green:</span> Slow/negative growth — affordability improving</li>
        </ul>
        <p style={{ margin: "8px 0 0 0", fontStyle: "italic" }}>
          Note: All values are nominal (not inflation-adjusted). Real affordability depends on wage growth.
        </p>
      </HelpExpander>
    </div>
  );
}

export { SummaryCounter as PublicHousingCounter };
