import React, { createContext, useContext, useMemo, useReducer } from "react";
import { runScenario, getScopedView } from "./runScenario";
import { calibrateScenario, type CalibrationReport } from "./calibration/calibrateScenario";
import type {
  ScenarioParams,
  ScenarioOutputs,
  PolicyLevers,
  PolicyLeversV2,
  RegionScenarioOutputs,
  CityScenarioOutputs,
} from "./types";
import type { Scope, CityId, StateId } from "./regions";
import { scopeKey, scopeLabel } from "./regions";
import {
  getAllCityBaselines,
  getCapitalBaselines,
  DEFAULT_POLICY_LEVERS,
  SCENARIO_PRESETS,
} from "./presets";
import { clampPolicyV2, toPolicyV2 } from "./policyRegistry";

/**
 * Merge multiple presets by stacking their effects.
 * Starts with baseline, then applies each preset's changes on top.
 * For numeric values, uses additive stacking (e.g., supply boosts add together).
 * For boolean/enum values, uses the last non-default value.
 */
function mergePresets(presetIds: string[]): PolicyLeversV2 {
  if (presetIds.length === 0) {
    return DEFAULT_POLICY_LEVERS;
  }

  // Filter out baseline - it's the base, not something to merge
  const nonBaselinePresets = presetIds.filter((id) => id !== "baseline");
  
  // Start with baseline
  let merged = { ...DEFAULT_POLICY_LEVERS };
  let maxYears = 20;

  for (const presetId of nonBaselinePresets) {
    const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (!preset) continue;

    const presetPolicy = toPolicyV2(preset.policy);

    // Merge numeric values additively (for things like supply boost, demand reduction)
    merged.supplyBoost = Math.min(1, merged.supplyBoost + presetPolicy.supplyBoost);
    merged.demandReduction = Math.min(1, merged.demandReduction + presetPolicy.demandReduction);

    // Merge negative gearing (take the most restrictive)
    if (presetPolicy.negativeGearingMode !== "none") {
      merged.negativeGearingMode = presetPolicy.negativeGearingMode;
      merged.negativeGearingIntensity = Math.max(
        merged.negativeGearingIntensity,
        presetPolicy.negativeGearingIntensity
      );
    }

    // Merge ownership cap (take the most restrictive)
    if (presetPolicy.ownershipCapEnabled) {
      merged.ownershipCapEnabled = true;
      merged.ownershipCapEnforcement = Math.max(
        merged.ownershipCapEnforcement,
        presetPolicy.ownershipCapEnforcement
      );
      merged.excessInvestorStockShare = Math.max(
        merged.excessInvestorStockShare,
        presetPolicy.excessInvestorStockShare
      );
      merged.divestmentPhased = presetPolicy.divestmentPhased || merged.divestmentPhased;
    }

    // Merge ramp years (take the longest)
    merged.rampYears = Math.max(merged.rampYears, presetPolicy.rampYears);

    // Merge advanced policy levers (additive for most, max for others)
    if (presetPolicy.taxInvestor) {
      merged.taxInvestor = {
        ...merged.taxInvestor,
        cgtDiscountDelta: merged.taxInvestor.cgtDiscountDelta + presetPolicy.taxInvestor.cgtDiscountDelta,
        landTaxShift: Math.max(merged.taxInvestor.landTaxShift, presetPolicy.taxInvestor.landTaxShift),
        vacancyTaxIntensity: Math.max(
          merged.taxInvestor.vacancyTaxIntensity,
          presetPolicy.taxInvestor.vacancyTaxIntensity
        ),
        shortStayRegulationIntensity: Math.max(
          merged.taxInvestor.shortStayRegulationIntensity,
          presetPolicy.taxInvestor.shortStayRegulationIntensity
        ),
        foreignBuyerRestrictionIntensity: Math.max(
          merged.taxInvestor.foreignBuyerRestrictionIntensity,
          presetPolicy.taxInvestor.foreignBuyerRestrictionIntensity
        ),
      };
    }

    if (presetPolicy.credit) {
      merged.credit = {
        ...merged.credit,
        serviceabilityBufferDelta: Math.max(
          merged.credit.serviceabilityBufferDelta,
          presetPolicy.credit.serviceabilityBufferDelta
        ),
        dtiCapTightness: Math.max(merged.credit.dtiCapTightness, presetPolicy.credit.dtiCapTightness),
        investorLendingLimitTightness: Math.max(
          merged.credit.investorLendingLimitTightness,
          presetPolicy.credit.investorLendingLimitTightness
        ),
      };
    }

    if (presetPolicy.subsidies) {
      merged.subsidies = {
        ...merged.subsidies,
        firstHomeBuyerSubsidyIntensity: Math.max(
          merged.subsidies.firstHomeBuyerSubsidyIntensity,
          presetPolicy.subsidies.firstHomeBuyerSubsidyIntensity
        ),
      };
    }

    if (presetPolicy.rental) {
      merged.rental = {
        ...merged.rental,
        rentAssistanceIntensity: Math.max(
          merged.rental.rentAssistanceIntensity,
          presetPolicy.rental.rentAssistanceIntensity
        ),
        rentRegulationCap:
          presetPolicy.rental.rentRegulationCap != null
            ? presetPolicy.rental.rentRegulationCap
            : merged.rental.rentRegulationCap,
        rentRegulationCoverage: Math.max(
          merged.rental.rentRegulationCoverage,
          presetPolicy.rental.rentRegulationCoverage
        ),
        vacancyDecontrol: presetPolicy.rental.vacancyDecontrol || merged.rental.vacancyDecontrol,
      };
    }

    if (presetPolicy.planning) {
      merged.planning = {
        ...merged.planning,
        upzoningIntensity: Math.max(merged.planning.upzoningIntensity, presetPolicy.planning.upzoningIntensity),
        infrastructureEnablement: Math.max(
          merged.planning.infrastructureEnablement,
          presetPolicy.planning.infrastructureEnablement
        ),
        infrastructureLagYears: Math.min(
          merged.planning.infrastructureLagYears,
          presetPolicy.planning.infrastructureLagYears
        ),
      };
    }

    if (presetPolicy.publicCommunity) {
      merged.publicCommunity = {
        ...merged.publicCommunity,
        publicHousingBuildBoost: Math.max(
          merged.publicCommunity.publicHousingBuildBoost,
          presetPolicy.publicCommunity.publicHousingBuildBoost
        ),
        publicHousingAcquisitionSharePerYear: Math.max(
          merged.publicCommunity.publicHousingAcquisitionSharePerYear,
          presetPolicy.publicCommunity.publicHousingAcquisitionSharePerYear
        ),
        conversionToSocialSharePerYear: Math.max(
          merged.publicCommunity.conversionToSocialSharePerYear,
          presetPolicy.publicCommunity.conversionToSocialSharePerYear
        ),
      };
    }

    if (presetPolicy.migration) {
      merged.migration = {
        ...merged.migration,
        netOverseasMigrationShock: merged.migration.netOverseasMigrationShock + presetPolicy.migration.netOverseasMigrationShock,
      };
    }

    // Take the longest years if specified
    if (preset.years) {
      maxYears = Math.max(maxYears, preset.years);
    }
  }

  return clampPolicyV2(merged);
}

