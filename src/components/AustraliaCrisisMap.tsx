import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { CityId, StateId, Scope } from "../model/regions";
import { ALL_STATES, STATE_NAMES, cityMeta } from "../model/regions";
import type { ScenarioOutputs } from "../model/runScenario";
import type { ScenarioParams } from "../model/methodology";
import { computeCrisisScore, crisisColor } from "../model/crisisScore";
import type { HistoryBundle } from "../model/history/types";
import {
  AU_CITY_CATCHMENTS_GEOJSON,
  AU_STATE_SUBREGIONS_GEOJSON,
  AU_STATES_GEOJSON,
  SUBREGION_ANCHOR_BIAS,
  SUBREGION_WEIGHTS,
  polygonToPath,
} from "./maps/auGeo";
import { sanitizeHistoryBundle } from "../security/sanitize";
import {
  SA2_FEATURES,
  computeSA2CrisisScore,
  sa2PolygonToPath,
  type SA2Feature,
} from "./maps/sa2Data";
import {
  SA3_FEATURES,
  computeSA3CrisisScore,
  sa3PolygonToPath,
  STATE_CODE_MAP,
  type SA3Feature,
} from "./maps/sa3Data";
import {
  SA4_FEATURES,
  computeSA4CrisisScore,
  sa4PolygonToPath,
  type SA4Feature,
} from "./maps/sa4Data";

type CityPoint = {
  cityId: CityId;
  x: number;
  y: number;
  // A rough “catchment” radius in map units (not geo-accurate). Larger for capitals.
  r: number;
};

const VIEW = { w: 1000, h: 760 };

// City markers (hand-tuned, approximate).
const CITY_POINTS: CityPoint[] = [
  { cityId: "PER", x: 220, y: 320, r: 78 },
  { cityId: "BUN", x: 260, y: 440, r: 42 },
  { cityId: "KAL", x: 320, y: 420, r: 34 },
  { cityId: "GER", x: 230, y: 270, r: 34 },
  { cityId: "ALB", x: 200, y: 560, r: 30 },
  { cityId: "BRO", x: 240, y: 180, r: 34 },
  { cityId: "KAR", x: 280, y: 220, r: 34 },
  { cityId: "PHD", x: 310, y: 190, r: 30 },
  { cityId: "NWM", x: 320, y: 250, r: 26 },
  { cityId: "TMP", x: 300, y: 260, r: 24 },

  { cityId: "ADL", x: 515, y: 475, r: 64 },
  { cityId: "MTG", x: 560, y: 560, r: 28 },
  { cityId: "WHY", x: 480, y: 460, r: 26 },
  { cityId: "PLN", x: 560, y: 505, r: 26 },
  { cityId: "PPR", x: 520, y: 470, r: 24 },
  { cityId: "PAG", x: 500, y: 430, r: 24 },
  { cityId: "MBR", x: 560, y: 520, r: 24 },
  { cityId: "VHB", x: 540, y: 540, r: 22 },
  { cityId: "NRC", x: 580, y: 560, r: 22 },

  { cityId: "DRW", x: 510, y: 200, r: 50 },
  { cityId: "ASP", x: 520, y: 280, r: 32 },
  { cityId: "KAT", x: 520, y: 240, r: 26 },
  { cityId: "TNC", x: 520, y: 260, r: 24 },

  { cityId: "CBR", x: 820, y: 560, r: 34 },
  { cityId: "SYD", x: 860, y: 520, r: 78 },
  { cityId: "NCL", x: 885, y: 485, r: 36 },
  { cityId: "PST", x: 900, y: 490, r: 28 },
  { cityId: "PMQ", x: 885, y: 470, r: 30 },
  { cityId: "TAR", x: 875, y: 465, r: 26 },
  { cityId: "FOS", x: 885, y: 455, r: 24 },
  { cityId: "KPS", x: 890, y: 460, r: 24 },
  { cityId: "NMB", x: 895, y: 460, r: 24 },
  { cityId: "COF", x: 900, y: 455, r: 30 },
  { cityId: "LSM", x: 910, y: 445, r: 28 },
  { cityId: "BLN", x: 915, y: 450, r: 24 },
  { cityId: "BYR", x: 920, y: 455, r: 22 },
  { cityId: "TWD", x: 920, y: 460, r: 24 },
  { cityId: "TMW", x: 850, y: 470, r: 28 },
  { cityId: "DBO", x: 800, y: 485, r: 28 },
  { cityId: "ORG", x: 820, y: 520, r: 24 },
  { cityId: "BTH", x: 810, y: 530, r: 24 },
  { cityId: "GOU", x: 800, y: 575, r: 24 },
  { cityId: "GRF", x: 740, y: 560, r: 24 },
  { cityId: "LET", x: 760, y: 550, r: 22 },
  { cityId: "WOL", x: 845, y: 555, r: 34 },
  { cityId: "CCS", x: 870, y: 500, r: 32 },
  { cityId: "ALW", x: 760, y: 595, r: 36 },
  { cityId: "WGA", x: 700, y: 575, r: 28 },

  { cityId: "MEL", x: 770, y: 650, r: 78 },
  { cityId: "GEL", x: 740, y: 670, r: 34 },
  { cityId: "BEN", x: 720, y: 625, r: 34 },
  { cityId: "BAL", x: 740, y: 640, r: 34 },
  { cityId: "SHP", x: 700, y: 615, r: 28 },
  { cityId: "MLD", x: 640, y: 610, r: 28 },
  { cityId: "WAR", x: 700, y: 675, r: 26 },
  { cityId: "TRG", x: 785, y: 650, r: 26 },
  { cityId: "HOR", x: 640, y: 655, r: 24 },
  { cityId: "WGR", x: 760, y: 615, r: 24 },
  { cityId: "SAL", x: 805, y: 660, r: 24 },

  { cityId: "HBA", x: 820, y: 725, r: 44 },
  { cityId: "LST", x: 800, y: 705, r: 32 },
  { cityId: "DVP", x: 790, y: 695, r: 26 },
  { cityId: "BUR", x: 770, y: 690, r: 24 },

  { cityId: "BNE", x: 820, y: 360, r: 70 },
  { cityId: "IPS", x: 805, y: 385, r: 36 },
  { cityId: "GC", x: 850, y: 395, r: 42 },
  { cityId: "SC", x: 800, y: 325, r: 42 },
  { cityId: "GYP", x: 790, y: 360, r: 28 },
  { cityId: "MBH", x: 800, y: 340, r: 26 },
  { cityId: "TWB", x: 780, y: 385, r: 34 },
  { cityId: "ROP", x: 770, y: 265, r: 34 },
  { cityId: "MKY", x: 810, y: 245, r: 36 },
  { cityId: "GLA", x: 780, y: 290, r: 30 },
  { cityId: "BDG", x: 795, y: 335, r: 28 },
  { cityId: "HVB", x: 815, y: 345, r: 28 },
  { cityId: "TSV", x: 850, y: 220, r: 42 },
  { cityId: "CNS", x: 890, y: 180, r: 38 },
];

