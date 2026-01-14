/**
 * Centralized helper text and tooltips for the Housing Reform Impact Explorer.
 * 
 * All explanatory content in one place for consistency and easier maintenance.
 */

export const HELP = {
  // === SCENARIO PRESETS ===
  presets: {
    title: "Scenario preset",
    tooltip: "Pre-configured policy combinations. Choose one to auto-fill all levers, or customize manually.",
    descriptions: {
      baseline: "Business as usual — no policy changes. Shows how current trends compound over time.",
      "ng-remove": "Phase out negative gearing for new purchases over 5 years. Existing arrangements grandfathered.",
      "ng-remove-fast": "Immediate removal of negative gearing — no phase-in period. More disruptive but faster effect.",
      "ng-restore": "Model the effect of restoring negative gearing if it were previously removed.",
      "ownership-cap": "Limit individuals to 1 principal residence + 1 investment property. Forces divestment of excess.",
      "ownership-cap-aggressive": "Same ownership cap with faster enforcement and shorter transition period.",
      "ng-remove-plus-cap": "Combined reform: phase out negative gearing AND enforce ownership cap simultaneously.",
      "supply-boost": "Increase housing completions by 20% through planning reforms, faster approvals, and infrastructure.",
      "supply-boost-plus-ng": "Combined supply-side and demand-side reform: more construction + reduced investor demand.",
      comprehensive: "Full reform package: supply boost, negative gearing removal, ownership cap, and stamp duty reduction.",
      "land-tax-transition": "Shift from stamp duty toward land tax (proxy): increases turnover and reduces transaction friction in the model.",
      "macroprudential-tightening": "Tighten credit conditions: serviceability buffer + DTI caps + investor lending limits (proxy).",
      "short-stay-clampdown": "Regulate short-stay and underutilised dwellings to shift a bounded share into long-term rentals (proxy).",
      "public-housing-build": "Public/community build program: adds completions (bounded) and reduces rental pressure (proxy).",
      "migration-shock-down": "Lower net overseas migration (proxy shock) to reduce demand pressure.",
      "all-levers": "Stress test: combine core reforms with calibration-first levers (bounded, directional).",
      custom: "Manually configured — adjust individual levers below to create your own scenario.",
    },
  },

  // === GEOGRAPHIC SCOPE ===
  scope: {
    title: "Geographic scope",
    tooltip: "View aggregated national results, state-level data, or individual city outcomes.",
    description: "Results are weighted by population. National = all included cities aggregated. State = cities within that state. City = single city view.",
    emptyState: "If a city shows no data, it wasn't included in the simulation. Enable 'Include all major cities' for full coverage.",
  },

  // === CITY COVERAGE ===
  coverage: {
    title: "City coverage",
    tooltip: "Choose between capitals-only or all major cities (including regional centres) for broader analysis.",
    capitals: "Capitals-only: Sydney, Melbourne, Brisbane, Perth, Adelaide, Hobart, Darwin, Canberra.",
    allMajor: "All major cities: capitals + regional hubs (e.g., Newcastle, Gold Coast, Geelong, Sunshine Coast, and more).",
    impact: "More cities = more comprehensive national picture but slightly longer computation.",
  },

  // === SIMULATION HORIZON ===
  horizon: {
    title: "Simulation horizon",
    tooltip: "How many years into the future to simulate. Longer horizons compound policy effects but increase uncertainty.",
    shortTerm: "5-10 years: Shows immediate policy impacts. More reliable as predictions.",
    mediumTerm: "10-20 years: Standard analysis window. Captures compound effects.",
    longTerm: "20-30 years: Shows long-run equilibrium. High uncertainty — treat as directional only.",
  },

  // === NEGATIVE GEARING ===
  negativeGearing: {
    title: "Negative gearing policy",
    tooltip: "Tax treatment of investment property losses. Currently, losses can be deducted from other income.",
    modes: {
      none: "No change — maintain current negative gearing tax benefits.",
      remove: "Phase out negative gearing for new purchases. Existing arrangements typically grandfathered.",
      reverse: "Restore negative gearing if it were previously removed. Models a policy reversal scenario.",
    },
    intensity: {
      title: "Policy intensity",
      tooltip: "How strongly the policy applies. 100% = full effect. Lower values model partial implementation.",
      description: "50% intensity might represent: partial grandfathering, exemptions for new builds, or regional variation.",
    },
    effects: {
      remove: "Reduces after-tax returns for investors → decreased investor demand → potential price moderation. May temporarily reduce rental supply as investors exit.",
      restore: "Increases after-tax returns for investors → increased investor demand → potential price pressure.",
    },
  },

  // === OWNERSHIP CAP ===
  ownershipCap: {
    title: "Ownership cap (1 PPOR + 1 IP)",
    tooltip: "Limit individuals to 1 principal place of residence + 1 investment property. Excess holdings must be divested.",
    mechanism: "Enforcement triggers forced sales of properties exceeding the cap. Creates supply surge as multi-property investors reduce holdings.",
    enforcement: {
      title: "Enforcement level",
      tooltip: "How strictly the cap is enforced. Higher = more compliance, more divestment.",
      description: "100% = full enforcement on all properties. Lower values model partial compliance, delayed implementation, or exemptions.",
    },
    excessStock: {
      title: "Excess investor stock",
      tooltip: "Proxy for what share of investor-held dwellings exceed the cap and would need divestment.",
      description: "Based on ATO estimates of multi-property investors. Higher values = more properties need to be sold.",
    },
    phased: {
      title: "Phased divestment",
      tooltip: "If enabled, divestment happens gradually. If disabled, immediate forced sales (more disruptive).",
      description: "Phased approach reduces market shock but delays full policy effect.",
    },
    effects: "Ownership cap reduces investor stock, increases owner-occupier purchases, but may create short-term rental supply shock as properties leave rental market.",
  },

  // === POLICY RAMP ===
  ramp: {
    title: "Policy ramp period",
    tooltip: "Years to phase in policy changes. Longer ramp = gentler market transition.",
    immediate: "0 years: Immediate full implementation. Maximum market impact, highest disruption risk.",
    gradual: "3-5 years: Gradual phase-in. Allows market adjustment, reduces shock.",
    extended: "7-10 years: Extended transition. Minimal disruption but delayed benefits.",
  },

  // === SUPPLY BOOST ===
  supplyBoost: {
    title: "Supply boost",
    tooltip:
      "Extra completions enabled by planning/approval reform and build capacity. Capped to realistic ranges and construction limits (you can’t double building overnight).",
    mechanism: "Models faster approvals, rezoning, build-to-rent incentives, public housing construction, etc.",
    examples: {
      modest: "+5%: Incremental approvals / infill unlocks.",
      significant: "+10–15%: Coordinated planning + infrastructure + pipeline smoothing.",
      aggressive: "+20–25%: Very ambitious; requires sustained workforce/material expansion.",
    },
    limitations:
      "Constrained by construction capacity. The model applies year‑to‑year caps on completion growth/decline to avoid implausible jumps.",
  },

  // === DEMAND REDUCTION ===
  demandReduction: {
    title: "Demand reduction",
    tooltip:
      "Generic demand-side effects not captured elsewhere (e.g., vacancy tax, tighter credit, foreign buyer rules). Kept to realistic ranges; large reductions are hard to achieve without major macro changes.",
    examples:
      "Vacancy taxes, macro‑prudential credit tightening, foreign buyer restrictions, removal of targeted demand subsidies.",
    limitations:
      "Catch‑all lever. Represents a net reduction in effective household demand, not a guaranteed drop in population.",
  },

  // === EXPERT / CALIBRATION-FIRST LEVERS ===
  expert: {
    cgtDiscountDelta: {
      tooltip:
        "Change to the capital gains tax discount applied to investment property. Negative values reduce after-tax investor returns (lower investor demand), positive values increase them. Calibration-first.",
    },
    landTaxShift: {
      tooltip:
        "Transition from stamp duty (transaction tax) toward land tax (holding tax). In this model it increases turnover and reduces stamp duty rate used in the revenue proxy. Calibration-first.",
    },
    vacancyTaxIntensity: {
      tooltip:
        "Vacancy/under-utilisation policy intensity. Higher values push a small share of underused dwellings back into long-term rental supply. Calibration-first.",
    },
    shortStayRegulationIntensity: {
      tooltip:
        "Short-stay (e.g., Airbnb) regulation intensity. Higher values shifts a bounded share of short-stay stock into the long-term rental pool. Calibration-first.",
    },
    foreignBuyerRestrictionIntensity: {
      tooltip:
        "Foreign buyer restriction intensity. Higher values reduces a modest share of investor demand. Calibration-first.",
    },
    serviceabilityBufferDelta: {
      tooltip:
        "Change in serviceability buffer used by lenders/regulators. Higher buffers tighten borrowing capacity (reduces owner-occupier demand more than they change mortgage rates). Calibration-first.",
    },
    dtiCapTightness: {
      tooltip:
        "Debt-to-income cap tightness. Higher values represent stricter limits on leverage, reducing effective demand. Calibration-first.",
    },
    investorLendingLimitTightness: {
      tooltip:
        "Investor lending limits (flow caps) tightness. Higher values reduces investor credit availability and investor demand. Calibration-first.",
    },
    firstHomeBuyerSubsidyIntensity: {
      tooltip:
        "First-home buyer subsidy intensity. In this model it modestly increases owner-occupier demand (timing/borrowing effects). Calibration-first.",
    },
    rentAssistanceIntensity: {
      tooltip:
        "Rent assistance expansion intensity. Modeled primarily as renter stress relief (effective rent burden reduction), not as a pure market rent cap. Calibration-first.",
    },
    rentRegulationCap: {
      tooltip:
        "Nominal rent growth cap applied to covered rentals. The model blends capped and uncapped segments using the coverage share. Calibration-first.",
    },
    rentRegulationCoverage: {
      tooltip:
        "Share of the rental market covered by regulation. Higher coverage means more of the market is subject to the rent growth cap. Calibration-first.",
    },
    upzoningIntensity: {
      tooltip:
        "Upzoning/planning reform intensity. Increases feasible completions modestly, still subject to construction capacity constraints. Calibration-first.",
    },
    infrastructureEnablement: {
      tooltip:
        "Enabling infrastructure intensity. After a lag, lifts construction capacity and slightly raises completions. Calibration-first.",
    },
    infrastructureLagYears: {
      tooltip:
        "Lag before infrastructure investments translate into increased housing delivery capacity.",
    },
    publicHousingBuildBoost: {
      tooltip:
        "Public/community housing build program intensity. Adds completions (bounded) and slightly reduces rental pressure as households are housed outside the private market. Calibration-first.",
    },
    publicHousingAcquisitionSharePerYear: {
      tooltip:
        "Acquisition of existing stock into public/community housing per year (share of stock). Modeled as rental-market pressure relief (shape-first). Calibration-first.",
    },
    conversionToSocialSharePerYear: {
      tooltip:
        "Conversion of private rental stock into social/community housing per year (share of stock). Calibration-first.",
    },
    netOverseasMigrationShock: {
      tooltip:
        "Shock to national net overseas migration levels. Negative values reduce population growth pressure; positive values increase it. Calibration-first.",
    },
  },

  // === CHARTS ===
  charts: {
    priceIndex: {
      title: "Price trajectory",
      description: "Indexed to year 0 = 100. A value of 200 means prices doubled from starting point.",
      interpretation: "Steeper curves = faster price growth. Compare scenarios to see policy impact on trajectory.",
      limitations: "Nominal prices — not inflation-adjusted. Real growth is lower. Does not capture within-city variation.",
    },
    rentIndex: {
      title: "Rent trajectory",
      description: "Indexed to year 0 = 100. Shows evolution of annual rent relative to starting point.",
      interpretation: "Rent often lags price changes. Policy that reduces investor supply may increase rents short-term.",
      limitations: "Median rent hides distribution. Outer suburbs, different dwelling types vary significantly.",
    },
    stockDemand: {
      title: "Housing stock vs demand",
      description: "Compares total dwelling stock (supply) to estimated household demand.",
      interpretation: "Gap between lines = supply-demand imbalance. Larger gap = more price pressure.",
      mechanism: "Stock grows via completions minus demolitions. Demand grows with population and household formation.",
      limitations: "Household formation rates assumed constant. Doesn't model changes in average household size.",
    },
  },

  // === SUMMARY METRICS ===
  summary: {
    priceChange: {
      title: "Median price change",
      description: "Total price change from simulation start to end. Nominal (not inflation-adjusted).",
      interpretation: "Compare across scenarios to see relative policy impact. Lower is generally better for affordability.",
    },
    rentChange: {
      title: "Median rent change",
      description: "Total annual rent change from simulation start to end.",
      interpretation: "Rent changes affect renters immediately. Lower rent growth improves affordability for renters.",
    },
    newDwellings: {
      title: "Net new dwellings",
      description: "Total dwelling stock increase over simulation period (completions minus demolitions).",
      interpretation: "More dwellings = more housing supply. Compare to population growth to assess adequacy.",
    },
    housingCostIndex: {
      title: "Housing cost index",
      description: "Composite measure: weighted combination of price and rent changes relative to wage growth.",
      interpretation: "Higher = worse affordability. Combines owner and renter perspectives into single metric.",
    },
  },

  // === DECILE ANALYSIS ===
  deciles: {
    title: "Housing stress by income decile",
    description: "Shows rent and mortgage costs as a share of income for each income decile. Stress threshold is 30%.",
    methodology: "Synthetic income distribution based on ABS data patterns. Each decile faces the same median rent/price (simplification).",
    limitations: [
      "Proxy estimate, not measured data.",
      "Same median costs for all deciles ignores dwelling quality differences.",
      "Doesn't account for dual-income households or regional income variation.",
      "Renter/owner split by decile not modeled.",
    ],
    stressDefinition: "Housing stress = spending more than 30% of gross income on housing costs. Internationally recognized benchmark.",
  },

  // === POLICY CHANNELS ===
  policyChannels: {
    title: "Policy channel effects",
    description: "Shows how policy settings translate into market effects.",
    investorDemand: {
      title: "Investor demand multiplier",
      description: "Effect on investor purchasing activity. <1 = reduced demand, >1 = increased demand.",
      mechanism: "Combines negative gearing and ownership cap effects on investor behavior.",
    },
    divestment: {
      title: "Forced divestment share",
      description: "Share of dwelling stock being divested due to ownership cap enforcement.",
      mechanism: "Excess investor holdings sold to comply with cap. Creates supply surge for purchasers.",
    },
    rentalShock: {
      title: "Rental supply shock",
      description: "Short-term rental supply impact from investor divestment.",
      mechanism: "Some divested properties leave rental market (bought by owner-occupiers), reducing rental supply.",
    },
  },

  // === TRANSPARENCY ===
  transparency: {
    assumptions: {
      title: "Core assumptions",
      items: [
        "Supply-demand gap drives price/rent growth with market adjustment damping",
        "Policy effects ramp in over the specified period",
        "Population and migration follow baseline ABS projections",
        "Construction responds to expected price growth (with lag)",
        "Investor behavior responds rationally to policy incentives",
      ],
    },
    cannotPredict: {
      title: "What this model cannot predict",
      items: [
        "Interest rate paths and RBA policy responses",
        "Regional variation within cities (suburb-level)",
        "Construction supply constraints and planning delays",
        "Short-term market volatility or speculative behavior",
        "Exact investor behavioral responses to policy changes",
        "Political and legal implementation challenges",
        "Global economic shocks or pandemic-like disruptions",
      ],
    },
    uncertainties: {
      title: "Key uncertainties that could change outcomes",
      items: [
        "Construction capacity and planning approval speeds",
        "Migration policy and population growth variations",
        "Credit policy, banking regulations, and LVR requirements",
        "Actual distribution of investor property holdings",
        "Rental market responses to reduced investor supply",
        "Compliance timing and enforcement mechanisms",
        "Interest rate movements and monetary policy",
      ],
    },
  },
} as const;

