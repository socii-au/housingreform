import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { CityId, StateId, Scope } from "../model/regions";
import { ALL_STATES, STATE_NAMES, cityMeta } from "../model/regions";
import type { ScenarioOutputs } from "../model/runScenario";
import type { ScenarioParams } from "../model/methodology";
import { computeCrisisScore, crisisColor } from "../model/crisisScore";
import type { HistoryBundle } from "../model/history/types";
import { sanitizeHistoryBundle } from "../security/sanitize";
import type { SA2Feature } from "./maps/sa2Data";
import type { SA3Feature } from "./maps/sa3Data";
import type { SA4Feature } from "./maps/sa4Data";

type CityPoint = {
  cityId: CityId;
  x: number;
  y: number;
  // A rough “catchment” radius in map units (not geo-accurate). Larger for capitals.
  r: number;
};

const VIEW = { w: 1000, h: 760 };

type AuGeoModule = typeof import("./maps/auGeo");
type Sa2Module = typeof import("./maps/sa2Data");
type Sa3Module = typeof import("./maps/sa3Data");
type Sa4Module = typeof import("./maps/sa4Data");

// City markers — projected from real lat/lon using:
//   x = round((lon − 112) × 20.5 + 40)
//   y = round((lat − 9.5) × 19.0 + 50)
const CITY_POINTS: CityPoint[] = [
  // ── WA ──
  { cityId: "PER", x: 119, y: 477, r: 78 },
  { cityId: "BUN", x: 115, y: 503, r: 42 },
  { cityId: "KAL", x: 234, y: 454, r: 34 },
  { cityId: "GER", x: 94, y: 416, r: 34 },
  { cityId: "ALB", x: 161, y: 535, r: 30 },
  { cityId: "BRO", x: 250, y: 211, r: 34 },
  { cityId: "KAR", x: 139, y: 264, r: 34 },
  { cityId: "PHD", x: 175, y: 255, r: 30 },
  { cityId: "NWM", x: 199, y: 313, r: 26 },
  { cityId: "TMP", x: 159, y: 301, r: 24 },

  // ── SA ──
  { cityId: "ADL", x: 585, y: 533, r: 64 },
  { cityId: "MTG", x: 630, y: 588, r: 28 },
  { cityId: "WHY", x: 563, y: 497, r: 26 },
  { cityId: "PLN", x: 529, y: 529, r: 26 },
  { cityId: "PPR", x: 573, y: 500, r: 24 },
  { cityId: "PAG", x: 569, y: 487, r: 24 },
  { cityId: "MBR", x: 599, y: 537, r: 24 },
  { cityId: "VHB", x: 586, y: 545, r: 22 },
  { cityId: "NRC", x: 629, y: 572, r: 22 },

  // ── NT ──
  { cityId: "DRW", x: 426, y: 106, r: 50 },
  { cityId: "ASP", x: 489, y: 320, r: 32 },
  { cityId: "KAT", x: 456, y: 144, r: 26 },
  { cityId: "TNC", x: 495, y: 243, r: 24 },

  // ── ACT ──
  { cityId: "CBR", x: 801, y: 540, r: 34 },

  // ── NSW ──
  { cityId: "SYD", x: 844, y: 513, r: 78 },
  { cityId: "NCL", x: 856, y: 495, r: 36 },
  { cityId: "PST", x: 861, y: 491, r: 28 },
  { cityId: "PMQ", x: 879, y: 467, r: 30 },
  { cityId: "TAR", x: 869, y: 476, r: 26 },
  { cityId: "FOS", x: 871, y: 481, r: 24 },
  { cityId: "KPS", x: 877, y: 460, r: 24 },
  { cityId: "NMB", x: 880, y: 452, r: 24 },
  { cityId: "COF", x: 883, y: 445, r: 30 },
  { cityId: "LSM", x: 886, y: 417, r: 28 },
  { cityId: "BLN", x: 892, y: 418, r: 24 },
  { cityId: "BYR", x: 893, y: 414, r: 22 },
  { cityId: "TWD", x: 892, y: 405, r: 24 },
  { cityId: "TMW", x: 838, y: 460, r: 28 },
  { cityId: "DBO", x: 791, y: 482, r: 28 },
  { cityId: "ORG", x: 801, y: 502, r: 24 },
  { cityId: "BTH", x: 810, y: 505, r: 24 },
  { cityId: "GOU", x: 813, y: 530, r: 24 },
  { cityId: "GRF", x: 738, y: 521, r: 24 },
  { cityId: "LET", x: 745, y: 526, r: 22 },
  { cityId: "WOL", x: 837, y: 524, r: 34 },
  { cityId: "NRA", x: 831, y: 532, r: 28 },
  { cityId: "CCS", x: 847, y: 503, r: 32 },
  { cityId: "ALW", x: 756, y: 555, r: 36 },
  { cityId: "WGA", x: 765, y: 537, r: 28 },

  // ── VIC ──
  { cityId: "MEL", x: 716, y: 588, r: 78 },
  { cityId: "GEL", x: 703, y: 594, r: 34 },
  { cityId: "BEN", x: 702, y: 568, r: 34 },
  { cityId: "BAL", x: 693, y: 583, r: 34 },
  { cityId: "SHP", x: 725, y: 561, r: 28 },
  { cityId: "MLD", x: 658, y: 519, r: 28 },
  { cityId: "WAR", x: 665, y: 599, r: 26 },
  { cityId: "TRG", x: 748, y: 595, r: 26 },
  { cityId: "HOR", x: 659, y: 567, r: 24 },
  { cityId: "WGR", x: 743, y: 560, r: 24 },
  { cityId: "SAL", x: 759, y: 594, r: 24 },

  // ── TAS ──
  { cityId: "HBA", x: 764, y: 684, r: 44 },
  { cityId: "LST", x: 760, y: 657, r: 32 },
  { cityId: "DVP", x: 744, y: 652, r: 26 },
  { cityId: "BUR", x: 735, y: 650, r: 24 },

  // ── QLD ──
  { cityId: "BNE", x: 881, y: 391, r: 70 },
  { cityId: "IPS", x: 876, y: 394, r: 36 },
  { cityId: "GC", x: 889, y: 402, r: 42 },
  { cityId: "SC", x: 882, y: 376, r: 42 },
  { cityId: "GYP", x: 874, y: 367, r: 28 },
  { cityId: "MBH", x: 874, y: 355, r: 26 },
  { cityId: "TWB", x: 859, y: 393, r: 34 },
  { cityId: "ROP", x: 830, y: 314, r: 34 },
  { cityId: "MKY", x: 802, y: 271, r: 36 },
  { cityId: "GLA", x: 845, y: 323, r: 30 },
  { cityId: "BDG", x: 867, y: 342, r: 28 },
  { cityId: "HVB", x: 877, y: 350, r: 28 },
  { cityId: "TSV", x: 753, y: 236, r: 42 },
  { cityId: "CNS", x: 732, y: 191, r: 38 },
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
  const [auGeo, setAuGeo] = useState<AuGeoModule | null>(null);
  const [sa2Data, setSa2Data] = useState<Sa2Module | null>(null);
  const [sa3Data, setSa3Data] = useState<Sa3Module | null>(null);
  const [sa4Data, setSa4Data] = useState<Sa4Module | null>(null);
  const [hoverCity, setHoverCity] = useState<CityId | null>(null);
  const [hoverSA2, setHoverSA2] = useState<SA2Feature | null>(null);
  const [hoverSA3, setHoverSA3] = useState<SA3Feature | null>(null);
  const [hoverSA4, setHoverSA4] = useState<SA4Feature | null>(null);
  useEffect(() => {
    let active = true;
    import("./maps/auGeo").then((m) => {
      if (active) setAuGeo(m);
    });
    return () => {
      active = false;
    };
  }, []);

  /* Load SA2/SA3/SA4 data for backend/model use; not shown on map UI */
  useEffect(() => {
    let active = true;
    import("./maps/sa2Data").then((m) => {
      if (active) setSa2Data(m);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    import("./maps/sa3Data").then((m) => {
      if (active) setSa3Data(m);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    import("./maps/sa4Data").then((m) => {
      if (active) setSa4Data(m);
    });
    return () => { active = false; };
  }, []);

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

  const polygonToPath = auGeo?.polygonToPath ?? (() => "");
  const auStates = auGeo?.AU_STATES_GEOJSON.features ?? [];
  const auSubregions = auGeo?.AU_STATE_SUBREGIONS_GEOJSON.features ?? [];
  const cityCatchments = auGeo?.AU_CITY_CATCHMENTS_GEOJSON.features ?? [];
  const subregionWeights = auGeo?.SUBREGION_WEIGHTS ?? {};
  const subregionBias = auGeo?.SUBREGION_ANCHOR_BIAS ?? {};
  const sa2Features = sa2Data?.SA2_FEATURES ?? [];
  const sa3Features = sa3Data?.SA3_FEATURES ?? [];
  const sa4Features = sa4Data?.SA4_FEATURES ?? [];
  const stateCodeMap = sa3Data?.STATE_CODE_MAP ?? ({} as Record<string, StateId>);
  const sa2PolygonToPath = sa2Data?.sa2PolygonToPath ?? (() => "");
  const sa3PolygonToPath = sa3Data?.sa3PolygonToPath ?? (() => "");
  const sa4PolygonToPath = sa4Data?.sa4PolygonToPath ?? (() => "");

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

  // Compute SA2 crisis scores (for backend use; not shown on map)
  const sa2Scores = useMemo(() => {
    const out = new Map<string, number | null>();
    if (!sa2Data) return out;
    sa2Data.SA2_FEATURES.forEach((f) => {
      out.set(f.code, sa2Data.computeSA2CrisisScore(f));
    });
    return out;
  }, [sa2Data]);

  // Compute SA3 crisis scores
  const sa3Scores = useMemo(() => {
    const out = new Map<string, number | null>();
    if (!sa3Data) return out;
    sa3Data.SA3_FEATURES.forEach((f) => {
      out.set(f.code, sa3Data.computeSA3CrisisScore(f));
    });
    return out;
  }, [sa3Data]);

  // Compute SA4 crisis scores
  const sa4Scores = useMemo(() => {
    const out = new Map<string, number | null>();
    if (!sa4Data) return out;
    sa4Data.SA4_FEATURES.forEach((f) => {
      out.set(f.code, sa4Data.computeSA4CrisisScore(f));
    });
    return out;
  }, [sa4Data]);

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
    if (!auGeo) return out;
    auGeo.AU_STATE_SUBREGIONS_GEOJSON.features.forEach((f) => {
      const weights = auGeo.SUBREGION_WEIGHTS[f.properties.id] ?? [];
      const st = f.properties.state as StateId;

      // Baseline: synthetic anchor bias applied to the state score (independent of city availability).
      // If state score is missing, assume neutral 0.50 so the map still renders structure.
      const stateBase = stateScores[st] ?? 0.5;
      const bias = auGeo.SUBREGION_ANCHOR_BIAS[f.properties.id] ?? 0;
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
  }, [auGeo, cityScores, stateScores, params.cities]);

  const hoverDetail = hoverCity ? cityScores[hoverCity] : null;
  const hoverSA2Score = hoverSA2 ? sa2Scores.get(hoverSA2.code) : null;
  const hoverSA3Score = hoverSA3 ? sa3Scores.get(hoverSA3.code) : null;
  const hoverSA4Score = hoverSA4 ? sa4Scores.get(hoverSA4.code) : null;

  const catchmentCityIds = useMemo(() => {
    if (!auGeo) return new Set<CityId>();
    return new Set(auGeo.AU_CITY_CATCHMENTS_GEOJSON.features.map((f) => f.properties.cityId as CityId));
  }, [auGeo]);

  const sa2Count = sa2Features.length;
  const sa3Count = sa3Features.length;
  const sa4Count = sa4Features.length;

  if (!auGeo) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <h2 className="h2" style={{ margin: 0 }}>{props.title ?? "National crisis heatmap"}</h2>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Loading map data…
        </div>
      </div>
    );
  }

  const mapTitle = props.title ?? "National crisis heatmap";
  const mapDescription = "Updates live when you hover across years in the charts. Scoring blends rent burden and price-to-income (shape-first).";

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="auCrisisMapLayout">
        <div className="auCrisisMapMapCol">
          {/* Mobile: title + description at top of map container */}
          <div className="auCrisisMapMobileHeader">
            <h2 className="h2" style={{ margin: 0 }}>{mapTitle}</h2>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{mapDescription}</div>
          </div>
        <div className="auCrisisMapMap" style={{ position: "relative", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", background: "white", width: "100%", aspectRatio: `${VIEW.w} / ${VIEW.h}` }}>
          {/* Zoom controls */}
          <div
            role="group"
            aria-label="Map zoom and pan"
            style={{
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
            }}
          >
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in (or use scroll wheel)"
              style={{
                width: 44,
                height: 44,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: zoom >= MAX_ZOOM ? "#e5e7eb" : "white",
                cursor: zoom >= MAX_ZOOM ? "not-allowed" : "pointer",
                fontSize: 18,
                fontWeight: 700,
                color: zoom >= MAX_ZOOM ? "#9ca3af" : "#0f172a",
              }}
            >
              +
            </button>
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out (or use scroll wheel)"
              style={{
                width: 44,
                height: 44,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: zoom <= MIN_ZOOM ? "#e5e7eb" : "white",
                cursor: zoom <= MIN_ZOOM ? "not-allowed" : "pointer",
                fontSize: 18,
                fontWeight: 700,
                color: zoom <= MIN_ZOOM ? "#9ca3af" : "#0f172a",
              }}
            >
              −
            </button>
            <button
              type="button"
              onClick={resetView}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              aria-label="Reset map view"
              style={{
                width: 44,
                height: 44,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: (zoom === 1 && pan.x === 0 && pan.y === 0) ? "#e5e7eb" : "white",
                cursor: (zoom === 1 && pan.x === 0 && pan.y === 0) ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: (zoom === 1 && pan.x === 0 && pan.y === 0) ? "#9ca3af" : "#0f172a",
              }}
            >
              ⟲
            </button>
            <div style={{
              fontSize: 10,
              textAlign: "center",
              color: "#6b7280",
              marginTop: 2,
            }} aria-hidden="true">
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

          {/* Year in bottom-right of map */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              zIndex: 10,
              fontSize: 14,
              fontWeight: 800,
              color: "var(--text)",
              background: "rgba(255,255,255,0.95)",
              padding: "6px 12px",
              borderRadius: 6,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            aria-hidden="true"
          >
            {year}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
            width="100%"
            height="100%"
            style={{ display: "block", verticalAlign: "top" }}
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
              {auStates.map((f) => (
                <clipPath key={f.properties.id} id={`clip-${f.properties.id}`}>
                  <path d={polygonToPath(f.geometry)} />
                </clipPath>
              ))}
            </defs>

            {/* Transform group for zoom and pan */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

            {/* State polygons (base fill) */}
            {auStates.map((f) => {
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
            {auSubregions.map((f) => {
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

            {/* City catchment mesh */}
            {cityCatchments.map((f) => {
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
            {CITY_POINTS.filter((p) => !catchmentCityIds.has(p.cityId))
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
            {auStates.map((f) =>
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
                WA: { x: 200, y: 350 },
                NT: { x: 465, y: 215 },
                SA: { x: 510, y: 440 },
                QLD: { x: 750, y: 290 },
                NSW: { x: 760, y: 480 },
                VIC: { x: 700, y: 575 },
                TAS: { x: 745, y: 672 },
                ACT: { x: 801, y: 540 },
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
        </div>

        <div className="card tone-neutral" style={{ padding: 12 }}>
          {/* Desktop: title + description above legend */}
          <div className="auCrisisMapLegendHeader">
            <h2 className="h2" style={{ margin: 0 }}>{mapTitle}</h2>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{mapDescription}</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Legend</div>
            <div className="auCrisisMapLegendItems">
              {[
                ["Low", "#16a34a"],
                ["Moderate", "#f59e0b"],
                ["Severe", "#f97316"],
                ["Extreme", "#dc2626"],
              ].map(([label, col]) => (
                <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: col as string, borderRadius: 3, flexShrink: 0, border: "1px solid #cbd5e1" }} />
                  <span>{label}</span>
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Hover details</div>
            {hoverCity && hoverDetail ? (
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
                Hover a city marker on the map.
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

