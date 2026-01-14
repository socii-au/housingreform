/**
 * WageVsHousingChart
 *
 * Compares wage growth against housing price and rent growth over time.
 * All values are indexed to year 0 = 100 for direct comparison.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { TimelinePoint } from "../../model/history/types";
import { HelpExpander, LimitationsBox } from "../shared/HelpText";

interface Props {
  years: TimelinePoint[];
  scopeLabel: string;
  cutoverYear?: number;
  onHoverYear?: (year: number | null) => void;
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { maximumFractionDigits: 0 });
}

export default function WageVsHousingChart({ years, scopeLabel, cutoverYear, onHoverYear }: Props) {
  if (!years || years.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  const first = years[0];
  const last = years[years.length - 1];

  if (!first || !last) {
    return <div className="card">No data available</div>;
  }

  // Calculate growth rates
  const priceGrowth = ((last.priceIndex ?? 100) - 100) / 100;
  const rentGrowth = ((last.rentIndex ?? 100) - 100) / 100;
  const wageGrowth = ((last.wageIndex ?? 100) - 100) / 100;

  // Calculate affordability gap: how much faster prices/rents grew than wages
  const priceVsWageGap = priceGrowth - wageGrowth;
  const rentVsWageGap = rentGrowth - wageGrowth;

  // Price-to-income ratios
  const startPriceToIncome = (first.medianPrice ?? 0) / Math.max(1, first.medianAnnualWage ?? 0);
  const endPriceToIncome = (last.medianPrice ?? 0) / Math.max(1, last.medianAnnualWage ?? 0);

  // Rent-to-income (annual rent as % of annual wage)
  const startRentShareOfIncome = ((first.medianAnnualRent ?? 0) / Math.max(1, first.medianAnnualWage ?? 0)) * 100;
  const endRentShareOfIncome = ((last.medianAnnualRent ?? 0) / Math.max(1, last.medianAnnualWage ?? 0)) * 100;

  // Trend assessment
  const getAffordabilityTrend = () => {
    if (priceVsWageGap > 0.3) return { label: "Significantly worsening", color: "#dc2626" };
    if (priceVsWageGap > 0.1) return { label: "Worsening", color: "#ea580c" };
    if (priceVsWageGap > -0.05) return { label: "Roughly stable", color: "#ca8a04" };
    return { label: "Improving", color: "#16a34a" };
  };

  const trend = getAffordabilityTrend();

  return (
    <div className="card">
      <h3 style={{ marginBottom: "4px" }}>Wage vs Housing Growth — {scopeLabel}</h3>
      <p className="chart-description">
        Compares wage growth against housing prices and rents. All indexed to Year 0 = 100.
      </p>

      {/* Summary metrics */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
        gap: "10px",
        marginBottom: "16px" 
      }}>
        <div className="metric-card" style={{ background: "#fef3c7", borderColor: "#fbbf24" }}>
          <span className="metric-label">Wages</span>
          <span className="metric-value" style={{ color: "#b45309" }}>{fmtPct(wageGrowth)}</span>
          <span className="metric-sub">{fmtCurrency(first.medianAnnualWage ?? 0)} → {fmtCurrency(last.medianAnnualWage ?? 0)}</span>
        </div>
        <div className="metric-card" style={{ background: "#fee2e2", borderColor: "#f87171" }}>
          <span className="metric-label">Prices</span>
          <span className="metric-value" style={{ color: "#dc2626" }}>{fmtPct(priceGrowth)}</span>
          <span className="metric-sub">{fmtCurrency(first.medianPrice ?? 0)} → {fmtCurrency(last.medianPrice ?? 0)}</span>
        </div>
        <div className="metric-card" style={{ background: "#dbeafe", borderColor: "#60a5fa" }}>
          <span className="metric-label">Rents</span>
          <span className="metric-value" style={{ color: "#2563eb" }}>{fmtPct(rentGrowth)}</span>
          <span className="metric-sub">{fmtCurrency(first.medianAnnualRent ?? 0)}/yr → {fmtCurrency(last.medianAnnualRent ?? 0)}/yr</span>
        </div>
      </div>

      {/* Affordability indicator */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "16px",
        padding: "12px 16px",
        background: "var(--panel)",
        borderRadius: "8px",
        marginBottom: "16px",
        flexWrap: "wrap"
      }}>
        <div style={{ flex: "1 1 auto" }}>
          <span style={{ fontWeight: 600, marginRight: "8px" }}>Affordability trend:</span>
          <span style={{ 
            color: trend.color, 
            fontWeight: 700,
            padding: "2px 8px",
            background: `${trend.color}15`,
            borderRadius: "4px"
          }}>
            {trend.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--muted)" }}>
          <span>
            Price/Income: <strong>{startPriceToIncome.toFixed(1)}×</strong> → <strong style={{ color: endPriceToIncome > startPriceToIncome ? "#dc2626" : "#16a34a" }}>{endPriceToIncome.toFixed(1)}×</strong>
          </span>
          <span>
            Rent burden: <strong>{startRentShareOfIncome.toFixed(0)}%</strong> → <strong style={{ color: endRentShareOfIncome > startRentShareOfIncome ? "#dc2626" : "#16a34a" }}>{endRentShareOfIncome.toFixed(0)}%</strong>
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={years}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          onMouseMove={(e: any) => {
            const y = e?.activeLabel;
            if (typeof y === "number") onHoverYear?.(y);
          }}
          onMouseLeave={() => onHoverYear?.(null)}
        >
          <XAxis 
            dataKey="year" 
            fontSize={11}
            tick={{ fill: "#6b7280" }}
          />
          <YAxis 
            fontSize={11}
            tick={{ fill: "#6b7280" }}
            domain={['auto', 'auto']}
            tickFormatter={(v) => fmt(v)}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                wageIndex: "Wages",
                priceIndex: "Prices",
                rentIndex: "Rents"
              };
              return [fmt(value), labels[name] || name];
            }}
            labelFormatter={(label) => `Year ${label}`}
            contentStyle={{ 
              fontSize: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border)"
            }}
          />
          <Legend 
            verticalAlign="top"
            height={36}
            formatter={(value) => {
              const labels: Record<string, string> = {
                wageIndex: "Wages (indexed)",
                priceIndex: "Housing prices",
                rentIndex: "Rents (annual)"
              };
              return labels[value] || value;
            }}
          />
          <ReferenceLine 
            y={100} 
            stroke="#9ca3af" 
            strokeDasharray="3 3"
            label={{ value: "Baseline", position: "right", fontSize: 10, fill: "#9ca3af" }}
          />
          {cutoverYear != null && (
            <ReferenceLine
              x={cutoverYear}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              label={{ value: "Model starts", position: "insideTop", fontSize: 10, fill: "#6b7280" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="wageIndex"
            stroke="#b45309"
            strokeWidth={3}
            dot={false}
            name="wageIndex"
          />
          <Line
            type="monotone"
            dataKey="priceIndex"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            name="priceIndex"
          />
          <Line
            type="monotone"
            dataKey="rentIndex"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
            name="rentIndex"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Gap analysis */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        marginTop: "16px",
        padding: "12px",
        background: "#fafafa",
        borderRadius: "8px"
      }}>
        <div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Price growth vs wage growth gap:</span>
          <div style={{ 
            fontWeight: 700, 
            fontSize: "18px",
            color: priceVsWageGap > 0 ? "#dc2626" : "#16a34a"
          }}>
            {fmtPct(priceVsWageGap)}
          </div>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            {priceVsWageGap > 0 ? "Prices outpacing wages" : "Wages catching up"}
          </span>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Rent growth vs wage growth gap:</span>
          <div style={{ 
            fontWeight: 700, 
            fontSize: "18px",
            color: rentVsWageGap > 0 ? "#dc2626" : "#16a34a"
          }}>
            {fmtPct(rentVsWageGap)}
          </div>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            {rentVsWageGap > 0 ? "Rents outpacing wages" : "Wages catching up"}
          </span>
        </div>
      </div>

      <HelpExpander summary="How to interpret this chart">
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", lineHeight: 1.6 }}>
          <li><strong>Wage line (gold):</strong> Shows how median full-time wages grow over time</li>
          <li><strong>Price line (red):</strong> Shows housing price growth — if above wage line, affordability is worsening</li>
          <li><strong>Rent line (blue dashed):</strong> Shows rental cost growth — affects current housing stress</li>
          <li><strong>Baseline (100):</strong> Starting point for all metrics in year 0</li>
          <li><strong>Gap:</strong> The difference between housing growth and wage growth represents the affordability squeeze</li>
        </ul>
      </HelpExpander>

      <HelpExpander summary="Understanding the affordability gap">
        <p style={{ margin: "0 0 8px", fontSize: "13px" }}>
          When housing prices or rents grow faster than wages, each generation finds it harder to afford housing. 
          A positive gap means housing costs are pulling away from incomes.
        </p>
        <div style={{ fontSize: "13px" }}>
          <strong>Price-to-income ratio:</strong> How many years of income needed to buy a median home. 
          A ratio of 10× means the median home costs 10 years of median income.
        </div>
      </HelpExpander>

      <LimitationsBox items={[
        "Wage figures are median full-time incomes — part-time workers face different dynamics",
        "City wage data are estimates based on ABS regional variations",
        "Wage growth rates assume historical trends continue — economic shocks not modeled",
        "Does not account for dual-income households or wealth accumulation"
      ]} />
    </div>
  );
}
