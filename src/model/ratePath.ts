export type RateScenario =
  | "steady"
  | "tighten"
  | "ease"
  | "highForLonger"
  | "cutThenNormalize";

export type RatePathMode = "fixed" | "scenario" | "rule";

export interface RatePathConfig {
  mode: RatePathMode;
  scenario?: RateScenario;
  baseRate: number;
  terminalRate?: number;
  shock?: number;

  neutralRate?: number;
  inflationTarget?: number;
  inflationWeight?: number;
  outputGapWeight?: number;
  smoothing?: number;

  /** Mortgage spread to apply when using cash-rate history. */
  mortgageSpread?: number;
}

export function computeRatePath(opts: {
  yearIndex: number;
  prevRate: number;
  inflation: number;
  outputGap: number;
  config?: RatePathConfig;
}): number {
  const { yearIndex, prevRate, inflation, outputGap, config } = opts;
  if (!config) return prevRate;

  if (config.mode === "fixed") return config.baseRate;

  if (config.mode === "scenario") {
    const scenario = config.scenario ?? "steady";
    const shock = config.shock ?? 0;
    const terminal = config.terminalRate ?? config.baseRate;
    const speed = 0.25;

    const anchors: Record<RateScenario, number> = {
      steady: config.baseRate,
      tighten: config.baseRate + 0.015,
      ease: config.baseRate - 0.015,
      highForLonger: Math.max(config.baseRate, terminal + 0.01),
      cutThenNormalize: terminal,
    };

    const target = anchors[scenario] ?? config.baseRate;
    const ramp = target + (terminal - target) * (1 - Math.exp(-speed * yearIndex));
    return ramp + shock;
  }

  const neutral = config.neutralRate ?? config.baseRate;
  const target = config.inflationTarget ?? 0.025;
  const phiPi = config.inflationWeight ?? 1.2;
  const phiY = config.outputGapWeight ?? 0.6;
  const smooth = config.smoothing ?? 0.5;

  const ruleRate = neutral + phiPi * (inflation - target) + phiY * outputGap;
  return prevRate * smooth + ruleRate * (1 - smooth);
}

export function resolveBaseRateFromHistory(opts: {
  historyBundle?: any;
  fallbackMortgageRate: number;
  mortgageSpread?: number;
}): number {
  const { historyBundle, fallbackMortgageRate, mortgageSpread = 0.02 } = opts;
  const series = historyBundle?.series as any[] | undefined;
  if (!Array.isArray(series) || series.length === 0) return fallbackMortgageRate;

  const last = series[series.length - 1] ?? {};
  const cashRate = last?.cashRate ?? last?.rbaCashRate ?? null;
  const mortgageRate = last?.mortgageRate ?? null;

  if (typeof mortgageRate === "number") return mortgageRate;
  if (typeof cashRate === "number") return cashRate + mortgageSpread;
  return fallbackMortgageRate;
}

export function rateDemandMultiplier(opts: {
  baseRate: number;
  currentRate: number;
  sensitivity?: number;
}): number {
  const { baseRate, currentRate, sensitivity = 2.0 } = opts;
  const delta = currentRate - baseRate;
  return Math.max(0.8, 1 - sensitivity * delta);
}

export type RbaResponse = {
  scenario: RateScenario;
  message: string;
  reasonTags: string[];
};

export function autoRbaResponseFromPolicy(policy: any): RbaResponse {
  const inflationary =
    0.6 * Math.max(0, policy.demandReduction ? -policy.demandReduction : 0) +
    0.4 * Math.max(0, policy.supplyBoost ? -policy.supplyBoost : 0) +
    0.6 * Math.max(0, policy.subsidies?.firstHomeBuyerSubsidyIntensity ?? 0) +
    0.4 * Math.max(0, policy.rental?.rentAssistanceIntensity ?? 0);

  const disinflationary =
    0.8 * Math.max(0, policy.demandReduction ?? 0) +
    0.7 * Math.max(0, policy.supplyBoost ?? 0) +
    0.6 * Math.max(0, policy.taxInvestor?.cgtDiscountDelta ?? 0) +
    0.6 * Math.max(0, policy.credit?.dtiCapTightness ?? 0) +
    0.6 * Math.max(0, policy.credit?.investorLendingLimitTightness ?? 0) +
    0.6 * Math.max(0, policy.credit?.serviceabilityBufferDelta ?? 0);

  const net = inflationary - disinflationary;

  if (net > 0.20) {
    return {
      scenario: "tighten",
      reasonTags: ["inflation risk", "demand pressure"],
      message:
        "Selected settings increase demand or reduce supply capacity, which can raise inflation pressure. A tightening response is more likely.",
    };
  }
  if (net > 0.05) {
    return {
      scenario: "highForLonger",
      reasonTags: ["persistent inflation risk"],
      message:
        "Net effect leans inflationary, so policy is likely to stay restrictive for longer.",
    };
  }
  if (net < -0.20) {
    return {
      scenario: "ease",
      reasonTags: ["disinflation", "demand cooling"],
      message:
        "Settings reduce demand or expand supply, likely cooling inflation pressure. An easing response is more likely.",
    };
  }
  if (net < -0.05) {
    return {
      scenario: "cutThenNormalize",
      reasonTags: ["disinflation", "stabilisation"],
      message:
        "Net effect is mildly disinflationary, so a cut followed by normalization is plausible.",
    };
  }

  return {
    scenario: "steady",
    reasonTags: ["balanced impacts"],
    message:
      "Net effects on inflation pressures are mixed, so a steady policy path is most likely.",
  };
}
