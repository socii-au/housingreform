import { useState } from "react";
import { useModel, scopeLabel } from "../model/ModelContext";
import { SCENARIO_PRESETS, ALL_STATES, STATE_NAMES, CITIES } from "../model/types";
import type { NegativeGearingMode, StateId, CityId } from "../model/types";
import { HELP, InfoTooltip } from "./shared/HelpText";
import { toPolicyV2 } from "../model/policyRegistry";
import { GROUP_PARTIES, PARTY_ORDER, PartyChip, PRESET_PARTIES } from "./policyParty";

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${Math.round(n * 100)}%`;
}

function fmtPctPoints(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const s = Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${s}%`;
}

function StatusChip({ tone, text }: { tone: "success" | "warning" | "info"; text: string }) {
  return <span className={`chip tone-${tone}`}>{text}</span>;
}

function ControlGroup({
  title,
  icon,
  defaultOpen = true,
  tone,
  children,
}: {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  tone?: "warning" | "success" | "info";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneClass = tone ? `tone-${tone}` : "";

  return (
    <div className={`control-group ${toneClass}`}>
      <button
        type="button"
        className="control-group-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="control-group-icon">{icon}</span>
        <span className="control-group-title">{title}</span>
        <span className="control-group-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="control-group-body">{children}</div>}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  tooltip?: string;
}) {
  const formatted = format ? format(value) : String(value);
  return (
    <div className="slider-field">
      <div className="slider-field-label">
        <span>{label}: <strong>{formatted}</strong></span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ControlsPanel() {
  const {
    params,
    scope,
    patchPolicy,
    setYears,
    selectNational,
    selectState,
    selectCity,
    applyPreset,
    togglePreset,
    presetId,
    selectedPresets,
    resetToDefaults,
    includeAllCities,
    toggleCityCoverage,
    engine,
    setEngine,
    showHistory,
    setShowHistory,
    historyIndexBase,
    setHistoryIndexBase,
    ratePath,
    setRatePath,
    autoRba,
    setAutoRba,
    autoRbaMessage,
  } = useModel();

  const policy = toPolicyV2(params.policy as any);
  const calibrationEnabled =
    !!params.advanced?.calibration?.enabled && !!params.advanced?.calibration?.historyByCity;
  const [expertMode, setExpertMode] = useState(false);

  const scopeValue =
    scope.level === "national"
      ? "NATIONAL"
      : scope.level === "state"
        ? `STATE:${scope.state}`
        : `CITY:${scope.city}`;

  const handleScopeChange = (val: string) => {
    if (val === "NATIONAL") {
      selectNational();
    } else if (val.startsWith("STATE:")) {
      selectState(val.replace("STATE:", "") as StateId);
    } else if (val.startsWith("CITY:")) {
      selectCity(val.replace("CITY:", "") as CityId);
    }
  };

  const citiesWithState = includeAllCities ? CITIES : CITIES.filter((c) => c.isCapital);
  const totalCitiesShown = citiesWithState.length;

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h2 className="h3" style={{ margin: 0 }}>Scenario Controls</h2>
        <button type="button" className="btn-reset" onClick={resetToDefaults}>
          ↺ Reset
        </button>
      </div>

      {/* Scenario & Scope */}
      <ControlGroup title="Scenario & Scope" icon="🎯" defaultOpen={true}>
        <div className="field">
          <label className="field-label">Policy Scenarios (multi-select)</label>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            Select multiple scenarios to stack their effects. Effects combine additively where applicable.
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "6px 8px",
              background: "var(--bg-subtle)",
              borderRadius: 8,
              marginBottom: 10,
            }}
            aria-label="Policy color key"
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginRight: 4 }}>
              Color key:
            </span>
            {PARTY_ORDER.map((p) => (
              <PartyChip key={p} party={p} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Baseline */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selectedPresets.includes("baseline")}
                onChange={() => togglePreset("baseline")}
                style={{ cursor: "pointer" }}
              />
              <span>📊 Baseline (No Change)</span>
            </label>

            {/* Reforms */}
            <div style={{ marginTop: 4, paddingLeft: 20, borderLeft: "2px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                Reforms
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("ng-remove")}
                  onChange={() => togglePreset("ng-remove")}
                  style={{ cursor: "pointer" }}
                />
                <span>🔧 Remove Negative Gearing</span>
                {PRESET_PARTIES["ng-remove"]?.map((p) => (
                  <PartyChip key={`ng-remove-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("ng-remove-fast")}
                  onChange={() => togglePreset("ng-remove-fast")}
                  style={{ cursor: "pointer" }}
                />
                <span>⚡ Remove NG (Immediate)</span>
                {PRESET_PARTIES["ng-remove-fast"]?.map((p) => (
                  <PartyChip key={`ng-remove-fast-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("ng-restore")}
                  onChange={() => togglePreset("ng-restore")}
                  style={{ cursor: "pointer" }}
                />
                <span>↩️ Restore Negative Gearing</span>
                {PRESET_PARTIES["ng-restore"]?.map((p) => (
                  <PartyChip key={`ng-restore-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("ownership-cap")}
                  onChange={() => togglePreset("ownership-cap")}
                  style={{ cursor: "pointer" }}
                />
                <span>🏠 Ownership Cap (1 PPOR + 1 IP)</span>
                {PRESET_PARTIES["ownership-cap"]?.map((p) => (
                  <PartyChip key={`ownership-cap-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("ownership-cap-aggressive")}
                  onChange={() => togglePreset("ownership-cap-aggressive")}
                  style={{ cursor: "pointer" }}
                />
                <span>⚔️ Ownership Cap (Aggressive)</span>
                {PRESET_PARTIES["ownership-cap-aggressive"]?.map((p) => (
                  <PartyChip key={`ownership-cap-aggressive-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("supply-boost")}
                  onChange={() => togglePreset("supply-boost")}
                  style={{ cursor: "pointer" }}
                />
                <span>🏗️ Supply Boost +20%</span>
                {PRESET_PARTIES["supply-boost"]?.map((p) => (
                  <PartyChip key={`supply-boost-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("comprehensive")}
                  onChange={() => togglePreset("comprehensive")}
                  style={{ cursor: "pointer" }}
                />
                <span>📦 Comprehensive Reform</span>
                {PRESET_PARTIES["comprehensive"]?.map((p) => (
                  <PartyChip key={`comprehensive-${p}`} party={p} />
                ))}
              </label>
            </div>

            {/* Expert presets */}
            <div style={{ marginTop: 4, paddingLeft: 20, borderLeft: "2px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                Expert Presets
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("land-tax-transition")}
                  onChange={() => togglePreset("land-tax-transition")}
                  style={{ cursor: "pointer" }}
                />
                <span>🧾 Land Tax Transition</span>
                {PRESET_PARTIES["land-tax-transition"]?.map((p) => (
                  <PartyChip key={`land-tax-transition-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("macroprudential-tightening")}
                  onChange={() => togglePreset("macroprudential-tightening")}
                  style={{ cursor: "pointer" }}
                />
                <span>🏦 Macroprudential Tightening</span>
                {PRESET_PARTIES["macroprudential-tightening"]?.map((p) => (
                  <PartyChip key={`macroprudential-tightening-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("short-stay-clampdown")}
                  onChange={() => togglePreset("short-stay-clampdown")}
                  style={{ cursor: "pointer" }}
                />
                <span>🛏️ Short-Stay Clampdown</span>
                {PRESET_PARTIES["short-stay-clampdown"]?.map((p) => (
                  <PartyChip key={`short-stay-clampdown-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("public-housing-build")}
                  onChange={() => togglePreset("public-housing-build")}
                  style={{ cursor: "pointer" }}
                />
                <span>🏘️ Public Housing Build</span>
                {PRESET_PARTIES["public-housing-build"]?.map((p) => (
                  <PartyChip key={`public-housing-build-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("migration-shock-down")}
                  onChange={() => togglePreset("migration-shock-down")}
                  style={{ cursor: "pointer" }}
                />
                <span>🧳 Migration Shock (Lower)</span>
                {PRESET_PARTIES["migration-shock-down"]?.map((p) => (
                  <PartyChip key={`migration-shock-down-${p}`} party={p} />
                ))}
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.includes("all-levers")}
                  onChange={() => togglePreset("all-levers")}
                  style={{ cursor: "pointer" }}
                />
                <span>🧪 All Levers (Stress Test)</span>
                {PRESET_PARTIES["all-levers"]?.map((p) => (
                  <PartyChip key={`all-levers-${p}`} party={p} />
                ))}
              </label>
            </div>

            {selectedPresets.length > 1 && (
              <div style={{ marginTop: 8, padding: 8, background: "var(--accent-light)", borderRadius: 6, fontSize: 11 }}>
                <strong>Stacking {selectedPresets.length} scenarios:</strong> Effects combine additively (supply/demand) or use maximum (restrictions).
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Model engine</label>
          <select
            value={engine ?? "aggregate"}
            onChange={(e) => setEngine(e.target.value as any)}
            className="select-field"
          >
            <option value="aggregate">⚡ Aggregate (fast)</option>
            <option value="advanced">🧠 Advanced (spatial + portfolio)</option>
          </select>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Advanced mode couples cities via migration (spatial equilibrium) and adds heterogeneous expectations +
            investor portfolio allocation. Microdata (if provided) can replace the decile proxy for stress rates.
          </div>
        </div>

        <div className="field">
          <label className="field-label">Geographic view</label>
          <select
            value={scopeValue}
            onChange={(e) => handleScopeChange(e.target.value)}
            className="select-field"
          >
            <option value="NATIONAL">🇦🇺 National</option>
            <optgroup label="States">
              {ALL_STATES.map((st) => (
                <option key={st} value={`STATE:${st}`}>
                  {STATE_NAMES[st]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cities">
              {citiesWithState.map((c) => (
                <option key={c.id} value={`CITY:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={includeAllCities}
            onChange={(e) => toggleCityCoverage(e.target.checked)}
          />
          <span>Include regional cities ({totalCitiesShown} total)</span>
        </label>

        <SliderField
          label="Years"
          value={params.years}
          min={5}
          max={30}
          step={1}
          onChange={setYears}
          tooltip={HELP.horizon.tooltip}
        />

        <div className="field" style={{ marginTop: 10 }}>
          <label className="field-label">Timeline</label>
          <label className="checkbox-field" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
            />
            <span>Show historical overlay (2000 → present)</span>
          </label>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Historical lines appear muted. Projections begin at the city baseline year.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12 }}>Index base:</span>
            <select
              value={historyIndexBase}
              onChange={(e) => setHistoryIndexBase(e.target.value as any)}
              className="select-field"
              style={{ maxWidth: 220 }}
            >
              <option value="history">Year 2000 (or earliest available)</option>
              <option value="year0">Baseline year (model start)</option>
            </select>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label className="field-label">RBA policy path</label>
          <label className="checkbox-field" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={autoRba}
              onChange={(e) => setAutoRba(e.target.checked)}
            />
            <span>Auto‑select RBA response</span>
          </label>
          {autoRba && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {autoRbaMessage}
            </div>
          )}
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <select
              value={ratePath.mode ?? "scenario"}
              onChange={(e) =>
                setRatePath({
                  ...ratePath,
                  mode: e.target.value as any,
                })
              }
              className="select-field"
              disabled={autoRba}
            >
              <option value="scenario">Scenario</option>
              <option value="fixed">Fixed</option>
              <option value="rule">RBA rule (simple)</option>
            </select>
            {ratePath.mode === "scenario" && (
              <select
                value={ratePath.scenario ?? "steady"}
                onChange={(e) =>
                  setRatePath({
                    ...ratePath,
                    scenario: e.target.value as any,
                  })
                }
                className="select-field"
                disabled={autoRba}
              >
                <option value="steady">Steady</option>
                <option value="tighten">Tighten</option>
                <option value="ease">Ease</option>
                <option value="highForLonger">High for longer</option>
                <option value="cutThenNormalize">Cut then normalize</option>
              </select>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Base rate is aligned to the latest RBA cash rate if provided in historical data; otherwise it uses the city baseline mortgage rate.
          </div>
        </div>
      </ControlGroup>

      {/* Negative Gearing */}
      <ControlGroup title="Negative Gearing" icon="🔧" defaultOpen={true} tone="warning">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {GROUP_PARTIES["Negative Gearing"].map((p) => (
            <PartyChip key={`ng-${p}`} party={p} />
          ))}
        </div>
        <div className="field">
          <select
            value={params.policy.negativeGearingMode}
            onChange={(e) =>
              patchPolicy({ negativeGearingMode: e.target.value as NegativeGearingMode })
            }
            className="select-field"
          >
            <option value="none">No change</option>
            <option value="remove">Remove / phase out</option>
            <option value="reverse">Restore</option>
          </select>
        </div>

        {params.policy.negativeGearingMode !== "none" && (
          <SliderField
            label="Intensity"
            value={params.policy.negativeGearingIntensity * 100}
            min={0}
            max={100}
            step={10}
            onChange={(v) => patchPolicy({ negativeGearingIntensity: v / 100 })}
            format={(v) => `${v}%`}
            tooltip={HELP.negativeGearing.intensity.tooltip}
          />
        )}
      </ControlGroup>

      {/* Ownership Cap */}
      <ControlGroup title="Ownership Cap" icon="🏠" defaultOpen={true} tone="success">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {GROUP_PARTIES["Ownership Cap"].map((p) => (
            <PartyChip key={`oc-${p}`} party={p} />
          ))}
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={params.policy.ownershipCapEnabled}
            onChange={(e) => patchPolicy({ ownershipCapEnabled: e.target.checked })}
          />
          <span>Enable cap (1 PPOR + 1 IP)</span>
        </label>

        {params.policy.ownershipCapEnabled && (
          <>
            <SliderField
              label="Enforcement"
              value={params.policy.ownershipCapEnforcement * 100}
              min={0}
              max={100}
              step={10}
              onChange={(v) => patchPolicy({ ownershipCapEnforcement: v / 100 })}
              format={(v) => `${v}%`}
              tooltip={HELP.ownershipCap.enforcement.tooltip}
            />
            <SliderField
              label="Excess stock"
              value={params.policy.excessInvestorStockShare * 100}
              min={0}
              max={40}
              step={5}
              onChange={(v) => patchPolicy({ excessInvestorStockShare: v / 100 })}
              format={(v) => `${v}%`}
              tooltip={HELP.ownershipCap.excessStock.tooltip}
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={params.policy.divestmentPhased}
                onChange={(e) => patchPolicy({ divestmentPhased: e.target.checked })}
              />
              <span>Phased divestment</span>
            </label>
          </>
        )}
      </ControlGroup>

      {/* Supply & Demand */}
      <ControlGroup title="Supply & Demand" icon="📊" defaultOpen={false}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {GROUP_PARTIES["Supply & Demand"].map((p) => (
            <PartyChip key={`sd-${p}`} party={p} />
          ))}
        </div>
        <SliderField
          label="Supply boost (–10% to +25%)"
          value={params.policy.supplyBoost * 100}
          min={-10}
          max={25}
          step={2.5}
          onChange={(v) => patchPolicy({ supplyBoost: v / 100 })}
          format={fmtPctPoints}
          tooltip={HELP.supplyBoost.tooltip}
        />
        <SliderField
          label="Demand reduction (–5% to +15%)"
          value={params.policy.demandReduction * 100}
          min={-5}
          max={15}
          step={2.5}
          onChange={(v) => patchPolicy({ demandReduction: v / 100 })}
          format={fmtPctPoints}
          tooltip={HELP.demandReduction.tooltip}
        />
      </ControlGroup>

      {/* Expert Mode */}
      <ControlGroup title="Expert mode (calibration-first)" icon="🧪" defaultOpen={false} tone="info">
        <label className="checkbox-field" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={expertMode} onChange={(e) => setExpertMode(e.target.checked)} />
          <span>Show advanced policy levers</span>
        </label>

        <div className="muted" style={{ fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
          These levers run without calibration, but should be treated as directional unless you supply historical series
          (affordability ratios) to the calibrator.{" "}
          {calibrationEnabled ? (
            <StatusChip tone="success" text="Calibration data detected" />
          ) : (
            <StatusChip tone="warning" text="No calibration data" />
          )}
        </div>

        {expertMode && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 6px" }}>
              <div style={{ fontWeight: 800 }}>Tax & investor incentives</div>
              {GROUP_PARTIES["Tax & investor incentives"].map((p) => (
                <PartyChip key={`tax-${p}`} party={p} />
              ))}
            </div>
            <SliderField
              label="CGT discount change (−25pp to +25pp)"
              value={policy.taxInvestor.cgtDiscountDelta * 100}
              min={-25}
              max={25}
              step={5}
              onChange={(pp) =>
                patchPolicy({ taxInvestor: { ...policy.taxInvestor, cgtDiscountDelta: pp / 100 } } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.cgtDiscountDelta?.tooltip}
            />
            <SliderField
              label="Stamp duty → land tax shift (0% to 100%)"
              value={policy.taxInvestor.landTaxShift * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) => patchPolicy({ taxInvestor: { ...policy.taxInvestor, landTaxShift: pct / 100 } } as any)}
              format={fmtPctPoints}
              tooltip={HELP.expert?.landTaxShift?.tooltip}
            />
            <SliderField
              label="Vacancy tax intensity (0% to 100%)"
              value={policy.taxInvestor.vacancyTaxIntensity * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({ taxInvestor: { ...policy.taxInvestor, vacancyTaxIntensity: pct / 100 } } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.vacancyTaxIntensity?.tooltip}
            />
            <SliderField
              label="Short-stay regulation intensity (0% to 100%)"
              value={policy.taxInvestor.shortStayRegulationIntensity * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({
                  taxInvestor: { ...policy.taxInvestor, shortStayRegulationIntensity: pct / 100 },
                } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.shortStayRegulationIntensity?.tooltip}
            />
            <SliderField
              label="Foreign buyer restriction intensity (0% to 100%)"
              value={policy.taxInvestor.foreignBuyerRestrictionIntensity * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({
                  taxInvestor: { ...policy.taxInvestor, foreignBuyerRestrictionIntensity: pct / 100 },
                } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.foreignBuyerRestrictionIntensity?.tooltip}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
              <div style={{ fontWeight: 800 }}>Credit / macro-prudential</div>
              {GROUP_PARTIES["Credit / macro-prudential"].map((p) => (
                <PartyChip key={`credit-${p}`} party={p} />
              ))}
            </div>
            <SliderField
              label="Serviceability buffer delta (−2pp to +3pp)"
              value={policy.credit.serviceabilityBufferDelta * 100}
              min={-2}
              max={3}
              step={0.5}
              onChange={(pp) =>
                patchPolicy({ credit: { ...policy.credit, serviceabilityBufferDelta: pp / 100 } } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.serviceabilityBufferDelta?.tooltip}
            />
            <SliderField
              label="DTI cap tightness (0% to 100%)"
              value={policy.credit.dtiCapTightness * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) => patchPolicy({ credit: { ...policy.credit, dtiCapTightness: pct / 100 } } as any)}
              format={fmtPctPoints}
              tooltip={HELP.expert?.dtiCapTightness?.tooltip}
            />
            <SliderField
              label="Investor lending limit tightness (0% to 100%)"
              value={policy.credit.investorLendingLimitTightness * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({ credit: { ...policy.credit, investorLendingLimitTightness: pct / 100 } } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.investorLendingLimitTightness?.tooltip}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
              <div style={{ fontWeight: 800 }}>Demand-side subsidies</div>
              {GROUP_PARTIES["Demand-side subsidies"].map((p) => (
                <PartyChip key={`subsidies-${p}`} party={p} />
              ))}
            </div>
            <SliderField
              label="First-home buyer subsidy intensity (0% to 100%)"
              value={policy.subsidies.firstHomeBuyerSubsidyIntensity * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({
                  subsidies: { ...policy.subsidies, firstHomeBuyerSubsidyIntensity: pct / 100 },
                } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.firstHomeBuyerSubsidyIntensity?.tooltip}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
              <div style={{ fontWeight: 800 }}>Rental settings</div>
              {GROUP_PARTIES["Rental settings"].map((p) => (
                <PartyChip key={`rental-${p}`} party={p} />
              ))}
            </div>
            <SliderField
              label="Rent assistance intensity (0% to 100%)"
              value={policy.rental.rentAssistanceIntensity * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({ rental: { ...policy.rental, rentAssistanceIntensity: pct / 100 } } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.rentAssistanceIntensity?.tooltip}
            />
            <label className="checkbox-field" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={policy.rental.rentRegulationCap != null}
                onChange={(e) =>
                  patchPolicy({
                    rental: { ...policy.rental, rentRegulationCap: e.target.checked ? 0.03 : null },
                  } as any)
                }
              />
              <span>Enable rent growth cap</span>
            </label>
            {policy.rental.rentRegulationCap != null && (
              <SliderField
                label="Rent growth cap (0% to 8% nominal/yr)"
                value={policy.rental.rentRegulationCap * 100}
                min={0}
                max={8}
                step={0.5}
                onChange={(pp) => patchPolicy({ rental: { ...policy.rental, rentRegulationCap: pp / 100 } } as any)}
                format={fmtPctPoints}
                tooltip={HELP.expert?.rentRegulationCap?.tooltip}
              />
            )}
            <SliderField
              label="Rent regulation coverage (0% to 100%)"
              value={policy.rental.rentRegulationCoverage * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({ rental: { ...policy.rental, rentRegulationCoverage: pct / 100 } } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.rentRegulationCoverage?.tooltip}
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={policy.rental.vacancyDecontrol}
                onChange={(e) => patchPolicy({ rental: { ...policy.rental, vacancyDecontrol: e.target.checked } } as any)}
              />
              <span>Vacancy decontrol (caps don’t bind on turnover)</span>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
              <div style={{ fontWeight: 800 }}>Planning / infrastructure</div>
              {GROUP_PARTIES["Planning / infrastructure"].map((p) => (
                <PartyChip key={`planning-${p}`} party={p} />
              ))}
            </div>
            <SliderField
              label="Upzoning intensity (0% to 100%)"
              value={policy.planning.upzoningIntensity * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) => patchPolicy({ planning: { ...policy.planning, upzoningIntensity: pct / 100 } } as any)}
              format={fmtPctPoints}
              tooltip={HELP.expert?.upzoningIntensity?.tooltip}
            />
            <SliderField
              label="Infrastructure enablement (0% to 100%)"
              value={policy.planning.infrastructureEnablement * 100}
              min={0}
              max={100}
              step={10}
              onChange={(pct) =>
                patchPolicy({
                  planning: { ...policy.planning, infrastructureEnablement: pct / 100 },
                } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.infrastructureEnablement?.tooltip}
            />
            <SliderField
              label="Infrastructure lag (0 to 10 years)"
              value={policy.planning.infrastructureLagYears}
              min={0}
              max={10}
              step={1}
              onChange={(v) =>
                patchPolicy({ planning: { ...policy.planning, infrastructureLagYears: v } } as any)
              }
              tooltip={HELP.expert?.infrastructureLagYears?.tooltip}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
              <div style={{ fontWeight: 800 }}>Public & community housing</div>
              {GROUP_PARTIES["Public & community housing"].map((p) => (
                <PartyChip key={`public-${p}`} party={p} />
              ))}
            </div>
            <SliderField
              label="Public housing build boost (0% to 20%)"
              value={policy.publicCommunity.publicHousingBuildBoost * 100}
              min={0}
              max={20}
              step={2}
              onChange={(pp) =>
                patchPolicy({
                  publicCommunity: { ...policy.publicCommunity, publicHousingBuildBoost: pp / 100 },
                } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.publicHousingBuildBoost?.tooltip}
            />
            <SliderField
              label="Public acquisition share (0% to 1% of stock/yr)"
              value={policy.publicCommunity.publicHousingAcquisitionSharePerYear * 100}
              min={0}
              max={1}
              step={0.1}
              onChange={(pp) =>
                patchPolicy({
                  publicCommunity: {
                    ...policy.publicCommunity,
                    publicHousingAcquisitionSharePerYear: pp / 100,
                  },
                } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.publicHousingAcquisitionSharePerYear?.tooltip}
            />
            <SliderField
              label="Private → social conversion (0% to 1% of stock/yr)"
              value={policy.publicCommunity.conversionToSocialSharePerYear * 100}
              min={0}
              max={1}
              step={0.1}
              onChange={(pp) =>
                patchPolicy({
                  publicCommunity: { ...policy.publicCommunity, conversionToSocialSharePerYear: pp / 100 },
                } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.conversionToSocialSharePerYear?.tooltip}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
              <div style={{ fontWeight: 800 }}>Population</div>
              {GROUP_PARTIES["Population"].map((p) => (
                <PartyChip key={`pop-${p}`} party={p} />
              ))}
            </div>
            <SliderField
              label="Net overseas migration shock (−30% to +30%)"
              value={policy.migration.netOverseasMigrationShock * 100}
              min={-30}
              max={30}
              step={5}
              onChange={(pp) =>
                patchPolicy({ migration: { ...policy.migration, netOverseasMigrationShock: pp / 100 } } as any)
              }
              format={fmtPctPoints}
              tooltip={HELP.expert?.netOverseasMigrationShock?.tooltip}
            />

            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Tip: you can still use presets above, then fine‑tune these sub‑levers for sensitivity testing.
            </div>
          </>
        )}
      </ControlGroup>

      {/* Timing */}
      <ControlGroup title="Policy Timing" icon="⏱️" defaultOpen={false}>
        <SliderField
          label="Ramp period"
          value={params.policy.rampYears}
          min={0}
          max={10}
          step={1}
          onChange={(v) => patchPolicy({ rampYears: v })}
          format={(v) => `${v} years`}
          tooltip={HELP.ramp.tooltip}
        />
      </ControlGroup>
    </div>
  );
}
