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

type ModelState = {
  years: number;
  policy: PolicyLeversV2;
  scope: Scope;
  presetId: string;
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
  includeAllCities: true,
  engine: "aggregate",
  showHistory: false,
  historyIndexBase: "history",
  focusYear: null,
};

function reducer(state: ModelState, action: Action): ModelState {
  switch (action.type) {
    case "setYears":
      return { ...state, years: action.years, presetId: "custom" };
    case "patchPolicy":
      return {
        ...state,
        policy: clampPolicyV2({ ...toPolicyV2(state.policy), ...action.patch }),
        presetId: "custom",
      };
    case "setPolicy":
      return { ...state, policy: clampPolicyV2(action.policy), presetId: "custom" };
    case "setScope":
      return { ...state, scope: action.scope };
    case "applyPreset": {
      const preset = SCENARIO_PRESETS.find((p) => p.id === action.presetId);
      if (!preset) return state;
      return {
        ...state,
        policy: clampPolicyV2(preset.policy),
        years: preset.years ?? state.years,
        presetId: action.presetId,
      };
    }
    case "toggleCityCoverage":
      return { ...state, includeAllCities: action.includeAll };
    case "setEngine":
      return { ...state, engine: action.engine, presetId: "custom" };
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