type ModelState = {
  years: number;
  policy: PolicyLeversV2;
  scope: Scope;
  presetId: string; // Keep for backward compatibility
  selectedPresets: string[]; // Array of selected preset IDs for multi-select
  includeAllCities: boolean;
  engine: ScenarioParams["engine"];
  showHistory: boolean;
  historyIndexBase: "history" | "year0";
  focusYear: number | null;
};

type Action =
  | { type: "setYears"; years: number }
  | { type: "patchPolicy"; patch: Partial<PolicyLeversV2> }
  | { type: "setPolicy"; policy: PolicyLeversV2 }
  | { type: "setScope"; scope: Scope }
  | { type: "applyPreset"; presetId: string }
  | { type: "togglePreset"; presetId: string } // New: toggle a preset on/off
  | { type: "toggleCityCoverage"; includeAll: boolean }
  | { type: "setEngine"; engine: ScenarioParams["engine"] }
  | { type: "setShowHistory"; showHistory: boolean }
  | { type: "setHistoryIndexBase"; base: "history" | "year0" }
  | { type: "setFocusYear"; year: number | null }
  | { type: "reset" };

const initialState: ModelState = {
  years: 20,
  policy: DEFAULT_POLICY_LEVERS,
  scope: { level: "national" },
  presetId: "baseline",
  selectedPresets: ["baseline"], // Start with baseline selected
  includeAllCities: true,
  engine: "aggregate",
  showHistory: false,
  historyIndexBase: "history",
  focusYear: null,
};

