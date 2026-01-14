import { useState } from "react";
import { useModel, scopeLabel } from "../model/ModelContext";
import { CITIES, ALL_STATES, STATE_NAMES } from "../model/types";
import { HELP } from "./shared/HelpText";
import { listAtBounds, listCalibrationFirstActive, toPolicyV2 } from "../model/policyRegistry";

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-AU").format(Math.round(n));
}

function Section({
  title,
  items,
  icon,
}: {
  title: string;
  items: readonly string[];
  icon: string;
}) {
  return (
    <div className="footerBox">
      <div className="h3" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>{icon}</span>
        {title}
      </div>
      <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PolicyBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: active ? "#fef3c7" : "#f3f4f6",
        border: `1px solid ${active ? "#f59e0b" : "#d1d5db"}`,
        color: active ? "#92400e" : "#6b7280",
      }}
    >
      {active ? "✓" : "○"} {label}
    </span>
  );
}

export function AssumptionsFooter() {
  const { params, scope, scopedView, includeAllCities, calibrationReport } = useModel();
  // Start collapsed so the sticky footer never obscures the model by default (especially on small screens).
  const [open, setOpen] = useState(false);

  const totalPop = scopedView.years[0]?.population ?? 0;
  const totalStock = scopedView.years[0]?.dwellingStock ?? 0;

  const transparencyHelp = HELP.transparency;

  const policyActive =
    params.policy.negativeGearingMode !== "none" ||
    params.policy.ownershipCapEnabled ||
    params.policy.supplyBoost !== 0 ||
    params.policy.demandReduction !== 0;

  const policyV2 = toPolicyV2(params.policy as any);
  const calibrationFirstActive = listCalibrationFirstActive(policyV2);
  const atBounds = listAtBounds(policyV2);
  const calEnabled = !!params.advanced?.calibration?.enabled;
  const hasHistory = !!params.advanced?.calibration?.historyByCity;
  const historyBundle = params.advanced?.calibration?.historyBundle as any;
  const historyWarnings = (historyBundle?.meta?.warnings as string[] | undefined) ?? [];
  const historyNotes = (historyBundle?.meta?.notes as string[] | undefined) ?? [];

  const cityCount = params.cities.length;
  const capitalCount = params.cities.filter((c) => {
    const meta = CITIES.find((m) => m.id === c.cityId);
    return meta?.isCapital;
  }).length;
  const regionalCount = cityCount - capitalCount;

  // Get active states
  const activeStates = [...new Set(params.cities.map((c) => {
    const meta = CITIES.find((m) => m.id === c.cityId);
    return meta?.state;
  }).filter(Boolean))];

  return (
    <section
      className={`footerPanel ${open ? "footerPanel--open" : ""}`}
      aria-label="Assumptions and transparency"
    >
      <div className="container footerPanelInner">
        <div className="footerPanelHeader">
          <div>
            <div className="h3" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔍</span>
              Trust & transparency
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              What this model assumes, what it can't predict, and what could change outcomes.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="assumptions-footer-details"
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {open ? "▲ Hide details" : "▼ Show details"}
          </button>
        </div>

        {open ? (
          <div id="assumptions-footer-details" className="footerPanelDetails">
            {/* Quick summary bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: 12,
                background: "var(--bg-subtle)",
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <PolicyBadge
                label={`NG: ${params.policy.negativeGearingMode}`}
                active={params.policy.negativeGearingMode !== "none"}
              />
              <PolicyBadge label="Ownership cap" active={params.policy.ownershipCapEnabled} />
              <PolicyBadge
                label={`Supply: ${Math.round(params.policy.supplyBoost * 100)}%`}
                active={params.policy.supplyBoost !== 0}
              />
              <PolicyBadge
                label={`Demand: ${Math.round(params.policy.demandReduction * 100)}%`}
                active={params.policy.demandReduction !== 0}
              />
              <PolicyBadge label={`${params.policy.rampYears}yr ramp`} active={params.policy.rampYears > 0} />
            </div>

            <div className="footerPanelBody">
              {/* Current configuration */}
              <div className="footerBox" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
                <div className="h3" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📊</span>
                  Current configuration
                </div>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                  <li style={{ marginBottom: 4 }}>
                    <strong>Coverage:</strong> {cityCount} cities ({capitalCount} capitals
                    {includeAllCities && regionalCount > 0 ? ` + ${regionalCount} regional` : ""}) across{" "}
                    {activeStates.length} states/territories
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <strong>Viewing:</strong> {scopeLabel(scope)} — {fmtInt(totalPop)} population,{" "}
                    {fmtInt(totalStock)} dwellings
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <strong>Simulation:</strong> {params.years} years with {params.policy.rampYears} year policy ramp
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <strong>Calibration:</strong>{" "}
                    {calEnabled ? (hasHistory ? "enabled (history attached)" : "enabled (no history attached)") : "disabled"}{" "}
                    {calibrationReport?.fitted ? (
                      <span className="muted">
                        — fitted market adjustment speed: {calibrationReport.fitted.marketAdjustmentSpeed.toFixed(2)}
                      </span>
                    ) : null}
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <strong>Historical overlay:</strong>{" "}
                    {historyBundle ? `attached (${historyBundle.startYear ?? "?"}–${historyBundle.endYear ?? "?"})` : "not attached"}
                    {historyWarnings.length ? (
                      <span className="muted"> — {historyWarnings[0]}</span>
                    ) : null}
                  </li>
                  {policyActive && (
                    <li style={{ fontWeight: 600, color: "#15803d" }}>
                      <strong>Active policies:</strong>{" "}
                      {[
                        params.policy.negativeGearingMode !== "none" &&
                          `NG ${params.policy.negativeGearingMode} (${Math.round(params.policy.negativeGearingIntensity * 100)}%)`,
                        params.policy.ownershipCapEnabled &&
                          `ownership cap (${Math.round(params.policy.ownershipCapEnforcement * 100)}% enforcement)`,
                        params.policy.supplyBoost !== 0 && `${Math.round(params.policy.supplyBoost * 100)}% supply boost`,
                        params.policy.demandReduction !== 0 &&
                          `${Math.round(params.policy.demandReduction * 100)}% demand reduction`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </li>
                  )}
                  {calibrationFirstActive.length > 0 && (
                    <li style={{ marginBottom: 4, color: "#92400e" }}>
                      <strong>Calibration-first levers active:</strong> {calibrationFirstActive.slice(0, 6).join(", ")}
                      {calibrationFirstActive.length > 6 ? "…" : ""}
                      {!calEnabled || !hasHistory ? " (unvalidated)" : ""}
                    </li>
                  )}
                  {atBounds.length > 0 && (
                    <li style={{ marginBottom: 4, color: "#92400e" }}>
                      <strong>At bounds:</strong> {atBounds.slice(0, 6).join(", ")}
                      {atBounds.length > 6 ? "…" : ""} (clamped)
                    </li>
                  )}
                  {historyBundle && historyNotes.length > 0 && (
                    <li style={{ marginBottom: 4 }}>
                      <details>
                        <summary style={{ cursor: "pointer" }}>
                          <strong>History notes</strong>
                        </summary>
                        <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: 12 }}>
                          {historyNotes.slice(0, 8).map((n: string, i: number) => (
                            <li key={i} style={{ marginBottom: 4 }}>{n}</li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  )}
                </ul>
              </div>

              {/* Core assumptions */}
              <Section title={transparencyHelp.assumptions.title} items={transparencyHelp.assumptions.items} icon="📐" />

              {/* Cannot predict */}
              <Section title={transparencyHelp.cannotPredict.title} items={transparencyHelp.cannotPredict.items} icon="❓" />

              {/* Key uncertainties */}
              <Section title={transparencyHelp.uncertainties.title} items={transparencyHelp.uncertainties.items} icon="⚠️" />
            </div>

            {/* Model disclaimer */}
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: "#fef3c7",
                borderRadius: 8,
                border: "1px solid #fcd34d",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Model disclaimer</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                This is an <strong>illustrative simulation</strong>, not a forecast. It shows how policy changes{" "}
                <em>might</em> affect housing markets under simplified assumptions. Real outcomes depend on many factors
                not captured here: interest rates, construction capacity, migration patterns, investor psychology, and
                political implementation. Use this tool to understand <strong>directional effects</strong> and
                <strong> relative magnitudes</strong>, not precise predictions.
              </div>
            </div>

            {/* Technical notes */}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 650, fontSize: 13, color: "#6b7280" }}>
                Technical notes for researchers
              </summary>
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: "#f9fafb",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>
                    <strong>Price formation:</strong> Supply-demand gap model with configurable elasticity curves. Does
                    not use hedonic pricing or comparable sales.
                  </li>
                  <li>
                    <strong>Investor behavior:</strong> Simplified rational response to policy incentives. Does not
                    model heterogeneous expectations or portfolio effects.
                  </li>
                  <li>
                    <strong>Aggregation:</strong> City-level results aggregated using population-weighted averages. Not
                    a spatial equilibrium model.
                  </li>
                  <li>
                    <strong>Decile analysis:</strong> Synthetic income distribution based on ABS patterns. Does not use
                    microdata or tenure-specific distributions.
                  </li>
                  <li>
                    <strong>Calibration:</strong> Parameters set to plausible ranges based on literature. Not formally
                    estimated or validated against historical data.
                  </li>
                </ul>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </section>
  );
}
