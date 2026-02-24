import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DecileImpact } from "../components/charts/DecileImpact";
import { DwellingStockArea } from "../components/charts/OwnershipMixArea";
import { PriceVsBaseline } from "../components/charts/PriceVsBaseline";
import { PolicyChannelsFlow } from "../components/InvestorFlow";
import { SummaryCounter } from "../components/PublicHousingCounter";
import { useModel, scopeLabel } from "../model/ModelContext";
import { HelpExpander, LimitationsBox } from "../components/shared/HelpText";
import type { TimelinePoint } from "../model/history/types";

function useScrollReveal(): [(el: HTMLElement | null) => void, boolean] {
  const elRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const cbRef = useRef((el: HTMLElement | null) => {
    elRef.current = el;
  });
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [cbRef.current, visible];
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

function Section({
  title,
  kicker,
  step,
  children,
  highlight,
}: {
  title: string;
  kicker?: string;
  step?: number;
  children: React.ReactNode;
  highlight?: "green" | "yellow" | "blue";
}) {
  const [ref, visible] = useScrollReveal();
  const tone =
    highlight === "green"
      ? "tone-success"
      : highlight === "yellow"
        ? "tone-warning"
        : highlight === "blue"
          ? "tone-info"
          : "tone-neutral";

  return (
    <section
      ref={ref}
      className={`card ${tone} scrollReveal ${visible ? "visible" : ""}`}
      style={{ padding: "16px", marginBottom: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        {step != null && step > 0 && (
          <div className="stepBadge">
            {step}
          </div>
        )}
        <div>
          <h2 className="h2" style={{ margin: 0 }}>{title}</h2>
          {kicker && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{kicker}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Callout({
  type,
  children,
}: {
  type: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  return (
    <div className={`callout ${type}`} style={{ marginTop: 12, display: "flex", gap: 10 }}>
      <span>{type === "info" ? "💡" : type === "warning" ? "⚠️" : "✓"}</span>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function PolicyCard({
  title,
  description,
  effects,
  tradeoffs,
}: {
  title: string;
  description: string;
  effects: string[];
  tradeoffs: string[];
}) {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <h3 className="h3" style={{ marginBottom: 8 }}>{title}</h3>
      <p className="muted" style={{ margin: "0 0 12px 0", fontSize: 13 }}>{description}</p>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Expected effects:</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {effects.map((e, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{e}</li>
          ))}
        </ul>
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: "#b45309" }}>Trade-offs:</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#92400e" }}>
          {tradeoffs.map((t, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GuidedStory() {
  const { scope, scopedView, outputs, params } = useModel();

  const { years, summary } = scopedView;
  // Convert RegionYearState[] to TimelinePoint[] for charts
  const timelinePoints: TimelinePoint[] = years.map((y) => ({
    ...y,
    kind: "projected" as const,
  }));
  const first = timelinePoints[0];
  const last = timelinePoints[timelinePoints.length - 1];

  if (!first || !last) {
    return <div className="container">No data available</div>;
  }

  // Get Sydney's detailed data for deciles and policy channels
  const sydneyYears = outputs.byCity.SYD?.years ?? [];
  const sydneyLast = sydneyYears[sydneyYears.length - 1];

  if (!first || !last) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 16 }}>⏳</div>
        <h2 className="h2">Loading simulation...</h2>
        <div className="muted">Preparing guided analysis</div>
      </div>
    );
  }

  const policyDescription = (() => {
    const parts: string[] = [];
    if (params.policy.negativeGearingMode === "remove") {
      parts.push(`negative gearing removal (${Math.round(params.policy.negativeGearingIntensity * 100)}%)`);
    } else if (params.policy.negativeGearingMode === "reverse") {
      parts.push("negative gearing restoration");
    }
    if (params.policy.ownershipCapEnabled) {
      parts.push(`ownership cap (${Math.round(params.policy.ownershipCapEnforcement * 100)}% enforcement)`);
    }
    if (params.policy.supplyBoost !== 0) {
      parts.push(`${fmtPct(params.policy.supplyBoost)} supply boost`);
    }
    if (params.policy.demandReduction !== 0) {
      parts.push(`${fmtPct(params.policy.demandReduction)} demand reduction`);
    }
    return parts.length > 0 ? parts.join(" + ") : "baseline (no policy changes)";
  })();

  const simulationYears = summary.yearN - summary.year0;
  const populationGrowth = ((last.population ?? 0) - (first.population ?? 0)) / Math.max(1, first.population ?? 1);
  const priceGrowthPA = Math.pow(1 + summary.medianPriceChangePct, 1 / simulationYears) - 1;

  return (
    <div>
      <h1 className="h1">How housing policy affects the market</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        A guided walkthrough of the model, showing cause → effect relationships for{" "}
        <strong>{scopeLabel(scope)}</strong>. Designed to make the model's logic transparent and
        assumptions explicit.
      </p>
      <p style={{ marginBottom: 20 }}>
        <Link to="/" className="ctaLink">
          Explore the model →
        </Link>
        <span className="muted" style={{ marginLeft: 12, fontSize: 13 }}>
          Change scenarios, pick cities or states, and see results in detail.
        </span>
      </p>

      {/* Introduction */}
      <Section
        title="How to read this model"
        kicker="Think of this as a map, not a GPS. It shows directions, not precise destinations."
        step={0}
        highlight="blue"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ padding: 14, background: "white", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>🏗️ Supply-demand model</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Prices and rents respond to the gap between housing stock and household demand.
              More supply or less demand = lower prices.
            </div>
          </div>
          <div style={{ padding: 14, background: "white", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>⚙️ Policy levers</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Negative gearing, ownership caps, and supply policies shift the balance.
              Each has direct and indirect effects.
            </div>
          </div>
          <div style={{ padding: 14, background: "white", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>📊 Multi-scale views</div>
            <div className="muted" style={{ fontSize: 13 }}>
              National, State, and City-level analysis. Results aggregated from
              individual city simulations.
            </div>
          </div>
          <div style={{ padding: 14, background: "white", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Transparent uncertainty</div>
            <div className="muted" style={{ fontSize: 13 }}>
              All assumptions stated explicitly. Limitations acknowledged.
              This is illustrative, not predictive.
            </div>
          </div>
        </div>

        <Callout type="info">
          <strong>Current scenario:</strong> {policyDescription}
          <br />
          <span className="muted">
            {simulationYears} year simulation with {params.policy.rampYears} year policy ramp.{" "}
          </span>
          <Link to="/" className="ctaLink ctaLinkSecondary" style={{ marginTop: 8, display: "inline-flex" }}>
            Change scenario in Explore the Model →
          </Link>
        </Callout>
      </Section>

      {/* Step 1: Starting conditions */}
      <Section
        title="Starting conditions"
        kicker={`The baseline state for ${scopeLabel(scope)} before any policy changes take effect`}
        step={1}
      >
        <div className="grid2">
          <div className="panel" style={{ padding: 16 }}>
            <h3 className="h3" style={{ marginBottom: 10 }}>Key metrics at year 0</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="muted">Population</span>
                <strong>{(first.population ?? 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="muted">Dwelling stock</span>
                <strong>{(first.dwellingStock ?? 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="muted">Median price</span>
                <strong>{fmtAUD(first.medianPrice ?? 0)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span className="muted">Annual rent</span>
                <strong>{fmtAUD(first.medianAnnualRent ?? 0)}</strong>
              </div>
            </div>

            <HelpExpander summary="Where does this data come from?">
              Starting values are based on ABS Census data and CoreLogic/SQM indices,
              scaled and adjusted for the model. These are indicative, not exact measurements.
            </HelpExpander>
          </div>
          <PriceVsBaseline
            title="Price trajectory"
            series={timelinePoints}
            dataKey="medianPrice"
            baseValue={first?.medianPrice ?? 0}
          />
        </div>

        <LimitationsBox
          items={[
            "Does not forecast precise prices — shows relative trajectories",
            "Does not model interest rate paths, construction constraints, or within-city variation",
            "Assumes continuation of underlying demographic trends",
          ]}
        />
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <Link to="/" className="ctaLinkSecondary ctaLink">
            View by city or state in Explore the Model →
          </Link>
        </p>
      </Section>

      {/* Step 2: Supply and demand */}
      <Section
        title="Supply and demand dynamics"
        kicker="Housing markets respond to the gap between availability and need"
        step={2}
      >
        <div className="grid2">
          <PriceVsBaseline
            title="Rent trajectory"
            series={timelinePoints}
            dataKey="medianAnnualRent"
            baseValue={first?.medianAnnualRent ?? 0}
          />
          <DwellingStockArea series={timelinePoints} />
        </div>

        <Callout type="info">
          <strong>Why prices move:</strong> When demand exceeds supply, bidding pushes prices up.
          Policy can boost supply (more construction) or reduce demand (investor restrictions).
          Over {simulationYears} years, population grows by {fmtPct(populationGrowth)} while
          prices grow at {fmtPct(priceGrowthPA)}/year.
        </Callout>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <Link to="/" className="ctaLinkSecondary ctaLink">
            Adjust supply & demand levers in Explore the Model →
          </Link>
        </p>

        <HelpExpander summary="The supply-demand mechanism">
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Population growth creates new households needing homes</li>
            <li>If housing completions lag household formation, the market tightens</li>
            <li>Tighter markets = more competition = higher prices and rents</li>
            <li>Higher prices eventually stimulate more construction (with lag)</li>
            <li>Policy can accelerate or dampen these dynamics</li>
          </ol>
        </HelpExpander>
      </Section>

      {/* Step 3: Outcomes */}
      <Section
        title="Scenario outcomes"
        kicker="Key metrics from simulation start to end"
        step={3}
        highlight="green"
      >
        <div className="grid2">
          <SummaryCounter />
          {sydneyYears.length > 0 && <PolicyChannelsFlow series={sydneyYears} />}
        </div>

        <HelpExpander summary="Reading the summary metrics">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li><strong>Price/rent change:</strong> Total growth over the simulation period (nominal)</li>
            <li><strong>Net dwellings:</strong> How much housing stock increased</li>
            <li><strong>Affordability (composite):</strong> Price and rent vs wage growth</li>
            <li><strong>Color coding:</strong> Green = improving affordability, Red = worsening</li>
          </ul>
        </HelpExpander>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <Link to="/" className="ctaLinkSecondary ctaLink">
            Try different scenarios in Explore the Model →
          </Link>
        </p>
      </Section>

      {/* Step 4: Distributional impact */}
      <Section
        title="Who is affected?"
        kicker="Housing stress varies dramatically by income level"
        step={4}
      >
        {sydneyLast && <DecileImpact rows={sydneyLast.deciles.rows} />}

        <Callout type="warning">
          Housing stress (spending {">"}30% of income on housing) hits lower income groups first.
          Policy that eases prices/rents disproportionately helps those already in stress.
        </Callout>

        <div className="muted" style={{ marginTop: 12, fontStyle: "italic", fontSize: 13 }}>
          Note: Decile data shown for Sydney as a proxy. Actual distributions vary by city and
          should be interpreted as illustrative, not measured.
        </div>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <Link to="/" className="ctaLinkSecondary ctaLink">
            Compare stress by city in Explore the Model →
          </Link>
        </p>
      </Section>

      {/* Step 5: Policy comparison */}
      <Section
        title="Policy reform options"
        kicker="Different reform packages and their expected effects"
        step={5}
        highlight="yellow"
      >
        <div className="grid2">
          <PolicyCard
            title="🚫 Negative gearing removal"
            description="Phase out the ability to offset investment property losses against other income"
            effects={[
              "Reduces after-tax returns for investors",
              "Decreases investor demand over time",
              "May moderate price growth long-term",
            ]}
            tradeoffs={[
              "May temporarily reduce rental supply",
              "Effects are gradual when phased",
              "Existing investors may be grandfathered",
            ]}
          />
          <PolicyCard
            title="🏠 Ownership cap (1+1)"
            description="Limit individuals to 1 principal residence + 1 investment property"
            effects={[
              "Directly limits investor holdings",
              "Triggers forced divestment of excess",
              "Creates supply surge for purchasers",
            ]}
            tradeoffs={[
              "Can create short-term rental shock",
              "Complex to implement and enforce",
              "May face legal challenges",
            ]}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="grid2">
            <PolicyCard
              title="🏗️ Supply boost"
              description="Increase housing completions through planning reform, faster approvals, or public investment"
              effects={[
                "Directly increases housing stock",
                "Eases supply-demand imbalance",
                "Benefits both renters and buyers",
              ]}
              tradeoffs={[
                "Depends on construction capacity",
                "Takes years to materialize",
                "May face NIMBY resistance",
              ]}
            />
          </div>
        </div>

        <Callout type="success">
          <strong>Try different scenarios:</strong> Experiment with combinations in Explore the Model.
          Presets include baseline, individual policies, and combined reforms.{" "}
          <Link to="/" className="ctaLink" style={{ marginTop: 8, display: "inline-flex" }}>
            Open Explore the Model →
          </Link>
        </Callout>
      </Section>

      {/* Conclusion */}
      <Section
        title="Key takeaways"
        kicker="What we can and cannot learn from this model"
        highlight="blue"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#16a34a" }}>✓ What the model shows</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              <li>Directional effects of policy changes</li>
              <li>Relative magnitudes (which policies matter more)</li>
              <li>Trade-offs between different approaches</li>
              <li>How effects compound over time</li>
              <li>Distributional impacts across income groups</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#dc2626" }}>✗ What it cannot predict</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              <li>Exact future prices or rents</li>
              <li>Interest rate paths or RBA responses</li>
              <li>Short-term market volatility</li>
              <li>Political feasibility of reforms</li>
              <li>Regional variation within cities</li>
            </ul>
          </div>
        </div>

        <div
          className="callout dark"
          style={{
            marginTop: 20,
            padding: 20,
            textAlign: "center",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            📊 Ready to explore further?
          </div>
          <p style={{ margin: "0 0 16px 0", opacity: 0.8, fontSize: 14 }}>
            Customise scenarios and see how different policy combinations affect housing outcomes.
            Check the Assumptions footer for full transparency on methodology.
          </p>
          <Link to="/" className="ctaLink" style={{ fontSize: 14, padding: "10px 18px" }}>
            Open Explore the Model →
          </Link>
        </div>
      </Section>
    </div>
  );
}