function fmtPct(x: number): string {
  return (x * 100).toFixed(0) + "%";
}

function fmt1(x: number): string {
  return x.toFixed(1);
}

function alphaColor(hex: string, a: number): string {
  // hex "#rrggbb"
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getCityYearSnapshot(opts: {
  cityId: CityId;
  year: number;
  outputs: ScenarioOutputs;
  params: ScenarioParams;
  historyBundle?: HistoryBundle;
}): { medianPrice?: number; medianAnnualRent?: number; medianAnnualWage?: number } | null {
  const { cityId, year, outputs, params, historyBundle } = opts;
  const base = params.cities.find((c) => c.cityId === cityId);
  const year0 = base?.year0;

  // Historical
  if (historyBundle && typeof year0 === "number" && year < year0) {
    const h = historyBundle.byCity?.[cityId];
    if (!h) return null;
    const idx = h.years.indexOf(year as any);
    if (idx < 0) return null;
    const p = h.medianPrice?.[idx];
    const r = h.medianAnnualRent?.[idx];
    const w = h.medianAnnualWage?.[idx];
    return {
      medianPrice: typeof p === "number" ? p : undefined,
      medianAnnualRent: typeof r === "number" ? r : undefined,
      medianAnnualWage: typeof w === "number" ? w : undefined,
    };
  }

  // Projected (includes baseline year0 and forward)
  const cityOut = outputs.byCity?.[cityId];
  if (!cityOut) return null;
  const row = cityOut.years.find((y) => y.year === (year as any));
  if (!row) return null;
  return {
    medianPrice: row.medianPrice,
    medianAnnualRent: row.medianAnnualRent,
    medianAnnualWage: row.medianAnnualWage,
  };
}

function aggregateStateScore(opts: {
  state: StateId;
  year: number;
  outputs: ScenarioOutputs;
  params: ScenarioParams;
  historyBundle?: HistoryBundle;
}): number | null {
  const cities = opts.params.cities
    .map((c) => c.cityId)
    .filter((id) => cityMeta(id).state === opts.state);
  if (cities.length === 0) return null;
  const scores: Array<{ s: number; w: number }> = [];
  cities.forEach((cityId) => {
    const snap = getCityYearSnapshot({
      cityId,
      year: opts.year,
      outputs: opts.outputs,
      params: opts.params,
      historyBundle: opts.historyBundle,
    });
    if (!snap) return;
    const detail = computeCrisisScore(snap);
    if (!detail) return;
    const pop = opts.params.cities.find((c) => c.cityId === cityId)?.population ?? 1;
    scores.push({ s: detail.score01, w: pop });
  });
  if (scores.length === 0) return null;
  const wSum = scores.reduce((a, b) => a + b.w, 0) || 1;
  return scores.reduce((a, b) => a + (b.w / wSum) * b.s, 0);
}

type MapLayer = "cities" | "sa2" | "sa3" | "sa4";

export function AustraliaCrisisMap(props: {
  outputs: ScenarioOutputs;
  params: ScenarioParams;
  year: number;
  historyBundle?: HistoryBundle;
  title?: string;
  scope?: Scope;
}) {
  const { outputs, params, year, scope } = props;
  const historyBundle = sanitizeHistoryBundle(props.historyBundle) ?? undefined;
  const [hoverCity, setHoverCity] = useState<CityId | null>(null);
  const [hoverSA2, setHoverSA2] = useState<SA2Feature | null>(null);
  const [hoverSA3, setHoverSA3] = useState<SA3Feature | null>(null);
  const [hoverSA4, setHoverSA4] = useState<SA4Feature | null>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>("cities"); // Default to Cities layer

  const activeCity = scope?.level === "city" ? scope.city : null;
  const activeState =
    scope?.level === "state"
      ? scope.state
      : scope?.level === "city"
        ? cityMeta(scope.city).state
        : null;
  const isStateAllowed = (stateId: StateId) => (!activeState ? true : stateId === activeState);
  const isCityAllowed = (cityId: CityId) =>
    activeCity ? cityId === activeCity : !activeState ? true : cityMeta(cityId).state === activeState;

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom limits
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 1.3;

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom direction
    const delta = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));

    if (newZoom !== zoom) {
      // Adjust pan to zoom toward mouse position
      const zoomRatio = newZoom / zoom;
      const newPanX = mouseX - (mouseX - pan.x) * zoomRatio;
      const newPanY = mouseY - (mouseY - pan.y) * zoomRatio;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  }, [zoom, pan]);

  // Handle pan start
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  // Handle pan move
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }, [isPanning, panStart]);

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset zoom and pan
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Zoom in/out buttons
  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);

  // Auto-switch to more granular layer when zoomed in
  useEffect(() => {
    if (zoom >= 4 && mapLayer === "sa4") {
      setMapLayer("sa3");
    } else if (zoom >= 6 && mapLayer === "sa3") {
      setMapLayer("sa2");
    }
  }, [zoom, mapLayer]);

  useEffect(() => {
    if (activeCity && mapLayer !== "cities") setMapLayer("cities");
  }, [activeCity, mapLayer]);

  // Compute SA2 crisis scores (most granular)
  const sa2Scores = useMemo(() => {
    const out = new Map<string, number | null>();
    SA2_FEATURES.forEach((f) => {
      out.set(f.code, computeSA2CrisisScore(f));
    });
    return out;
  }, []);

  // Compute SA3 crisis scores
  const sa3Scores = useMemo(() => {
    const out = new Map<string, number | null>();
    SA3_FEATURES.forEach((f) => {
      out.set(f.code, computeSA3CrisisScore(f));
    });
    return out;
  }, []);

  // Compute SA4 crisis scores
  const sa4Scores = useMemo(() => {
    const out = new Map<string, number | null>();
    SA4_FEATURES.forEach((f) => {
      out.set(f.code, computeSA4CrisisScore(f));
    });
    return out;
  }, []);

  const cityScores = useMemo(() => {
    const out: Partial<Record<CityId, ReturnType<typeof computeCrisisScore>>> = {};
    params.cities.forEach((c) => {
      const snap = getCityYearSnapshot({ cityId: c.cityId, year, outputs, params, historyBundle });
      out[c.cityId] = snap ? computeCrisisScore(snap) : null;
    });
    return out;
  }, [params, year, outputs, historyBundle]);

  const stateScores = useMemo(() => {
    const out: Partial<Record<StateId, number | null>> = {};
    ALL_STATES.forEach((st) => {
      out[st] = aggregateStateScore({ state: st, year, outputs, params, historyBundle });
    });
    return out;
  }, [params, year, outputs, historyBundle]);

  const subregionScores = useMemo(() => {
    const out: Record<string, number | null> = {};
    AU_STATE_SUBREGIONS_GEOJSON.features.forEach((f) => {
      const weights = SUBREGION_WEIGHTS[f.properties.id] ?? [];
      const st = f.properties.state as StateId;

      // Baseline: synthetic anchor bias applied to the state score (independent of city availability).
      // If state score is missing, assume neutral 0.50 so the map still renders structure.
      const stateBase = stateScores[st] ?? 0.5;
      const bias = SUBREGION_ANCHOR_BIAS[f.properties.id] ?? 0;
      const anchorScore = clamp01(stateBase + bias);

      // Optional refinement: blend toward city-weighted subregion score when enough city signal exists.
      let cityScore: number | null = null;
      if (weights.length > 0) {
        let sum = 0;
        let wsum = 0;
        weights.forEach(([cityId, w]) => {
          const d = cityScores[cityId];
          if (!d) return;
          sum += d.score01 * w;
          wsum += w;
        });
        cityScore = wsum > 0 ? sum / wsum : null;
      }

      // Coverage weight: more included cities in a state -> more trust in city-based variation.
      const cityCountInState = params.cities.filter((c) => cityMeta(c.cityId).state === st).length;
      const trust = clamp01(cityCountInState / 5); // 0..1, saturates at ~5 cities

      out[f.properties.id] =
        cityScore == null ? anchorScore : clamp01(lerp(anchorScore, cityScore, trust));
    });
    return out;
  }, [cityScores, stateScores, params.cities]);

  const hoverDetail = hoverCity ? cityScores[hoverCity] : null;
  const hoverSA2Score = hoverSA2 ? sa2Scores.get(hoverSA2.code) : null;
  const hoverSA3Score = hoverSA3 ? sa3Scores.get(hoverSA3.code) : null;
  const hoverSA4Score = hoverSA4 ? sa4Scores.get(hoverSA4.code) : null;

  const catchmentCityIds = useMemo(
    () => new Set(AU_CITY_CATCHMENTS_GEOJSON.features.map((f) => f.properties.cityId as CityId)),
    []
  );

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="h2" style={{ margin: 0 }}>{props.title ?? "National crisis heatmap"}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["sa2", "sa3", "sa4", "cities"] as const).map((layer) => {
            const labels: Record<MapLayer, string> = {
              sa2: `SA2 (${SA2_FEATURES.length})`,
              sa3: `SA3 (${SA3_FEATURES.length})`,
              sa4: `SA4 (${SA4_FEATURES.length})`,
              cities: "Cities",
            };
            const isActive = mapLayer === layer;
            return (
              <button
                key={layer}
                type="button"
                onClick={() => setMapLayer(layer)}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? "var(--accent)" : "var(--surface-alt)",
                  color: isActive ? "white" : "var(--fg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {labels[layer]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        {mapLayer === "sa2"
          ? `Showing ${SA2_FEATURES.length} SA2 statistical areas (most granular) with 2024 baseline data. Hover for details.`
          : mapLayer === "sa3"
            ? `Showing ${SA3_FEATURES.length} SA3 statistical areas (medium detail) with 2024 baseline data. Hover for details.`
            : mapLayer === "sa4"
              ? `Showing ${SA4_FEATURES.length} SA4 statistical areas (broadest) with 2024 baseline data. Hover for details.`
              : "Updates live when you hover across years in the charts. Scoring blends rent burden and price-to-income (shape-first)."}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, alignItems: "start" }}>
        <div style={{ position: "relative", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", background: "white" }}>
          {/* Zoom controls */}
          <div style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            background: "rgba(255,255,255,0.95)",
            borderRadius: 8,
            padding: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
            <button
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              style={{
                width: 32,
                height: 32,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: zoom >= MAX_ZOOM ? "#e5e7eb" : "white",
                cursor: zoom >= MAX_ZOOM ? "not-allowed" : "pointer",
                fontSize: 18,
                fontWeight: 700,
                color: zoom >= MAX_ZOOM ? "#9ca3af" : "#0f172a",
              }}
              title="Zoom in (or use scroll wheel)"
            >
              +
            </button>
            <button
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              style={{
                width: 32,
                height: 32,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: zoom <= MIN_ZOOM ? "#e5e7eb" : "white",
                cursor: zoom <= MIN_ZOOM ? "not-allowed" : "pointer",
                fontSize: 18,
                fontWeight: 700,
                color: zoom <= MIN_ZOOM ? "#9ca3af" : "#0f172a",
              }}
              title="Zoom out (or use scroll wheel)"
            >
              −
            </button>
            <button
              onClick={resetView}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              style={{
                width: 32,
                height: 32,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: (zoom === 1 && pan.x === 0 && pan.y === 0) ? "#e5e7eb" : "white",
                cursor: (zoom === 1 && pan.x === 0 && pan.y === 0) ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: (zoom === 1 && pan.x === 0 && pan.y === 0) ? "#9ca3af" : "#0f172a",
              }}
              title="Reset view"
            >
              ⟲
            </button>
            <div style={{
              fontSize: 10,
              textAlign: "center",
              color: "#6b7280",
              marginTop: 2,
            }}>
              {zoom.toFixed(1)}×
            </div>
          </div>

          {/* Zoom hint */}
          {zoom === 1 && (
            <div style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              background: "rgba(15,23,42,0.85)",
              color: "white",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 11,
              whiteSpace: "nowrap",
            }}>
              Scroll to zoom • Drag to pan • Double-click to zoom in
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
            width="100%"
            height="520"
            role="img"
            aria-label="Australia crisis heatmap"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={(e) => {
              e.preventDefault();
              const svg = svgRef.current;
              if (!svg) return;
              const rect = svg.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;
              const newZoom = Math.min(MAX_ZOOM, zoom * ZOOM_STEP);
              const zoomRatio = newZoom / zoom;
              setPan({
                x: mouseX - (mouseX - pan.x) * zoomRatio,
                y: mouseY - (mouseY - pan.y) * zoomRatio,
              });
              setZoom(newZoom);
            }}
            style={{
              cursor: isPanning ? "grabbing" : "grab",
              userSelect: "none",
            }}
          >
            <defs>
              {AU_STATES_GEOJSON.features.map((f) => (
                <clipPath key={f.properties.id} id={`clip-${f.properties.id}`}>
                  <path d={polygonToPath(f.geometry)} />
                </clipPath>
              ))}
            </defs>

            {/* Transform group for zoom and pan */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

            {/* State polygons (base fill) */}
            {AU_STATES_GEOJSON.features.map((f) => {
              const st = f.properties.id as StateId;
              const s = stateScores[st];
              const fill = s == null ? "#e5e7eb" : alphaColor(crisisColor(s), 0.14);
              return (
                <path
                  key={`st-fill-${st}`}
                  d={polygonToPath(f.geometry)}
                  fill={fill}
                  stroke="#cbd5e1"
                  strokeWidth={1.5 / zoom}
                />
              );
            })}

            {/* Second mesh layer: subregions (coastal/inland/remote) */}
            {AU_STATE_SUBREGIONS_GEOJSON.features.map((f) => {
              const id = f.properties.id;
              const st = f.properties.state as StateId;
              if (!isStateAllowed(st)) return null;
              const score = subregionScores[id];
              const fill = score == null ? "rgba(148,163,184,0.12)" : alphaColor(crisisColor(score), 0.22);
              return (
                <path
                  key={`sub-${id}`}
                  d={polygonToPath(f.geometry)}
                  clipPath={`url(#clip-${st})`}
                  fill={fill}
                  stroke="rgba(15,23,42,0.08)"
                  strokeWidth={1 / zoom}
                />
              );
            })}

            {/* SA2 choropleth layer (when selected - most granular) */}
            {mapLayer === "sa2" &&
              SA2_FEATURES.map((f) => {
                const score = sa2Scores.get(f.code);
                const stateId = STATE_CODE_MAP[f.state as keyof typeof STATE_CODE_MAP] as StateId;
                if (stateId && !isStateAllowed(stateId)) return null;
                const fill = score != null ? alphaColor(crisisColor(score), 0.65) : "#e5e7eb";
                const isHover = hoverSA2?.code === f.code;
                return (
                  <path
                    key={`sa2-${f.code}`}
                    d={sa2PolygonToPath(f.polygon)}
                    clipPath={stateId ? `url(#clip-${stateId})` : undefined}
                    fill={fill}
                    stroke={isHover ? "#0f172a" : "rgba(15,23,42,0.12)"}
                    strokeWidth={(isHover ? 2 : 0.4) / zoom}
                    onMouseEnter={() => setHoverSA2(f)}
                    onMouseLeave={() => setHoverSA2(null)}
                    style={{ cursor: isPanning ? "grabbing" : "pointer" }}
                  >
                    <title>{f.name} ({f.code}) — {score != null ? `${(score * 100).toFixed(0)}/100` : "no data"}</title>
                  </path>
                );
              })}

            {/* SA4 choropleth layer (when selected) */}
            {mapLayer === "sa4" &&
              SA4_FEATURES.map((f) => {
                const score = sa4Scores.get(f.code);
                const stateId = STATE_CODE_MAP[f.state] as StateId;
                if (stateId && !isStateAllowed(stateId)) return null;
                const fill = score != null ? alphaColor(crisisColor(score), 0.70) : "#e5e7eb";
                const isHover = hoverSA4?.code === f.code;
                return (
                  <path
                    key={`sa4-${f.code}`}
                    d={sa4PolygonToPath(f.polygon)}
                    clipPath={stateId ? `url(#clip-${stateId})` : undefined}
                    fill={fill}
                    stroke={isHover ? "#0f172a" : "rgba(15,23,42,0.18)"}
                    strokeWidth={(isHover ? 2 : 0.8) / zoom}
                    onMouseEnter={() => setHoverSA4(f)}
                    onMouseLeave={() => setHoverSA4(null)}
                    style={{ cursor: isPanning ? "grabbing" : "pointer" }}
                  >
                    <title>{f.name} ({f.code}) — {score != null ? `${(score * 100).toFixed(0)}/100` : "no data"}</title>
                  </path>
                );
              })}

            {/* SA3 choropleth layer (when selected) */}
            {mapLayer === "sa3" &&
              SA3_FEATURES.map((f) => {
                const score = sa3Scores.get(f.code);
                const stateId = STATE_CODE_MAP[f.state] as StateId;
                if (stateId && !isStateAllowed(stateId)) return null;
                const fill = score != null ? alphaColor(crisisColor(score), 0.70) : "#e5e7eb";
                const isHover = hoverSA3?.code === f.code;
                return (
                  <path
                    key={`sa3-${f.code}`}
                    d={sa3PolygonToPath(f.polygon)}
                    clipPath={stateId ? `url(#clip-${stateId})` : undefined}
                    fill={fill}
                    stroke={isHover ? "#0f172a" : "rgba(15,23,42,0.18)"}
                    strokeWidth={(isHover ? 2 : 0.8) / zoom}
                    onMouseEnter={() => setHoverSA3(f)}
                    onMouseLeave={() => setHoverSA3(null)}
                    style={{ cursor: isPanning ? "grabbing" : "pointer" }}
                  >
                    <title>{f.name} ({f.code}) — {score != null ? `${(score * 100).toFixed(0)}/100` : "no data"}</title>
                  </path>
                );
              })}

            {/* City catchment mesh (when selected) */}
            {mapLayer === "cities" &&
              AU_CITY_CATCHMENTS_GEOJSON.features.map((f) => {
                const cityId = f.properties.cityId as CityId;
                const st = f.properties.state as StateId;
                if (!isCityAllowed(cityId) || !isStateAllowed(st)) return null;
                const detail = cityScores[cityId];
                const d = polygonToPath(f.geometry);
                const fill = detail ? alphaColor(crisisColor(detail.score01), 0.60) : "#e5e7eb";
                return (
                  <path
                    key={`cell-${cityId}`}
                    d={d}
                    clipPath={`url(#clip-${st})`}
                    fill={fill}
                    stroke="rgba(15,23,42,0.10)"
                    strokeWidth={1 / zoom}
                  />
                );
              })}

            {/* Fallback city heat bubbles (for any city without a catchment polygon) */}
            {mapLayer === "cities" &&
              CITY_POINTS.filter((p) => !catchmentCityIds.has(p.cityId))
                .filter((p) => isCityAllowed(p.cityId))
                .map((p) => {
                const detail = cityScores[p.cityId];
                const fill = detail ? alphaColor(crisisColor(detail.score01), 0.35) : "rgba(148,163,184,0.35)";
                return (
                  <circle
                    key={`bubble-${p.cityId}`}
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={fill}
                    stroke="rgba(15,23,42,0.10)"
                    strokeWidth={1 / zoom}
                  />
                );
              })}

            {/* State borders on top */}
            {AU_STATES_GEOJSON.features.map((f) =>
              isStateAllowed(f.properties.id as StateId) ? (
                <path
                  key={`st-b-${f.properties.id}`}
                  d={polygonToPath(f.geometry)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2 / zoom}
                />
              ) : null
            )}

            {/* City centres (sharp) */}
            {CITY_POINTS.filter((p) => isCityAllowed(p.cityId)).map((p) => {
              const detail = cityScores[p.cityId];
              const col = detail ? crisisColor(detail.score01) : "#94a3b8";
              const name = cityMeta(p.cityId).name;
              return (
                <g
                  key={`pt-${p.cityId}`}
                  onMouseEnter={() => setHoverCity(p.cityId)}
                  onMouseLeave={() => setHoverCity(null)}
                  style={{ cursor: isPanning ? "grabbing" : "pointer" }}
                >
                  <circle cx={p.x} cy={p.y} r={6 / zoom} fill={col} stroke="#0f172a" strokeWidth={1 / zoom} />
                  <circle cx={p.x} cy={p.y} r={12 / zoom} fill="transparent" />
                  <title>{name}</title>
                </g>
              );
            })}

            {/* State labels */}
            {ALL_STATES.map((st) => {
              if (!isStateAllowed(st)) return null;
              const anchor: Record<StateId, { x: number; y: number }> = {
                WA: { x: 220, y: 210 },
                NT: { x: 505, y: 175 },
                SA: { x: 505, y: 430 },
                QLD: { x: 760, y: 190 },
                NSW: { x: 770, y: 500 },
                VIC: { x: 720, y: 660 },
                TAS: { x: 820, y: 730 },
                ACT: { x: 810, y: 560 },
              };
              const a = anchor[st];
              return (
                <text key={`lbl-${st}`} x={a.x} y={a.y} fontSize={14 / zoom} fill="#0f172a" style={{ fontWeight: 900 }}>
                  {st}
                </text>
              );
            })}

            </g>
          </svg>
        </div>

        <div className="card tone-neutral" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Selected year</div>
            <div style={{ fontWeight: 900 }}>{year}</div>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {mapLayer === "sa2"
              ? "Hover an SA2 region to see baseline (2024) data. SA2 is the most granular ABS geography."
              : mapLayer === "sa3"
                ? "Hover an SA3 region to see baseline (2024) data. Scores use the same crisis formula as city projections."
                : mapLayer === "sa4"
                  ? "Hover an SA4 region to see baseline (2024) data. SA4s are broader aggregations of SA3s."
                  : "Hover a city marker to see details. State shading is a population-weighted average of included cities."}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Legend</div>
            {[
              ["Low", "#16a34a"],
              ["Moderate", "#f59e0b"],
              ["Severe", "#f97316"],
              ["Extreme", "#dc2626"],
            ].map(([label, col]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}>
                <span style={{ width: 14, height: 14, background: col as string, borderRadius: 4, display: "inline-block", border: "1px solid #cbd5e1" }} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Hover details</div>
            {mapLayer === "sa2" && hoverSA2 ? (
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 900 }}>{hoverSA2.name}</div>
                <div className="muted">SA2 {hoverSA2.code} • {STATE_CODE_MAP[hoverSA2.state as keyof typeof STATE_CODE_MAP]} • SA3: {hoverSA2.parentSa3}</div>
                {hoverSA2.series2024 && hoverSA2Score != null ? (
                  <>
                    <div style={{ marginTop: 8 }}>
                      Crisis score: <strong>{Math.round(hoverSA2Score * 100)}/100</strong>
                    </div>
                    <div>
                      Median price: <strong>${(hoverSA2.series2024.medianPrice / 1000).toFixed(0)}k</strong>
                    </div>
                    <div>
                      Annual rent: <strong>${(hoverSA2.series2024.medianAnnualRent / 1000).toFixed(1)}k</strong>
                    </div>
                    <div>
                      Annual wage: <strong>${(hoverSA2.series2024.medianAnnualWage / 1000).toFixed(1)}k</strong>
                    </div>
                    <div>
                      Population: <strong>{(hoverSA2.series2024.population / 1000).toFixed(1)}k</strong>
                    </div>
                  </>
                ) : (
                  <div className="muted" style={{ marginTop: 8 }}>No baseline data</div>
                )}
              </div>
            ) : mapLayer === "sa4" && hoverSA4 ? (
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 900 }}>{hoverSA4.name}</div>
                <div className="muted">SA4 {hoverSA4.code} • {STATE_CODE_MAP[hoverSA4.state]}</div>
                {hoverSA4.series2024 && hoverSA4Score != null ? (
                  <>
                    <div style={{ marginTop: 8 }}>
                      Crisis score: <strong>{Math.round(hoverSA4Score * 100)}/100</strong>
                    </div>
                    <div>
                      Median price: <strong>${(hoverSA4.series2024.medianPrice / 1000).toFixed(0)}k</strong>
                    </div>
                    <div>
                      Annual rent: <strong>${(hoverSA4.series2024.medianAnnualRent / 1000).toFixed(1)}k</strong>
                    </div>
                    <div>
                      Annual wage: <strong>${(hoverSA4.series2024.medianAnnualWage / 1000).toFixed(1)}k</strong>
                    </div>
                    <div>
                      Population: <strong>{(hoverSA4.series2024.population / 1000).toFixed(1)}k</strong>
                    </div>
                  </>
                ) : (
                  <div className="muted" style={{ marginTop: 8 }}>No baseline data</div>
                )}
              </div>
            ) : mapLayer === "sa3" && hoverSA3 ? (
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 900 }}>{hoverSA3.name}</div>
                <div className="muted">SA3 {hoverSA3.code} • {STATE_CODE_MAP[hoverSA3.state]} • SA4: {hoverSA3.parentSa4}</div>
                {hoverSA3.series2024 && hoverSA3Score != null ? (
                  <>
                    <div style={{ marginTop: 8 }}>
                      Crisis score: <strong>{Math.round(hoverSA3Score * 100)}/100</strong>
                    </div>
                    <div>
                      Median price: <strong>${(hoverSA3.series2024.medianPrice / 1000).toFixed(0)}k</strong>
                    </div>
                    <div>
                      Annual rent: <strong>${(hoverSA3.series2024.medianAnnualRent / 1000).toFixed(1)}k</strong>
                    </div>
                    <div>
                      Annual wage: <strong>${(hoverSA3.series2024.medianAnnualWage / 1000).toFixed(1)}k</strong>
                    </div>
                    <div>
                      Population: <strong>{(hoverSA3.series2024.population / 1000).toFixed(1)}k</strong>
                    </div>
                  </>
                ) : (
                  <div className="muted" style={{ marginTop: 8 }}>No baseline data</div>
                )}
              </div>
            ) : hoverCity && hoverDetail ? (
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 900 }}>{cityMeta(hoverCity).name}</div>
                <div className="muted">{STATE_NAMES[cityMeta(hoverCity).state]}</div>
                <div style={{ marginTop: 8 }}>
                  Crisis score: <strong>{Math.round(hoverDetail.score01 * 100)}/100</strong>
                </div>
                <div>
                  Rent burden: <strong>{fmtPct(hoverDetail.rentBurden)}</strong>
                </div>
                <div>
                  Price-to-income: <strong>{fmt1(hoverDetail.priceToIncome)}×</strong>
                </div>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                {mapLayer === "sa2"
                  ? "Hover an SA2 region on the map."
                  : mapLayer === "sa3"
                    ? "Hover an SA3 region on the map."
                    : mapLayer === "sa4"
                      ? "Hover an SA4 region on the map."
                      : "Hover a city marker on the map."}
              </div>
            )}
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Note: Boundaries are a compact embedded GeoJSON schematic (state outlines + precomputed city catchment cells), intended to represent regional coverage rather than exact administrative borders.
          </div>
        </div>
      </div>
    </div>
  );
}