/**
 * InfoTooltip component for consistent help indicators
 */
export function InfoTooltip({
  text,
  placement = "right",
}: {
  text: string;
  placement?: "right" | "bottom";
}) {
  return (
    <abbr
      title={text}
      style={{
        textDecoration: "none",
        borderBottom: "1px dotted var(--border)",
        cursor: "help",
        color: "var(--muted)",
        marginLeft: placement === "right" ? 6 : 0,
      }}
    >
      ?
    </abbr>
  );
}

/**
 * Expandable help section for detailed explanations
 */
export function HelpExpander({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details style={{ marginTop: 10 }} open={defaultOpen}>
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 650,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 12 }}>▸</span>
        {summary}
      </summary>
      <div className="muted" style={{ marginTop: 6, paddingLeft: 18 }}>
        {children}
      </div>
    </details>
  );
}

/**
 * Limitations callout for transparent uncertainty communication
 */
export function LimitationsBox({ items }: { items: readonly string[] }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        background: "#fef3c7",
        borderRadius: 8,
        border: "1px solid #f59e0b",
      }}
    >
      <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 6 }}>
        ⚠️ Limitations
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {items.map((item, i) => (
          <li key={i} className="muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Policy effect indicator chip
 */
export function EffectChip({
  effect,
  direction,
}: {
  effect: string;
  direction: "positive" | "negative" | "neutral";
}) {
  const colors = {
    positive: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
    negative: { bg: "#fef2f2", border: "#ef4444", text: "#b91c1c" },
    neutral: { bg: "#f9fafb", border: "#9ca3af", text: "#4b5563" },
  };
  const c = colors[direction];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.text,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {effect}
    </span>
  );
}