function reducer(state: ModelState, action: Action): ModelState {
  switch (action.type) {
    case "setYears":
      return { ...state, years: action.years, presetId: "custom", selectedPresets: [] };
    case "patchPolicy":
      return {
        ...state,
        policy: clampPolicyV2({ ...toPolicyV2(state.policy), ...action.patch }),
        presetId: "custom",
        selectedPresets: [], // Clear presets when manually editing
      };
    case "setPolicy":
      return {
        ...state,
        policy: clampPolicyV2(action.policy),
        presetId: "custom",
        selectedPresets: [], // Clear presets when manually setting
      };
    case "setScope":
      return { ...state, scope: action.scope };
    case "applyPreset": {
      // Legacy single-preset selection (for backward compatibility)
      const preset = SCENARIO_PRESETS.find((p) => p.id === action.presetId);
      if (!preset) return state;
      return {
        ...state,
        policy: clampPolicyV2(preset.policy),
        years: preset.years ?? state.years,
        presetId: action.presetId,
        selectedPresets: [action.presetId],
      };
    }
    case "togglePreset": {
      // Toggle a preset on/off in multi-select mode
      const isSelected = state.selectedPresets.includes(action.presetId);
      let newSelectedPresets: string[];

      if (isSelected) {
        // Remove it
        newSelectedPresets = state.selectedPresets.filter((id) => id !== action.presetId);
        // Ensure at least baseline is selected
        if (newSelectedPresets.length === 0) {
          newSelectedPresets = ["baseline"];
        }
      } else {
        // Add it (but remove baseline if adding a non-baseline preset)
        if (action.presetId === "baseline") {
          newSelectedPresets = ["baseline"];
        } else {
          newSelectedPresets = [...state.selectedPresets.filter((id) => id !== "baseline"), action.presetId];
        }
      }

      // Merge all selected presets
      const mergedPolicy = mergePresets(newSelectedPresets);
      
      // Get max years from selected presets
      const maxYears = Math.max(
        ...newSelectedPresets.map((id) => {
          const p = SCENARIO_PRESETS.find((preset) => preset.id === id);
          return p?.years ?? 20;
        })
      );

      return {
        ...state,
        selectedPresets: newSelectedPresets,
        policy: mergedPolicy,
        years: maxYears,
        presetId: newSelectedPresets.length === 1 ? newSelectedPresets[0] : "custom",
      };
    }
    case "toggleCityCoverage":
      return { ...state, includeAllCities: action.includeAll };
    case "setEngine":
      return { ...state, engine: action.engine, presetId: "custom", selectedPresets: [] };
    case "setShowHistory":
      return { ...state, showHistory: action.showHistory };
    case "setHistoryIndexBase":
      return { ...state, historyIndexBase: action.base };
    case "setFocusYear":
      return { ...state, focusYear: action.year };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

type ModelContextValue = {
  params: ScenarioParams;
  outputs: ScenarioOutputs;
  scope: Scope;
  scopedView: RegionScenarioOutputs;
  presetId: string;
  selectedPresets: string[]; // Array of selected preset IDs
  includeAllCities: boolean;
  engine: ScenarioParams["engine"];
  calibrationReport: CalibrationReport | null;
  showHistory: boolean;
  historyIndexBase: "history" | "year0";
  focusYear: number | null;

  // City-level data (if scope is city)
  selectedCityData: CityScenarioOutputs | null;

  // Actions
  patchPolicy: (patch: Partial<PolicyLeversV2>) => void;
  setPolicy: (policy: PolicyLeversV2) => void;
  setYears: (years: number) => void;
  setScope: (scope: Scope) => void;
  selectNational: () => void;
  selectState: (state: StateId) => void;
  selectCity: (city: CityId) => void;
  applyPreset: (presetId: string) => void;
  togglePreset: (presetId: string) => void; // Toggle a preset on/off
  toggleCityCoverage: (includeAll: boolean) => void;
  setEngine: (engine: ScenarioParams["engine"]) => void;
  setShowHistory: (show: boolean) => void;
  setHistoryIndexBase: (base: "history" | "year0") => void;
  setFocusYear: (year: number | null) => void;
  resetToDefaults: () => void;
};

const Ctx = createContext<ModelContextValue | null>(null);

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const params: ScenarioParams = useMemo(
    () => ({
      years: state.years,
      cities: state.includeAllCities ? getAllCityBaselines() : getCapitalBaselines(),
      policy: state.policy,
      engine: state.engine,
      advanced:
        state.engine === "advanced"
          ? {
              spatialEquilibrium: { enabled: true },
              expectations: { enabled: true, model: "mixed" },
              portfolio: { enabled: true },
              microDistributions: { enabled: false },
              calibration: { enabled: false },
            }
          : undefined,
    }),
    [state.years, state.policy, state.includeAllCities, state.engine]
  );

  const calibrationReport = useMemo(() => {
    const cal = params.advanced?.calibration;
    if (!cal?.enabled || !cal.historyByCity) return null;
    try {
      return calibrateScenario(params);
    } catch {
      return null;
    }
  }, [params]);

  const calibratedParams: ScenarioParams = useMemo(() => {
    if (!calibrationReport) return params;
    // Apply calibrated marketAdjustmentSpeed as a constants override.
    return {
      ...params,
      constants: {
        ...(params.constants ?? {}),
        marketAdjustmentSpeed: calibrationReport.fitted.marketAdjustmentSpeed,
      },
    };
  }, [params, calibrationReport]);

  const outputs = useMemo(() => runScenario(calibratedParams), [calibratedParams]);

  // Get the scoped view (handles national/state/city uniformly)
  const scopedView = useMemo(() => {
    try {
      return getScopedView(outputs, state.scope);
    } catch {
      // If scope not available (e.g., city not included), fallback to national
      return getScopedView(outputs, { level: "national" });
    }
  }, [outputs, state.scope]);

  // Get city-level detailed data if a city is selected
  const selectedCityData = useMemo(() => {
    if (state.scope.level === "city") {
      return outputs.byCity[state.scope.city] ?? null;
    }
    return null;
  }, [outputs, state.scope]);

  const value: ModelContextValue = useMemo(
    () => ({
      params: calibratedParams,
      outputs,
      scope: state.scope,
      scopedView,
      presetId: state.presetId,
      selectedPresets: state.selectedPresets,
      includeAllCities: state.includeAllCities,
      engine: state.engine,
      calibrationReport,
      showHistory: state.showHistory,
      historyIndexBase: state.historyIndexBase,
      focusYear: state.focusYear,
      selectedCityData,
      patchPolicy: (patch) => dispatch({ type: "patchPolicy", patch }),
      setPolicy: (policy) => dispatch({ type: "setPolicy", policy }),
      setYears: (years) => dispatch({ type: "setYears", years }),
      setScope: (scope) => dispatch({ type: "setScope", scope }),
      selectNational: () => dispatch({ type: "setScope", scope: { level: "national" } }),
      selectState: (st) => dispatch({ type: "setScope", scope: { level: "state", state: st } }),
      selectCity: (city) => dispatch({ type: "setScope", scope: { level: "city", city } }),
      applyPreset: (presetId) => dispatch({ type: "applyPreset", presetId }),
      togglePreset: (presetId) => dispatch({ type: "togglePreset", presetId }),
      toggleCityCoverage: (includeAll) => dispatch({ type: "toggleCityCoverage", includeAll }),
      setEngine: (engine) => dispatch({ type: "setEngine", engine }),
      setShowHistory: (show) => dispatch({ type: "setShowHistory", showHistory: show }),
      setHistoryIndexBase: (base) => dispatch({ type: "setHistoryIndexBase", base }),
      setFocusYear: (year) => dispatch({ type: "setFocusYear", year }),
      resetToDefaults: () => dispatch({ type: "reset" }),
    }),
    [
      calibratedParams,
      outputs,
      state.scope,
      scopedView,
      state.presetId,
      state.selectedPresets,
      state.includeAllCities,
      selectedCityData,
      state.engine,
      calibrationReport,
      state.showHistory,
      state.historyIndexBase,
      state.focusYear,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModel(): ModelContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModel must be used within ModelProvider");
  return ctx;
}

// Re-export scope utilities for convenience
export { scopeKey, scopeLabel };
