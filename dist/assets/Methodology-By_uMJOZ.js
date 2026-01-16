import{j as e}from"./index-esmbmNjg.js";import{M as l,r as c}from"./index-BKcXX29o.js";const o=`# Methodology (scenario explainer, not a forecast)

This app is a **scenario explainer**. It is designed to help users reason about **directional cause → effect** relationships in housing policy using **transparent, adjustable assumptions**.

## What we output (and what we avoid)

- We output **time series** per **City + State + National** in a single run.
- We show **indices** (e.g., year 0 = 100) and **relative changes** rather than claiming exact future prices.
- We surface **warnings** when inputs are inferred (microdata) or when policies are **running unvalidated** (calibration-first levers without history).

## Core model structure (high level)

Each year, for each city, we compute:

- **Household demand** (from population and household formation)
- **Dwelling supply** (stock evolves by completions minus demolitions)
- A **supply gap** \\((\\text{households} - \\text{stock}) / \\text{stock}\\)
- **Price and rent growth** as a function of the supply gap (via configurable curves)

Then we apply policy channels (below) that perturb **demand, rental availability, turnover, completions, and migration**. Results are aggregated into state and national views (population-weighted unless explicit weights are provided).

## Engines

- **Aggregate engine**: cities are simulated independently, then aggregated.
- **Advanced engine**: cities are coupled via **spatial equilibrium (migration reallocation)**, with optional **heterogeneous expectations** and **portfolio investor demand**.

## Inputs

### City baselines

Each included city has a baseline (\`CityBaseState\`) including (illustrative):

- population, net migration, natural growth
- dwelling stock, completions, demolitions
- median price, median annual rent
- median annual wage + wage growth rate
- mortgage rate / term
- investor dwelling share

### Policy levers (v2)

Policies are grouped by family (see \`src/model/methodology.ts\` and \`src/model/policyRegistry.ts\`).

There are **core** levers (always visible) plus **expert, calibration-first** levers (advanced controls).

## Policy levers → model channels (mapping table)

All policy families feed into a common normalized channel object (computed per city-year).

| Policy family | Lever examples | Primary channels | What it changes in the simulation |
|---|---|---|---|
| Negative gearing / ownership cap | NG mode/intensity; cap enforcement | investor demand, forced divestment, rental availability | shifts investor buy-side pressure; may reduce rental supply when rentals become owner-occupied |
| Tax & investor incentives | CGT discount; vacancy tax; short-stay regulation; foreign buyer rules | investor demand, rental availability, turnover | lowers/raises investor demand; nudges underused/short-stay stock into long-term rental; adjusts turnover proxy |
| Credit / macroprudential | serviceability buffer; DTI caps; investor lending limits | owner-occupier demand, investor demand | tightens/loosens effective borrowing capacity |
| Demand-side subsidies | first-home buyer subsidy | owner-occupier demand | modestly raises OO demand (timing/borrowing proxy) |
| Rental settings | rent assistance; rent growth cap + coverage | renter stress (micro), rent growth path | reduces renter stress; blends a nominal rent growth cap for covered rentals |
| Planning / infrastructure | upzoning; enabling infrastructure (+ lag) | completions, capacity limits | modestly raises completions and/or lifts capacity after a lag |
| Public/community housing | build program; acquisition; conversions | completions, rental pressure | adds (bounded) completions and reduces rental pressure (shape-first) |
| Population | net overseas migration shock | net migration | scales baseline migration before (advanced) spatial reallocation |

## Real-world constraints (hard bounds)

To avoid implausible jumps:

- Core sliders like **Supply boost** and **Demand reduction** are **hard-clamped** to realistic ranges.
- **Completions are capped** by year-over-year construction capacity limits (cannot double overnight).
- Turnover is bounded to plausible ranges when transaction frictions are adjusted.

The UI surfaces when levers are **at bounds** (“clamped”).

## Calibration-first framework (affordability ratios)

Many expert levers are intentionally **calibration-first**: they can run without calibration, but are meant to be estimated/validated using historical city time series.

### Targets

Primary targets:

- **Price-to-income** (median price / median annual wage)
- **Rent-to-income** (median annual rent / median annual wage)

### Current calibrator

The current calibrator (\`src/model/calibration/calibrateScenario.ts\`) fits a first-pass global parameter:

- \`marketAdjustmentSpeed\`

It reports per-city residual metrics and warns when historical coverage is incomplete. This is scaffolding for expanding calibration to additional parameters.

### How to attach history (developer workflow)

Provide \`ScenarioParams.advanced.calibration.historyByCity\` as city-year series (price/rent/wage/pop/stock). When enabled, the UI will surface calibration status and warnings.

## Historical timeline overlay (past→present→future)

The UI can optionally show a **past-to-future timeline** by attaching a historical series bundle (as close to year 2000 as available). Charts then render:

- **Historical** observations (muted)
- A vertical marker at **year0** labeled “Model starts”
- **Projected** scenario outputs (normal styling)

### Data expectations

Historical series are provided per city (preferred “truth”), with state/national derived by aggregating city histories. The bundle supports partial series and missing years, but the system will:

- align all cities to a common year range (e.g., 2000–2024)
- impute missing values conservatively and **flag** that imputation
- emit \`meta.warnings\` when coverage is weak or units look wrong

### Index base options

Charts can index the full timeline to either:

- earliest historical year (e.g., 2000 = 100), or
- baseline year (year0 = 100)

### Transparency and warnings

When historical data is missing or heavily imputed, the app surfaces warnings in the Explore view and in the Trust & transparency footer so it’s clear which parts of the timeline are observed versus inferred.

## Microdata (ABS SIH/CSHCV-derived, HILDA, synthetic reinforcement)

The model can optionally compute **tenure-specific stress rates** from microdata (instead of the decile proxy).

### Canonical micro record format

Microdata is normalized into:

- \`income\`: **gross annual household income** (AUD)
- \`tenure\`: \`"renter" | "mortgaged" | "outright" | "investor"\` (investor optional)
- \`weight?\`: optional survey weight (defaults to 1)

### Recommended export convention (ideal pipeline)

To make ABS + HILDA interchangeable, export:

- \`income_annual_aud\`
- \`tenure_code\`: \`R\`, \`M\`, \`O\` (and optionally \`I\`)
- optional \`weight\`

### Autodetect mode (messy inputs)

If \`fields\`/\`tenureMap\` are omitted, the system attempts to infer them and emits **warnings**.
It also warns when income units look implausible for **gross annual AUD** and when city coverage is incomplete.

## Placeholder distribution note

The decile view remains explicitly a **proxy** when microdata is not provided. It is intended for UI comparability and “shape-first” exploration, not distributional measurement.

## Where to edit the model

- \`src/model/methodology.ts\`: constants, curves, shared formulas
- \`src/model/policies/*\`: policy families → channel deltas
- \`src/model/runScenario.ts\`: yearly simulation + aggregation + scoping
- \`src/model/calibration/*\`: calibration scaffolding
- \`src/model/microdata/*\`: microdata normalization + validation
`;function s(a){const n=(a??"").trim();return/^javascript:/i.test(n)||/^data:/i.test(n)?"":n}function d(a,n){const i=new Blob([n],{type:"text/markdown;charset=utf-8"}),t=URL.createObjectURL(i),r=document.createElement("a");r.href=t,r.download=a,document.body.appendChild(r),r.click(),r.remove(),URL.revokeObjectURL(t)}function p(){return e.jsxs("div",{children:[e.jsx("div",{className:"h1",children:"Methodology"}),e.jsxs("p",{className:"muted",style:{marginTop:0},children:["Plain-English summary of assumptions and limitations. All calculations are client-side and visible in code.",e.jsx("span",{style:{display:"block",marginTop:6},children:"This model is a free tool developed by the not-for-profit consumer advocacy and research team at SOCii."})]}),e.jsx("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12},children:e.jsx("button",{type:"button",onClick:()=>d("housing-reform-model-methodology.md",o),style:{padding:"10px 12px",borderRadius:12,border:"1px solid var(--border)",background:"white",cursor:"pointer",fontWeight:650},children:"Download methodology summary"})}),e.jsx("div",{className:"card",style:{padding:16},children:e.jsx(l,{remarkPlugins:[c],skipHtml:!0,components:{a:({node:a,href:n,...i})=>{const t=s(n??"");return e.jsx("a",{...i,href:t,target:"_blank",rel:"noopener noreferrer"})},img:({src:a,alt:n,...i})=>{const t=s(a??"");return e.jsx("img",{...i,src:t,alt:n??"",loading:"lazy",decoding:"async"})}},children:o})})]})}export{p as Methodology};
//# sourceMappingURL=Methodology-By_uMJOZ.js.map
