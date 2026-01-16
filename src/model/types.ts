/**
 * Centralised type exports for the housing reform model.
 */

// Region registry
export type { CityId, StateId, CityMeta, Scope } from "./regions";
export {
  CITIES,
  cityMeta,
  getCapitalCities,
  getMajorCities,
  getCitiesByState,
  ALL_STATES,
  STATE_NAMES,
  scopeKey,
  scopeLabel,
  parseScope,
} from "./regions";

// Microdata helpers (optional advanced feature)
export type { MicroRecord } from "./advanced/microdata";
export { buildMicrodataBundle } from "./microdata";

// Core types from methodology
export type {
  Year,
  CurveName,
  Curves,
  CoreConstants,
  CityBaseState,
  ModelEngine,
  AdvancedModelConfig,
  NegativeGearingMode,
  PolicyLevers,
  PolicyLeversV2,
  ScenarioParams,
} from "./methodology";

export type { RatePathConfig, RatePathMode, RateScenario } from "./ratePath";

export { DEFAULT_CONSTANTS, DEFAULT_CURVES } from "./methodology";

// Scenario output types from runScenario
export type {
  YearState,
  RegionYearState,
  RegionScenarioOutputs,
  CityScenarioOutputs,
  ScenarioSummary,
  ScenarioOutputs,
  Decile,
  DecileRow,
  DecileOutputs,
} from "./runScenario";

export { runScenario, getScopedView, getAvailableScopes } from "./runScenario";

// Calibration
export type { CalibrationReport } from "./calibration/calibrateScenario";
export { calibrateScenario } from "./calibration/calibrateScenario";

// Presets and helpers
export {
  CITY_BASELINES,
  getAllCityBaselines,
  getCapitalBaselines,
  getStateBaselines,
  DEFAULT_POLICY_LEVERS,
  SCENARIO_PRESETS,
  getPreset,
  buildScenarioFromPreset,
  buildDefaultScenario,
} from "./presets";

export type { ScenarioPreset } from "./presets";

// Validation
export {
  validateCityBaseline,
  validateAllBaselines,
  validateCoverage,
  formatValidationResult,
  formatCoverageResult,
} from "./validateBaselines";

export type { ValidationError, ValidationResult, CoverageResult } from "./validateBaselines";
