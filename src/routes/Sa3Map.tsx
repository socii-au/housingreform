import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getConvexUrl } from "../convexClient";

type Feature = {
  code: string;
  name?: string;
  polygon: Array<[number, number]>; // single ring projected in 0..1000 x 0..760
};

function polygonToPath(ring: Array<[number, number]>): string {
  if (!ring.length) return "";
  const [x0, y0] = ring[0];
  let d = `M${x0},${y0}`;
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = ring[i];
    d += ` L${x},${y}`;
  }
  return d + " Z";
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function crisisRamp01(t: number): string {
  const x = clamp01(t);
  if (x < 0.12) return "#16a34a";
  if (x < 0.24) return "#65a30d";
  if (x < 0.40) return "#a3a3a3";
  if (x < 0.55) return "#f59e0b";
  if (x < 0.70) return "#f97316";
  if (x < 0.85) return "#ea580c";
  return "#dc2626";
}

export function Sa3Map() {
  const convexUrl = getConvexUrl();
  const edition = 2026;
  const [level, setLevel] = useState<"SA3" | "SA4">("SA3");

  const years = useQuery(api.asgs.listAvailableYears, convexUrl ? { edition, level } : "skip") as number[] | undefined;
  const [year, setYear] = useState<number | null>(null);

  const scopes = useQuery(api.asgs.listScopes, convexUrl ? { edition, level } : "skip") as
    | { states: string[]; sa4s: string[] }
    | undefined;

  const [scopeMode, setScopeMode] = useState<"national" | "state" | "sa4">("national");
  const [scopeState, setScopeState] = useState<string>("");
  const [scopeSa4, setScopeSa4] = useState<string>("");

  const scopeKey =
    scopeMode === "national"
      ? "NATIONAL"
      : scopeMode === "state"
        ? `STATE:${scopeState || (scopes?.states?.[0] ?? "")}`
        : `SA4:${scopeSa4 || (scopes?.sa4s?.[0] ?? "")}`;

  const effectiveScopeKey = level === "SA4" && scopeMode === "sa4" ? "NATIONAL" : scopeKey;

  const geometry = useQuery(
    api.asgs.getGeometryChunk,
    convexUrl ? { edition, level, scopeKey: "NATIONAL" } : "skip"
  ) as any;

  const layer = useQuery(
    api.asgs.getLayer,
    convexUrl && year != null ? { edition, level, metric: "crisisScore", year, scopeKey: effectiveScopeKey } : "skip"
  ) as any;

  const valuesByCode = useMemo(() => {
    const m = new Map<string, number>();
    const vals = layer?.values as Array<[string, number]> | undefined;
    if (!vals) return m;
    vals.forEach(([code, v]) => {
      if (typeof code === "string" && typeof v === "number" && Number.isFinite(v)) m.set(code, v);
    });
    return m;
  }, [layer]);

  const features: Feature[] = useMemo(() => {
    const data = geometry?.data;
    const fs = data?.features as any[] | undefined;
    if (!Array.isArray(fs)) return [];
    return fs
      .map((f) => {
        const code = f?.code as string | undefined;
        const ring = f?.polygon as Array<[number, number]> | undefined;
        if (!code || !Array.isArray(ring) || ring.length < 3) return null;
        return { code, name: f?.name, polygon: ring };
      })
      .filter(Boolean) as Feature[];
  }, [geometry]);

  const readyYear = year ?? (years?.[years.length - 1] ?? null);

  return (
    <div>
      <div className="h1">ASGS 2026 — SA3/SA4 Map (bootstrap)</div>
      {!convexUrl ? (
        <div className="callout warning">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Convex not configured</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Set <code>VITE_CONVEX_URL</code> to your Convex deployment URL to enable SA3 map + caching.
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>Level</div>
          <select className="select-field" value={level} onChange={(e) => setLevel(e.target.value as any)} style={{ minWidth: 140 }}>
            <option value="SA3">SA3</option>
            <option value="SA4">SA4</option>
          </select>

          <div style={{ fontWeight: 800 }}>Year</div>
          <select
            className="select-field"
            value={String(readyYear ?? "")}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={!years || years.length === 0}
            style={{ minWidth: 160 }}
          >
            {(years ?? []).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <div style={{ width: 10 }} />

          <div style={{ fontWeight: 800 }}>Scope</div>
          <select
            className="select-field"
            value={scopeMode}
            onChange={(e) => setScopeMode(e.target.value as any)}
            style={{ minWidth: 160 }}
          >
            <option value="national">National</option>
            <option value="state">State</option>
            {level === "SA3" ? <option value="sa4">SA4</option> : null}
          </select>

          {scopeMode === "state" && (
            <select
              className="select-field"
              value={scopeState || (scopes?.states?.[0] ?? "")}
              onChange={(e) => setScopeState(e.target.value)}
              disabled={!scopes?.states?.length}
              style={{ minWidth: 200 }}
            >
              {(scopes?.states ?? []).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          )}

          {scopeMode === "sa4" && (
            <select
              className="select-field"
              value={scopeSa4 || (scopes?.sa4s?.[0] ?? "")}
              onChange={(e) => setScopeSa4(e.target.value)}
              disabled={!scopes?.sa4s?.length}
              style={{ minWidth: 200 }}
            >
              {(scopes?.sa4s ?? []).map((sa4) => (
                <option key={sa4} value={sa4}>
                  SA4:{sa4}
                </option>
              ))}
            </select>
          )}

          <div className="muted" style={{ fontSize: 12 }}>
            Geometry: {geometry ? "loaded" : "missing"} • Layer: {layer ? "loaded" : "missing"} • scopeKey:{" "}
            <strong>{effectiveScopeKey}</strong>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <svg viewBox="0 0 1000 760" width="100%" height="620" role="img" aria-label="SA3 crisis choropleth">
          <rect x="0" y="0" width="1000" height="760" fill="#f8fafc" />
          {features.map((f) => {
            const v = valuesByCode.get(f.code);
            const fill = typeof v === "number" ? crisisRamp01(v) : "#e5e7eb";
            return (
              <path
                key={f.code}
                d={polygonToPath(f.polygon)}
                fill={fill}
                stroke="rgba(15,23,42,0.12)"
                strokeWidth={1}
              >
                <title>
                  {f.name ? `${f.name} (${f.code})` : f.code} — {typeof v === "number" ? `${Math.round(v * 100)}/100` : "no data"}
                </title>
              </path>
            );
          })}
        </svg>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        This is a bootstrap SA3 map wired to Convex. Next step is ingesting ASGS 2026 SA3 regions/geometry and generating/imputing series + caching layers.
      </div>
    </div>
  );
}

