import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelinePoint } from "../../model/history/types";
import { HELP, HelpExpander, LimitationsBox } from "../shared/HelpText";

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function fmtAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function PriceVsBaseline({
  title,
  series,
  dataKey,
  baseValue,
  cutoverYear,
  onHoverYear,
}: {
  title: string;
  series: TimelinePoint[];
  dataKey: "medianPrice" | "medianAnnualRent";
  baseValue: number;
  cutoverYear?: number;
  onHoverYear?: (year: number | null) => void;
}) {
  const isPrice = dataKey === "medianPrice";
  const helpKey = isPrice ? "priceIndex" : "rentIndex";
  const chartHelp = HELP.charts[helpKey];

  const indexed = series
    .map((s) => {
      const v = (s as any)[dataKey] as number | undefined;
      const idx = typeof v === "number" && baseValue > 0 ? (v / baseValue) * 100 : null;
      // Back-compat: when we pass projected series without a `kind` field, treat it as projected.
      const kind = (s as any).kind ?? "projected";
      return {
        year: (s as any).year,
        kind,
        value: v ?? null,
        index: idx,
        histIndex: kind === "historical" ? idx : null,
        projIndex: kind === "projected" ? idx : null,
      };
    })
    .filter((x) => x.year != null);

  const first = indexed[0];
  const last = indexed[indexed.length - 1];
  const totalChange = last && first && first.value != null && last.value != null
    ? (last.value - first.value) / first.value
    : 0;
  const avgAnnualChange = last && first && last.year > first.year && first.value != null && last.value != null
    ? Math.pow(1 + totalChange, 1 / (last.year - first.year)) - 1
    : 0;

  // Color coding based on growth rate
  const lineColor =
    avgAnnualChange > 0.07 ? "#dc2626" :   // Red: very high growth
    avgAnnualChange > 0.04 ? "#ca8a04" :   // Yellow: moderate growth
    avgAnnualChange > 0.02 ? "#16a34a" :   // Green: low growth
    "#0369a1";                              // Blue: negative/stable

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h2" style={{ marginBottom: 4 }}>
        {title}
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {chartHelp.description}
      </div>

      {/* Key metrics summary */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          padding: 10,
          background: "var(--bg-subtle)",
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <div>
          <span className="muted">Start:</span>{" "}
          <strong>{fmtAUD(first?.value ?? 0)}</strong>
        </div>
        <div>
          <span className="muted">End:</span>{" "}
          <strong>{fmtAUD(last?.value ?? 0)}</strong>
        </div>
        <div>
          <span className="muted">Total:</span>{" "}
          <strong style={{ color: lineColor }}>{fmtPct(totalChange)}</strong>
        </div>
        <div>
          <span className="muted">Annual avg:</span>{" "}
          <strong>{fmtPct(avgAnnualChange)}/yr</strong>
        </div>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart
            data={indexed}
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
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${v}`}
              label={{
                value: "Index (start=100)",
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
                if (name === "Nominal value") return [fmtAUD(value), name];
                return [value.toFixed(1), name];
              }}
              labelFormatter={(l) => `Year ${l}`}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="histIndex"
              name={isPrice ? "Historical" : "Historical"}
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="projIndex"
              name={isPrice ? "Projected" : "Projected"}
              stroke={lineColor}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: lineColor }}
            />
            {/* Reference line at 100 */}
            <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="4 4" />
            {cutoverYear != null && (
              <ReferenceLine
                x={cutoverYear}
                stroke="#9ca3af"
                strokeDasharray="3 3"
                label={{ value: "Model starts", position: "insideTop", fontSize: 10, fill: "#6b7280" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <HelpExpander summary="How to interpret this chart">
        <p style={{ margin: "0 0 8px 0" }}>{chartHelp.interpretation}</p>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Index starts at 100 in year 0</li>
          <li>Index of 150 = 50% higher than starting value</li>
          <li>Index of 200 = doubled from starting value</li>
          <li>Dashed line shows the starting baseline for reference</li>
        </ul>
      </HelpExpander>

      <HelpExpander summary="Color coding">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><span style={{ color: "#dc2626" }}>■</span> Red: Very high growth ({">"}7%/year) — affordability worsening rapidly</li>
          <li><span style={{ color: "#ca8a04" }}>■</span> Yellow: Moderate growth (4-7%/year) — faster than wages typically grow</li>
          <li><span style={{ color: "#16a34a" }}>■</span> Green: Low growth (2-4%/year) — roughly tracking inflation</li>
          <li><span style={{ color: "#0369a1" }}>■</span> Blue: Stable/declining ({"<"}2%/year) — improving affordability</li>
        </ul>
      </HelpExpander>

      <LimitationsBox items={[chartHelp.limitations]} />
    </div>
  );
}
