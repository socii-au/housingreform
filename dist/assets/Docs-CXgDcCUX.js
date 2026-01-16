import{j as e}from"./index-esmbmNjg.js";import{M as c,r as l}from"./index-BKcXX29o.js";const r=`# Housing Reform Model Documentation

## 1. Introduction

**One‑paragraph summary.** This model is a scenario explorer that simulates how housing policies might affect prices, rents, supply, and affordability across Australian regions. It translates policy levers into changes in demand, supply, and market dynamics, then projects outcomes over time for cities, states, and the nation. It is designed for clarity and transparency, not for predicting exact prices.

**What it does.** It shows relative trajectories and trade‑offs under different policy combinations, with consistent inputs and assumptions that are visible in the code.

**What it does not do.** It does not forecast exact market prices, does not simulate individual households, and does not claim causal proof. It does not replace expert assessment, local planning constraints, or regulatory impact analysis.

**Who it is for.** Policymakers, journalists, community advocates, and analysts who need a clear, rigorous, and explainable framework to compare policy scenarios.

**Why clarity and accuracy matter.** Housing reform debates are complex and politically sensitive. This documentation is written to make every assumption explicit, every calculation explainable, and every limitation visible.

**How to use this documentation.** Start with the Glossary, then read the Model Architecture for the big picture, and use the Math & Stats section for step‑by‑step formulas. Each section links back to glossary terms for consistency.

---

## 2. Glossary
The glossary uses a single table with clear row separators and high‑contrast color bands.

| Term | Plain English | Formal Definition | Why It Matters |
|------|---------------|------------------|----------------|
| **Baseline year (Year 0)** | The starting year for the model | First year in the simulation timeline | All growth is measured from this point |
| **City baseline** | The starting state of a city | Initial values for population, stock, prices, rents, wages | Anchors the model to reality |
| **Population** | People living in a region | Total residents in the baseline year | Drives demand for housing |
| **Population growth rate** | How fast population grows | Annual % change in population | A primary driver of demand |
| **Net migration** | People moving in minus out | Net overseas + net interstate migration | Can shift demand quickly |
| **Dwelling stock** | Total homes in a region | Number of occupied + unoccupied dwellings | Determines available supply |
| **New construction** | Homes built each year | Additions to dwelling stock | Increases supply |
| **Net supply** | New construction minus removals | Annual change in dwelling stock | Determines availability |
| **Construction capacity** | The maximum build rate | Upper bound on annual construction | Limits supply response |
| **Vacancy rate** | Share of empty dwellings | Vacant dwellings ÷ total dwellings | Affects rent pressure |
| **Rental stock** | Homes available to rent | Total rentable dwellings | Impacts rents directly |
| **Median price** | Typical home price | Median sales price in a year | Key affordability metric |
| **Median rent** | Typical annual rent | Median annual rental cost | Key affordability metric |
| **Median wage** | Typical annual wage | Median annual wage in a region | Benchmark for affordability |
| **Price‑to‑income ratio** | Price relative to incomes | Median price ÷ median wage | High ratio = low affordability |
| **Rent‑to‑income ratio** | Rent burden | Median annual rent ÷ median wage | High ratio = rental stress |
| **Affordability index** | Composite pressure | A function of price‑to‑income and rent burden | Summarizes housing stress |
| **Demand** | Desire/ability to buy | Buyers’ willingness to purchase | Drives price pressure |
| **Investor demand** | Demand from investors | Share of demand from investors | Sensitive to tax and credit policy |
| **Owner‑occupier demand** | Demand from residents | Non‑investor purchase demand | Stabilizes prices |
| **Elasticity** | Responsiveness | % change in outcome per % change in driver | Explains sensitivity |
| **Supply elasticity** | Build response | % change in construction per % change in prices | Determines how quickly supply grows |
| **Price elasticity of demand** | Buyer sensitivity | % change in demand per % change in prices | Determines how demand adjusts |
| **Construction lag** | Build delay | Years from approval to completion | Affects timing of supply |
| **Planning constraint** | Limits on development | Zoning, height, or density restrictions | Can cap supply response |
| **Negative gearing** | Tax deduction on losses | Ability to deduct investment losses against income | Influences investor demand |
| **CGT discount** | Capital gains tax discount | Reduced tax on capital gains | Encourages investment demand |
| **Ownership cap** | Limit on properties owned | Max 1 primary + 1 investment | Forces divestment |
| **Divestment flow** | Forced sales | Portion of excess investor stock sold | Creates listings |
| **Land tax shift** | Tax mix reform | Move from stamp duty to land tax | Changes transaction incentives |
| **Vacancy tax** | Tax on empty homes | Annual tax on unoccupied dwellings | Encourages occupancy |
| **Short‑stay regulation** | Limits on short‑term rentals | Caps or taxes short‑stay stock | Returns homes to rental stock |
| **Foreign buyer restriction** | Limits on foreign purchases | Policy limiting non‑resident purchases | Affects demand |
| **Credit policy** | Lending rules | Serviceability buffer, DTI caps | Alters borrowing capacity |
| **Serviceability buffer** | Interest rate buffer | Extra rate used in loan tests | Tightens credit |
| **Debt‑to‑income cap** | DTI limit | Max debt relative to income | Restricts leverage |
| **Investor lending limit** | Lending quota | Share of loans to investors | Damps investor demand |
| **Rent regulation** | Rent caps | Limits annual rent increase | Reduces rent growth |
| **Rent assistance** | Rent support | Payments to renters | Reduces stress but may raise demand |
| **Upzoning intensity** | Planning liberalisation | Increase in allowable density | Boosts supply potential |
| **Infrastructure enablement** | Services to unlock development | Transit, utilities, schools | Enables higher density |
| **Ramp‑up years** | Policy phase‑in | Years to reach full effect | Avoids abrupt shocks |
| **Policy intensity** | Strength of a policy | 0‑1 scale for effect magnitude | Controls effect size |
| **Scenario preset** | Named policy bundle | Predefined set of levers | Reproducible comparisons |
| **Baseline scenario** | No policy change | All policy levers off | Reference path |
| **Crisis score** | Stress indicator | Composite of price/rent burden | Used in heatmap |
| **Decile proxy (placeholder)** | Distribution proxy | Simplified distribution model | Flags equity impacts (approximate) |
| **History bundle** | Past data series | Observed data from ~2000 to baseline | Grounds projections |
| **Synthetic series** | Imputed data | Modeled values where data is missing | Fills gaps transparently |
| **Regional scope** | Geography selection | National / State / City / SA2/3/4 | Enables filtering |

---

## 3. Model Architecture

**Block diagram (simplified).**

\`\`\`
Inputs (city baselines, policies, history)
        ↓
Core dynamics (demand, supply, construction, prices, rents)
        ↓
Regional aggregation (city → state → national)
        ↓
Outputs (time series, summaries, charts, heatmap)
\`\`\`

**Plain‑English flow.**
1. Start with baseline values for each city.
2. Apply policy levers to adjust demand, supply, and investor behavior.
3. Simulate yearly changes in population, housing stock, prices, and rents.
4. Aggregate city results into state and national views.
5. Display outputs in charts, tables, and the heatmap.

**Modules and responsibilities.**
- **Inputs layer:** baseline data, policy levers, and history.
- **Core simulation:** supply, demand, construction response, and price/rent changes.
- **Distribution layer:** decile proxy or microdata‑based stress metrics (if available).
- **Aggregation layer:** city → state → national outputs.
- **Presentation layer:** charts, map, and summary cards.

---

## 4. Math & Stats

### 4.1 Price and Rent Growth
- **What it is:** A growth‑rate model linking supply‑demand gaps to price and rent changes.
- **Where it’s used:** Core simulation each year.
- **How it works (step‑by‑step):**
  1. Compute supply gap = (demand − effective supply) ÷ supply.
  2. Map gap to price growth via a curve (elasticity).
  3. Map gap to rent growth via a separate curve.
  4. Apply dampening or caps (e.g., rent regulation).
- **Worked example:**
  - Demand = 102,000 dwellings
  - Effective supply = 100,000 dwellings
  - Gap = (102,000 − 100,000) / 100,000 = 0.02 (2%)
  - If elasticity = 1.5, price growth ≈ 3% (2% × 1.5)
- **Assumptions:** Elasticities remain stable over the simulation.

### 4.2 Construction Response
- **What it is:** New construction responds to price signals and planning capacity.
- **Where it’s used:** Supply evolution per year.
- **How it works:**
  1. Compute desired build rate based on price growth.
  2. Apply construction capacity cap.
  3. Apply planning/infrastructure lag and ramp‑up.
- **Worked example:**
  - Desired growth = 4%
  - Capacity cap = 2%
  - Actual growth = 2%
- **Assumptions:** Capacity limits are binding and realistic.

### 4.3 Investor Demand Adjustment
- **What it is:** Investor demand is reduced by taxes, credit policy, and ownership caps.
- **Where it’s used:** Demand split between investor and owner‑occupier.
- **How it works:**
  1. Compute baseline investor share.
  2. Apply reductions from negative gearing removal, CGT changes, credit tightening.
  3. Apply ownership cap divestment flow if enabled.
- **Worked example:**
  - Baseline investor share: 35%
  - Policy reduction: −10%
  - New investor share: 31.5%
- **Assumptions:** Policy effects are additive within bounds.

### 4.4 Affordability Metrics
- **What it is:** Price‑to‑income and rent‑to‑income ratios.
- **Where it’s used:** Summaries, crisis score, and narrative.
- **How it works:**
  - Price‑to‑income = median price ÷ median wage
  - Rent‑to‑income = median annual rent ÷ median wage
- **Assumptions:** Median wage is representative of household income.

---

## 5. Policy Mechanisms

Each policy is modeled as a **mechanism** that affects either demand, supply, or rental stock. The section below explains each policy in plain language and how it maps into the model.

### Negative gearing changes
**Definition:** Tax treatment of rental losses.  
**Rationale:** Reduces investor tax advantage or reverses a prior change.  
**Mechanism:** Lowers investor demand proportionally to policy intensity.  
**Evidence (summary):** Empirical estimates vary; model uses a conservative demand‑reduction range.  
**Common misunderstanding:** Removing negative gearing does not automatically cut prices by a fixed %.

### Ownership cap
**Definition:** Limit to 1 principal + 1 investment property per individual.  
**Rationale:** Reduces concentration of housing ownership.  
**Mechanism:** Applies a divestment flow from excess investor stock, increasing listings.  
**Evidence (summary):** Few direct precedents; modeled as a bounded, phased adjustment.  
**Misunderstanding:** It does not instantly create free stock; divestment is phased.

### Planning and rezoning (upzoning)
**Definition:** Increase allowable density and remove planning friction.  
**Rationale:** Enables more supply in high‑demand areas.  
**Mechanism:** Raises construction capacity and reduces effective lag.  
**Evidence (summary):** Zoning changes are associated with higher approvals but vary by city.

### Public and community housing expansion
**Definition:** Direct government build or acquisition.  
**Rationale:** Increases non‑market housing and reduces rental stress.  
**Mechanism:** Adds to dwelling stock and reduces market demand pressure.  
**Evidence (summary):** Well‑documented supply effect, with timing lag.

### Credit tightening
**Definition:** Serviceability buffers, DTI caps, investor lending limits.  
**Rationale:** Reduce leverage and speculative demand.  
**Mechanism:** Reduces investor and high‑risk borrower demand.  
**Evidence (summary):** Macroprudential policies reduce credit growth.

### Rent regulation / caps
**Definition:** Limits on rent increases.  
**Rationale:** Protects renters from rapid increases.  
**Mechanism:** Caps rent growth while allowing vacancy decontrol if enabled.  
**Evidence (summary):** Effects depend on coverage and enforcement.

### Vacancy tax & short‑stay regulation
**Definition:** Taxes or restrictions on empty or short‑stay dwellings.  
**Rationale:** Return homes to long‑term rental supply.  
**Mechanism:** Increases rental stock and lowers rent pressure.  
**Evidence (summary):** Local evidence suggests modest rental stock returns.

---

## 6. Assumptions & Justification

| Assumption | Value Used | Source | Confidence | Sensitivity |
|-----------|-----------|--------|-----------|-------------|
| Supply elasticity | Tunable range | Literature‑informed proxy | Medium | High |
| Demand elasticity | Tunable range | Literature‑informed proxy | Medium | High |
| Construction capacity | City baseline + policy boost | Planning benchmarks | Medium | High |
| Population growth | City baseline + shocks | ABS / historical trend | Medium | Medium |
| Wage growth | City baseline projection | Historical trend | Medium | Medium |
| Investor share | Baseline estimate | Historical proxy | Low‑Medium | High |
| Rent regulation effect | Capped growth | Policy design | Low | Medium |

**Notes:**
- Values are designed to be transparent and adjustable.
- Confidence reflects data availability, not certainty of outcomes.
- Sensitivity indicates how strongly outputs change if assumption shifts.

---

## 7. Validation & Accuracy

**Historical backtesting.** The model aligns the historical series (where available) with observed data from ~2000 to the baseline year and compares projected paths to known trends.

**Residual error.** When backtesting, the model tracks the gap between predicted and observed values; large residuals signal the need for parameter adjustment.

**Sensitivity analysis.** Key sensitivities include:
- Supply elasticity
- Investor demand elasticity
- Construction capacity
- Migration assumptions

**Scenario testing.**
- Best‑case: High supply response + moderate demand.
- Worst‑case: Low supply response + high demand.
- Median: Balanced adjustments with conservative effects.

**Uncertainty.**
- Results are not deterministic predictions.
- Confidence bands are conceptual, not probabilistic.
- Exact outcomes depend on real‑world implementation and timing.

---

## 8. Usage Guide

**Step‑by‑step workflow.**
1. Choose a scope (National / State / City / SA2/3/4 if enabled).
2. Select a scenario preset (or combine presets).
3. Adjust policy levers (intensity, ramp‑up, and timing).
4. Review charts and heatmap for trade‑offs.
5. Compare against baseline to interpret impact.

**Sample input.**
- Negative gearing removal: 0.6
- Ownership cap enforcement: 0.4
- Supply boost: 0.3
- Ramp‑up years: 5

**Expected outputs (narrative example).**
You should see lower investor demand, modest price growth reduction, and gradual supply uplift. The affordability index should improve relative to baseline but remain sensitive to population growth.

---

## 9. Technical Appendix

**Pseudo‑code of core loop (simplified).**
\`\`\`
for year in years:
  demand = baseDemand * demandModifiers(policy, credit, migration)
  supply = prevSupply + constructionResponse(prices, capacity, lag)
  priceGrowth = priceCurve(demand, supply)
  rentGrowth = rentCurve(demand, rentalStock)
  update metrics (prices, rents, wages)
\`\`\`

**Data schema (summary).**
- City baseline: population, dwellingStock, medianPrice, medianAnnualRent, medianAnnualWage
- Policy levers: supplyBoost, demandReduction, taxInvestor, credit, rental, planning, publicCommunity
- Outputs: year series, summary stats, crisis score

**Citations.**
This draft includes placeholders for literature citations. Add links for:
- Elasticity estimates
- Macroprudential impact studies
- Rent control evidence
- Zoning and supply effects

---

## References

Australian Bureau of Statistics (ABS) (2024) *Consumer Price Index, Australia*. ABS. Available at: https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia (Accessed: 15 January 2026).

Australian Bureau of Statistics (ABS) (2023) *Average Weekly Earnings, Australia*. ABS. Available at: https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/average-weekly-earnings-australia (Accessed: 15 January 2026).

Australian Bureau of Statistics (ABS) (2021) *Census of Population and Housing*. ABS. Available at: https://www.abs.gov.au/census (Accessed: 15 January 2026).

Australian Bureau of Statistics (ABS) (2021) *Australian Statistical Geography Standard (ASGS) Edition 3*. ABS. Available at: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3 (Accessed: 15 January 2026).

Australian Bureau of Statistics (ABS) (2024) *Residential Property Price Indexes: Eight Capital Cities*. ABS. Available at: https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities (Accessed: 15 January 2026).

Australian Prudential Regulation Authority (APRA) (2024) *Monthly Authorised Deposit-taking Institution Statistics*. APRA. Available at: https://www.apra.gov.au/monthly-authorised-deposit-taking-institution-statistics (Accessed: 15 January 2026).

Reserve Bank of Australia (RBA) (2024) *Statement on Monetary Policy*. RBA. Available at: https://www.rba.gov.au/publications/smp/ (Accessed: 15 January 2026).

Reserve Bank of Australia (RBA) (2024) *Interest Rate Statistics*. RBA. Available at: https://www.rba.gov.au/statistics/interest-rates/ (Accessed: 15 January 2026).

Reserve Bank of Australia (RBA) (2024) *Household Finance*. RBA. Available at: https://www.rba.gov.au/publications/bulletin/ (Accessed: 15 January 2026).

CoreLogic (2024) *Housing Market Indices and Insights*. CoreLogic. Available at: https://www.corelogic.com.au/ (Accessed: 15 January 2026).

Domain Group (2024) *House Price Reports*. Domain. Available at: https://www.domain.com.au/research/ (Accessed: 15 January 2026).

SQM Research (2024) *Weekly Rents and Vacancy Rates*. SQM Research. Available at: https://sqmresearch.com.au/ (Accessed: 15 January 2026).

Department of Treasury (Australia) (2023) *Housing Affordability – Key Policy Settings*. Treasury. Available at: https://treasury.gov.au/ (Accessed: 15 January 2026).

---

## Final Validation Checklist

- [ ] Every input defined  
- [ ] Every output explained  
- [ ] Each formula has a worked example  
- [ ] Assumptions transparent  
- [ ] Limitations clearly stated  

If any box is unchecked, do not publish yet.
`;function o(t){const n=(t??"").trim();return/^javascript:/i.test(n)||/^data:/i.test(n)?"":n}function d(t,n){const a=new Blob([n],{type:"text/markdown;charset=utf-8"}),s=URL.createObjectURL(a),i=document.createElement("a");i.href=s,i.download=t,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(s)}function m(){return e.jsxs("div",{children:[e.jsx("div",{className:"h1",children:"Docs"}),e.jsxs("p",{className:"muted",style:{marginTop:0},children:["Full documentation of the model: terms, math, policies, assumptions, and validation.",e.jsx("span",{style:{display:"block",marginTop:6},children:"This model is a free tool developed by the not-for-profit consumer advocacy and research team at SOCii."})]}),e.jsx("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12},children:e.jsx("button",{type:"button",onClick:()=>d("housing-reform-model-docs.md",r),style:{padding:"10px 12px",borderRadius:12,border:"1px solid var(--border)",background:"white",cursor:"pointer",fontWeight:650},children:"Download docs"})}),e.jsx("div",{className:"card docs-content",style:{padding:16},children:e.jsx(c,{remarkPlugins:[l],skipHtml:!0,components:{a:({href:t,...n})=>{const a=o(t??"");return e.jsx("a",{...n,href:a,target:"_blank",rel:"noopener noreferrer"})},img:({src:t,alt:n,...a})=>{const s=o(t??"");return e.jsx("img",{...a,src:s,alt:n??"",loading:"lazy",decoding:"async"})}},children:r})})]})}export{m as Docs};
//# sourceMappingURL=Docs-CXgDcCUX.js.map
