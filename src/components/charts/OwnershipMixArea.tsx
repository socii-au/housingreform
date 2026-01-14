import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelinePoint } from "../../model/history/types";
import { HELP, HelpExpander, LimitationsBox } from "../shared/HelpText";

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-AU").format(Math.round(n));
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

export function DwellingStockArea({
  series,
  onHoverYear,
}: {
  series: TimelinePoint[];
  onHoverYear?: (year: number | null) => void;
}) {
  const chartHelp = HELP.charts.stockDemand;

  const data = series.map((s) => ({
    year: s.year,
    dwellingStock: s.dwellingStock ?? 0,
    population: s.population ?? 0,
    // Estimate demand households from population (avg household size ~2.5)
    demandHouseholds: (s.population ?? 0) / 2.5,
  }));

  const first = data[0];
  const last = data[data.length - 1];

  // Calculate key metrics
  const stockChange = last ? (last.dwellingStock - first.dwellingStock) / first.dwellingStock : 0;
  const demandChange = last ? (last.demandHouseholds - first.demandHouseholds) / first.demandHouseholds : 0;
  const newDwellings = last ? last.dwellingStock - first.dwellingStock : 0;

  // Gap analysis
  const initialGap = first.dwellingStock - first.demandHouseholds;
  const finalGap = last ? last.dwellingStock - last.demandHouseholds : 0;
  const gapImproving = finalGap > initialGap;

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h2" style={{ marginBottom: 4 }}>
        Housing stock vs demand
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {chartHelp.description}
      </div>

      {/* Key metrics summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
          marginBottom: 12,
          padding: 10,
          background: "var(--bg-subtle)",
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        <div>
          <span className="muted">Stock growth:</span>{" "}
          <strong>{fmtPct(stockChange)}</strong>
          <span className="muted"> (+{fmtInt(newDwellings)} dwellings)</span>
        </div>
        <div>
          <span className="muted">Demand growth:</span>{" "}
          <strong>{fmtPct(demandChange)}</strong>
        </div>
        <div>
          <span className="muted">Initial surplus/deficit:</span>{" "}
          <strong>{fmtInt(initialGap)}</strong>
        </div>
        <div>
          <span className="muted">Final surplus/deficit:</span>{" "}
          <strong style={{ color: gapImproving ? "#16a34a" : "#dc2626" }}>
            {fmtInt(finalGap)}
          </strong>
          <span style={{ marginLeft: 4 }}>
            {gapImproving ? "📈 improving" : "📉 worsening"}
          </span>
        </div>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
            onMouseMove={(e: any) => {
              const y = e?.activeLabel;
              if (typeof y === "number") onHoverYear?.(y);
            }}
            onMouseLeave={() => onHoverYear?.(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
              label={{
                value: "Dwellings / Households",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#6b7280" },
              }}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              formatter={(value, name) => {
                if (typeof value !== "number") return [value, name];
                return [fmtInt(value), name];
              }}
              labelFormatter={(l) => `Year ${l}`}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="dwellingStock"
              name="Dwelling stock (supply)"
              stroke="#0f766e"
              fill="#0f766e"
              fillOpacity={0.35}
            />
            <Area
              type="monotone"
              dataKey="demandHouseholds"
              name="Household demand"
              stroke="#0369a1"
              fill="#0369a1"
              fillOpacity={0.25}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <HelpExpander summary="How to interpret this chart">
        <p style={{ margin: "0 0 8px 0" }}>{chartHelp.interpretation}</p>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><strong>Green area:</strong> Total dwelling stock (houses, apartments, etc.)</li>
          <li><strong>Blue area:</strong> Estimated household demand (population ÷ 2.5 avg household size)</li>
          <li><strong>Gap between lines:</strong> Supply-demand balance. Smaller gap = tighter market = higher prices</li>
          <li><strong>Positive surplus:</strong> More dwellings than households — healthier market</li>
          <li><strong>Deficit:</strong> Fewer dwellings than households — price pressure</li>
        </ul>
      </HelpExpander>

      <HelpExpander summary="How supply and demand interact">
        <p style={{ margin: "0 0 8px 0" }}>{chartHelp.mechanism}</p>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Population growth drives household formation</li>
          <li>Construction adds to stock (minus demolitions)</li>
          <li>If demand grows faster than supply, prices rise</li>
          <li>Policy can boost supply (construction incentives) or reduce demand (investor restrictions)</li>
        </ul>
      </HelpExpander>

      <LimitationsBox
        items={[
          chartHelp.limitations,
          "Assumes constant 2.5 average household size",
          "Doesn't model dwelling type mix (houses vs apartments)",
          "Vacancy rates not explicitly modeled",
        ]}
      />
    </div>
  );
}

export { DwellingStockArea as OwnershipMixArea };
