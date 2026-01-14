import type { DecileRow } from "../../model/types";
import { HELP, HelpExpander, LimitationsBox } from "../shared/HelpText";

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function stressChip(inStress: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${inStress ? "#ef4444" : "#22c55e"}`,
    background: inStress ? "#fef2f2" : "#f0fdf4",
    color: inStress ? "#b91c1c" : "#15803d",
    fontSize: 12,
    fontWeight: 600,
  };
}

function fmtAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function DecileBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: "#e5e7eb",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 4,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

export function DecileImpact({ rows }: { rows: DecileRow[] }) {
  const decileHelp = HELP.deciles;

  // Calculate summary stats
  const rentStressCount = rows.filter((r) => r.rentStress).length;
  const mortgageStressCount = rows.filter((r) => r.mortgageStress).length;
  const avgRentShare = rows.reduce((sum, r) => sum + r.rentShare, 0) / rows.length;
  const avgMortgageShare = rows.reduce((sum, r) => sum + r.mortgageShare, 0) / rows.length;

  // Get the max shares for bar scaling
  const maxRentShare = Math.max(...rows.map((r) => r.rentShare));
  const maxMortgageShare = Math.max(...rows.map((r) => r.mortgageShare));

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h2" style={{ marginBottom: 4 }}>
        {decileHelp.title}
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {decileHelp.description}
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 14,
          padding: 12,
          background: "var(--bg-subtle)",
          borderRadius: 8,
        }}
      >
        <div>
          <div className="muted" style={{ fontSize: 11 }}>Deciles in rent stress</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: rentStressCount > 3 ? "#dc2626" : "#16a34a" }}>
            {rentStressCount}/10
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>Deciles in mortgage stress</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: mortgageStressCount > 3 ? "#dc2626" : "#16a34a" }}>
            {mortgageStressCount}/10
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>Avg rent share</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtPct(avgRentShare)}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>Avg mortgage share</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtPct(avgMortgageShare)}</div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={stressChip(false)}>No stress</span>
          <span className="muted">{"<"}30% of income</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={stressChip(true)}>In stress</span>
          <span className="muted">{">"}30% of income</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid var(--border)", fontWeight: 700, width: 70 }}>
                Decile
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid var(--border)", fontWeight: 700, width: 100 }}>
                Income
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid var(--border)", fontWeight: 700, width: 150 }}>
                Rent share
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid var(--border)", fontWeight: 700, width: 90 }}>
                Rent stress
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid var(--border)", fontWeight: 700, width: 150 }}>
                Mortgage share
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid var(--border)", fontWeight: 700, width: 100 }}>
                Mortgage stress
              </th>
              <th style={{ padding: "10px 8px", borderBottom: "2px solid var(--border)", fontWeight: 700, width: 100 }}>
                Deposit / income
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.decile} style={{ background: r.decile % 2 === 0 ? "var(--bg-subtle)" : "transparent" }}>
                <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                  {r.decile}
                  <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>
                    {r.decile === 1 ? "(lowest)" : r.decile === 10 ? "(highest)" : ""}
                  </span>
                </td>
                <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", fontFamily: "monospace", fontSize: 13 }}>
                  {fmtAUD(r.income)}
                </td>
                <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 45, fontFamily: "monospace", fontSize: 13 }}>{fmtPct(r.rentShare)}</span>
                    <DecileBar value={r.rentShare} max={maxRentShare} color={r.rentStress ? "#ef4444" : "#22c55e"} />
                  </div>
                </td>
                <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)" }}>
                  <span style={stressChip(r.rentStress)}>
                    {r.rentStress ? "⚠️ Yes" : "✓ No"}
                  </span>
                </td>
                <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 45, fontFamily: "monospace", fontSize: 13 }}>{fmtPct(r.mortgageShare)}</span>
                    <DecileBar value={r.mortgageShare} max={maxMortgageShare} color={r.mortgageStress ? "#ef4444" : "#22c55e"} />
                  </div>
                </td>
                <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)" }}>
                  <span style={stressChip(r.mortgageStress)}>
                    {r.mortgageStress ? "⚠️ Yes" : "✓ No"}
                  </span>
                </td>
                <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", fontFamily: "monospace", fontSize: 13 }}>
                  {r.depositShareOfIncome.toFixed(1)}x
                  <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>
                    ({Math.round(r.depositShareOfIncome)} years to save)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HelpExpander summary="How to read this table">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><strong>Decile 1:</strong> Lowest 10% of income earners</li>
          <li><strong>Decile 10:</strong> Highest 10% of income earners</li>
          <li><strong>Rent/Mortgage share:</strong> Percentage of income going to housing</li>
          <li><strong>Stress threshold:</strong> {decileHelp.stressDefinition}</li>
          <li><strong>Deposit/income ratio:</strong> Years of income needed for a 20% deposit</li>
        </ul>
      </HelpExpander>

      <HelpExpander summary="Methodology">
        {decileHelp.methodology}
      </HelpExpander>

      <LimitationsBox items={decileHelp.limitations} />

      <div
        style={{
          marginTop: 12,
          padding: 10,
          background: "#fef3c7",
          borderRadius: 8,
          border: "1px solid #fcd34d",
          fontSize: 12,
        }}
      >
        <strong>⚠️ Proxy estimate:</strong> This is illustrative, not actual measured data.
        Real analysis requires ABS income distribution, tenure data by income level, and regional variation.
      </div>
    </div>
  );
}
