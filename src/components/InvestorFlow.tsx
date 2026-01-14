import type { YearState } from "../model/types";
import { HELP, HelpExpander, LimitationsBox, EffectChip } from "./shared/HelpText";

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function fmtAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function MetricRow({
  label,
  start,
  end,
  change,
  tooltip,
}: {
  label: string;
  start: string;
  end: string;
  change: number;
  tooltip?: string;
}) {
  const color =
    Math.abs(change) < 0.1 ? "#6b7280" :
    change > 0.4 ? "#dc2626" :
    change < 0.2 ? "#16a34a" : "#ca8a04";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 120px 100px 120px 1fr",
        alignItems: "center",
        gap: 8,
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{start}</div>
      <div style={{ fontWeight: 700, color, fontSize: 14 }}>{fmtPct(change)}</div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{end}</div>
      <div
        style={{
          height: 8,
          background: "#e5e7eb",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.abs(change) * 100)}%`,
            height: "100%",
            background: color,
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

function PolicyChannelCard({
  title,
  value,
  description,
  direction,
}: {
  title: string;
  value: string;
  description: string;
  direction: "positive" | "negative" | "neutral";
}) {
  const colors = {
    positive: { bg: "#f0fdf4", border: "#86efac" },
    negative: { bg: "#fef2f2", border: "#fca5a5" },
    neutral: { bg: "#f9fafb", border: "#d1d5db" },
  };
  const c = colors[direction];

  return (
    <div
      style={{
        padding: 12,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{description}</div>
    </div>
  );
}

export function PolicyChannelsFlow({ series }: { series: YearState[] }) {
  const policyHelp = HELP.policyChannels;
  const first = series[0];
  const last = series[series.length - 1];

  if (!first || !last) {
    return null;
  }

  // Get policy channel effects at end of simulation
  const channels = last.policyChannels;

  // Calculate key changes
  const priceChange = (last.medianPrice - first.medianPrice) / first.medianPrice;
  const rentChange = (last.medianAnnualRent - first.medianAnnualRent) / first.medianAnnualRent;
  const stockChange = (last.dwellingStock - first.dwellingStock) / first.dwellingStock;

  const firstStress = first.deciles.stressRates;
  const lastStress = last.deciles.stressRates;

  const demandEffect = 1 - channels.investorDemandMultiplier;
  const hasPolicyEffects = demandEffect !== 0 || channels.divestedDwellingsShare > 0;

  // Determine policy channel directions
  const demandDirection = demandEffect > 0.05 ? "positive" : demandEffect < -0.05 ? "negative" : "neutral";
  const divestmentDirection = channels.divestedDwellingsShare > 0.01 ? "positive" : "neutral";
  const rentalShockDirection = channels.rentalSupplyShockShare > 0.02 ? "negative" : "neutral";

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h2" style={{ marginBottom: 4 }}>
        Scenario outcomes: year {first.year} → {last.year}
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {policyHelp.description}
      </div>

      {/* Key metrics table */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 120px 100px 120px 1fr",
            padding: "8px 0",
            borderBottom: "2px solid var(--border)",
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
          }}
        >
          <div>Metric</div>
          <div>Start (Yr {first.year})</div>
          <div>Change</div>
          <div>End (Yr {last.year})</div>
          <div>Visual</div>
        </div>

        <MetricRow
          label="Median price"
          start={fmtAUD(first.medianPrice)}
          end={fmtAUD(last.medianPrice)}
          change={priceChange}
        />
        <MetricRow
          label="Median rent (annual)"
          start={fmtAUD(first.medianAnnualRent)}
          end={fmtAUD(last.medianAnnualRent)}
          change={rentChange}
        />
        <MetricRow
          label="Dwelling stock"
          start={`${(first.dwellingStock / 1e6).toFixed(2)}M`}
          end={`${(last.dwellingStock / 1e6).toFixed(2)}M`}
          change={stockChange}
        />
      </div>

      {/* Policy channels section */}
      {hasPolicyEffects && (
        <div style={{ marginBottom: 16 }}>
          <div className="h3" style={{ marginBottom: 8 }}>
            Policy channel effects (at year {last.year})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <PolicyChannelCard
              title={policyHelp.investorDemand.title}
              value={fmtPct(-demandEffect)}
              description={
                demandEffect > 0
                  ? "Investor demand reduced — less competition for housing"
                  : demandEffect < 0
                    ? "Investor demand increased — more competition"
                    : "No change to investor demand"
              }
              direction={demandDirection}
            />
            <PolicyChannelCard
              title={policyHelp.divestment.title}
              value={fmtPct(channels.divestedDwellingsShare)}
              description="Stock sold due to ownership cap enforcement"
              direction={divestmentDirection}
            />
            <PolicyChannelCard
              title={policyHelp.rentalShock.title}
              value={fmtPct(channels.rentalSupplyShockShare)}
              description="Short-term rental supply reduction from divestment"
              direction={rentalShockDirection}
            />
          </div>
        </div>
      )}

      {/* Stress rates comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          padding: 12,
          background: "var(--bg-subtle)",
          borderRadius: 8,
        }}
      >
        <div>
          <div className="muted" style={{ fontSize: 11 }}>Rent stress rate</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              {(firstStress.rentersInStressShare * 100).toFixed(0)}%
            </span>
            <span className="muted">→</span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color:
                  lastStress.rentersInStressShare > firstStress.rentersInStressShare
                    ? "#dc2626"
                    : "#16a34a",
              }}
            >
              {(lastStress.rentersInStressShare * 100).toFixed(0)}%
            </span>
            <EffectChip
              effect={fmtPct(lastStress.rentersInStressShare - firstStress.rentersInStressShare)}
              direction={
                lastStress.rentersInStressShare > firstStress.rentersInStressShare
                  ? "negative"
                  : "positive"
              }
            />
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>Mortgage stress rate</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              {(firstStress.mortgagedOwnersInStressShare * 100).toFixed(0)}%
            </span>
            <span className="muted">→</span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color:
                  lastStress.mortgagedOwnersInStressShare > firstStress.mortgagedOwnersInStressShare
                    ? "#dc2626"
                    : "#16a34a",
              }}
            >
              {(lastStress.mortgagedOwnersInStressShare * 100).toFixed(0)}%
            </span>
            <EffectChip
              effect={fmtPct(lastStress.mortgagedOwnersInStressShare - firstStress.mortgagedOwnersInStressShare)}
              direction={
                lastStress.mortgagedOwnersInStressShare > firstStress.mortgagedOwnersInStressShare
                  ? "negative"
                  : "positive"
              }
            />
          </div>
        </div>
      </div>

      <HelpExpander summary="Understanding policy channels">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><strong>Investor demand:</strong> {policyHelp.investorDemand.mechanism}</li>
          <li><strong>Divestment:</strong> {policyHelp.divestment.mechanism}</li>
          <li><strong>Rental shock:</strong> {policyHelp.rentalShock.mechanism}</li>
        </ul>
      </HelpExpander>

      <HelpExpander summary="How to read the color coding">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><span style={{ color: "#dc2626" }}>Red:</span> High growth ({">"} 40%) — worse affordability</li>
          <li><span style={{ color: "#ca8a04" }}>Yellow:</span> Moderate growth (20-40%) — some pressure</li>
          <li><span style={{ color: "#16a34a" }}>Green:</span> Low growth ({"<"} 20%) — stable/improving</li>
          <li><span style={{ color: "#6b7280" }}>Gray:</span> Minimal change ({"<"} 10%)</li>
        </ul>
      </HelpExpander>

      <LimitationsBox
        items={[
          "Policy effects are modeled approximations based on assumed elasticities",
          "Actual investor behavioral responses may differ",
          "Transition dynamics simplified — real-world adjustments are messier",
        ]}
      />
    </div>
  );
}

// Backwards compatibility exports
export { PolicyChannelsFlow as InvestorFlow };
export { PolicyChannelsFlow as AffordabilityFlow };
