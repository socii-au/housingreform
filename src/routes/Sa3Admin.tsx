import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getConvexUrl } from "../convexClient";
import { isPlainObject } from "../security/sanitize";

type Pt = [number, number];

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function sanitizeRing(ring: unknown, opts?: { maxPoints?: number }): Pt[] | null {
  if (!Array.isArray(ring)) return null;
  const maxPoints = Math.max(50, Math.floor(opts?.maxPoints ?? 10_000));
  const out: Pt[] = [];
  for (let i = 0; i < ring.length && out.length < maxPoints; i++) {
    const p = ring[i];
    if (!Array.isArray(p) || p.length < 2) continue;
    const x = p[0];
    const y = p[1];
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) continue;
    out.push([x, y]);
  }
  if (out.length < 3) return null;
  return out;
}

function bboxOfRing(ring: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  ring.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function centroidOfRing(ring: Pt[]): { x: number; y: number } {
  // Simple average (good enough for UI centroids).
  let sx = 0;
  let sy = 0;
  ring.forEach(([x, y]) => {
    sx += x;
    sy += y;
  });
  const n = Math.max(1, ring.length);
  return { x: sx / n, y: sy / n };
}

function mergeBbox(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export function Sa3Admin() {
  const convexUrl = getConvexUrl();
  const edition = 2026;
  const [level, setLevel] = useState<"SA3" | "SA4">("SA3");
  const scopeKey = "NATIONAL";

  const upsertGeometryChunk = useMutation(api.asgs.upsertGeometryChunk as any);
  const upsertRegions = useMutation(api.asgs.upsertRegions as any);
  const upsertSeriesRawBatch = useMutation(api.asgs.upsertSeriesRawBatch as any);
  const recomputeDerivedForYear = useMutation(api.asgs.recomputeDerivedForYear as any);
  const recomputeLayerCacheForYear = useMutation(api.asgs.recomputeLayerCacheForYear as any);

  const [geomText, setGeomText] = useState<string>("");
  const [metaText, setMetaText] = useState<string>("");
  const [seriesText, setSeriesText] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const appendLog = (s: string) => setLog((xs) => [s, ...xs].slice(0, 200));

  const parsedGeom = useMemo(() => safeJsonParse(geomText), [geomText]);
  const geomFeatures = useMemo(() => {
    const g = parsedGeom as any;
    const data = g?.data?.features ? g.data : g;
    const features = data?.features;
    if (!Array.isArray(features)) return [];
    const out: Array<{ code: string; name: string; polygon: Pt[] }> = [];
    features.forEach((f: any) => {
      if (!isPlainObject(f)) return;
      const code = typeof f.code === "string" ? f.code : null;
      const name = typeof f.name === "string" ? f.name : code;
      const ring = sanitizeRing(f.polygon);
      if (!code || !ring) return;
      out.push({ code, name: name ?? code, polygon: ring });
    });
    return out;
  }, [parsedGeom]);

  const parsedMeta = useMemo(() => safeJsonParse(metaText), [metaText]);
  const regionMetaByCode = useMemo(() => {
    const m = new Map<string, { state?: string; parentSa4?: string; name?: string }>();
    if (!Array.isArray(parsedMeta)) return m;
    parsedMeta.forEach((r: any) => {
      if (!isPlainObject(r)) return;
      const code = typeof r.code === "string" ? r.code : null;
      if (!code) return;
      const state = typeof r.state === "string" ? r.state : undefined;
      const parentSa4 = typeof r.parentSa4 === "string" ? r.parentSa4 : undefined;
      const name = typeof r.name === "string" ? r.name : undefined;
      m.set(code, { state, parentSa4, name });
    });
    return m;
  }, [parsedMeta]);

  const parsedSeries = useMemo(() => safeJsonParse(seriesText), [seriesText]);
  const seriesRows = useMemo(() => {
    if (!Array.isArray(parsedSeries)) return [];
    const out: Array<{
      code: string;
      year: number;
      medianPrice?: number;
      medianAnnualRent?: number;
      medianAnnualWage?: number;
      population?: number;
      dwellingStock?: number;
      source?: string;
      imputed?: boolean;
    }> = [];
    parsedSeries.forEach((r: any) => {
      if (!isPlainObject(r)) return;
      const code = typeof r.code === "string" ? r.code : null;
      const year = typeof r.year === "number" ? r.year : typeof r.year === "string" ? Number(r.year) : NaN;
      if (!code || !Number.isFinite(year)) return;
      const pick = (k: string) => {
        const v = r[k];
        const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
        return Number.isFinite(n) ? n : undefined;
      };
      out.push({
        code,
        year: Math.round(year),
        medianPrice: pick("medianPrice"),
        medianAnnualRent: pick("medianAnnualRent"),
        medianAnnualWage: pick("medianAnnualWage"),
        population: pick("population"),
        dwellingStock: pick("dwellingStock"),
        source: typeof r.source === "string" ? r.source.slice(0, 80) : undefined,
        imputed: typeof r.imputed === "boolean" ? r.imputed : undefined,
      });
    });
    return out;
  }, [parsedSeries]);

  const yearsInSeries = useMemo(() => Array.from(new Set(seriesRows.map((r) => r.year))).sort((a, b) => a - b), [seriesRows]);

  const ingestGeometry = async () => {
    if (!convexUrl) return;
    if (geomFeatures.length === 0) {
      appendLog("No valid geometry features found.");
      return;
    }
    setBusy(true);
    try {
      let bbox = bboxOfRing(geomFeatures[0].polygon);
      geomFeatures.forEach((f) => {
        bbox = mergeBbox(bbox, bboxOfRing(f.polygon));
      });
      const data = { features: geomFeatures.map((f) => ({ code: f.code, name: f.name, polygon: f.polygon })) };
      await upsertGeometryChunk({ edition, level, scopeKey, data, featureCount: geomFeatures.length, bbox });
      appendLog(`Upserted geometry chunk: ${geomFeatures.length} features (${scopeKey}).`);

      // Also upsert regions (centroids + bbox) for later filtering/aggregation.
      const regions = geomFeatures.map((f) => {
        const bb = bboxOfRing(f.polygon);
        const meta = regionMetaByCode.get(f.code);
        return {
          code: f.code,
          name: meta?.name ?? f.name,
          state: meta?.state ?? "UNKNOWN",
          parentSa4: meta?.parentSa4,
          centroid: centroidOfRing(f.polygon),
          bbox: bb,
        };
      });
      await upsertRegions({ edition, level, regions });
      appendLog(`Upserted regions: ${regions.length}. (state/parentSa4 applied where provided)`);
    } catch (e: any) {
      appendLog(`Geometry ingest failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const ingestSeries = async () => {
    if (!convexUrl) return;
    if (seriesRows.length === 0) {
      appendLog("No valid series rows found.");
      return;
    }
    setBusy(true);
    try {
      const batches = chunk(seriesRows, 1000);
      for (let i = 0; i < batches.length; i++) {
        await upsertSeriesRawBatch({ edition, level, rows: batches[i] });
        appendLog(`Upserted series batch ${i + 1}/${batches.length} (${batches[i].length} rows).`);
      }
    } catch (e: any) {
      appendLog(`Series ingest failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const recomputeForYear = async (y: number) => {
    if (!convexUrl) return;
    setBusy(true);
    try {
      await recomputeDerivedForYear({ edition, level, year: y });
      appendLog(`Recomputed derived metrics for ${y}.`);
      await recomputeLayerCacheForYear({ edition, level, metric: "crisisScore", year: y, scopeKey: "NATIONAL" });
      appendLog(`Recomputed layer cache (crisisScore) for ${y}.`);
    } catch (e: any) {
      appendLog(`Recompute failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const recomputeForYearWithScopes = async (y: number) => {
    if (!convexUrl) return;
    setBusy(true);
    try {
      await recomputeDerivedForYear({ edition, level, year: y });
      appendLog(`Recomputed derived metrics for ${y}.`);

      const states = Array.from(
        new Set(Array.from(regionMetaByCode.values()).map((m) => m.state).filter(Boolean))
      ) as string[];
      const sa4s = Array.from(
        new Set(Array.from(regionMetaByCode.values()).map((m) => m.parentSa4).filter(Boolean))
      ) as string[];

      // Always do national first.
      await recomputeLayerCacheForYear({ edition, level, metric: "crisisScore", year: y, scopeKey: "NATIONAL" });
      appendLog(`Cached NATIONAL crisisScore for ${y}.`);

      for (const st of states) {
        // eslint-disable-next-line no-await-in-loop
        await recomputeLayerCacheForYear({ edition, level, metric: "crisisScore", year: y, scopeKey: `STATE:${st}` });
      }
      if (states.length) appendLog(`Cached ${states.length} STATE layers for ${y}.`);

      if (level === "SA3") {
        for (const sa4 of sa4s) {
          // eslint-disable-next-line no-await-in-loop
          await recomputeLayerCacheForYear({ edition, level, metric: "crisisScore", year: y, scopeKey: `SA4:${sa4}` });
        }
        if (sa4s.length) appendLog(`Cached ${sa4s.length} SA4 layers for ${y}.`);
      }
    } catch (e: any) {
      appendLog(`Recompute failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const recomputeAll = async () => {
    for (const y of yearsInSeries) {
      // eslint-disable-next-line no-await-in-loop
      await recomputeForYear(y);
    }
  };

  return (
    <div>
      <div className="h1">ASGS Admin (Convex ingest)</div>
      <p className="muted" style={{ marginTop: 0 }}>
        Paste projected geometry and raw series rows for {level === "SA3" ? "SA3" : "SA4"} regions, then recompute derived
        metrics and cached layers.
      </p>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>Level</div>
          <select className="select-field" value={level} onChange={(e) => setLevel(e.target.value as any)} style={{ minWidth: 160 }}>
            <option value="SA3">SA3</option>
            <option value="SA4">SA4</option>
          </select>
          <div className="muted" style={{ fontSize: 12 }}>
            Ingest geometry/metadata/series for the selected level. (Run SA3 and SA4 separately.)
          </div>
        </div>
      </div>

      {!convexUrl ? (
        <div className="callout warning" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Convex not configured</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Set <code>VITE_CONVEX_URL</code> in your env to enable ingestion.
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          1) {level === "SA3" ? "SA3" : "SA4"} Geometry chunk (scopeKey=NATIONAL)
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Expected: <code>{`{ features: [{ code, name, polygon: [[x,y],...] }] }`}</code> (or wrapped in{" "}
          <code>{`{ data: { features: [...] } }`}</code>).
        </div>
        <textarea
          value={geomText}
          onChange={(e) => setGeomText(e.target.value)}
          placeholder='Paste geometry JSON here...'
          style={{ width: "100%", minHeight: 180, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" disabled={!convexUrl || busy} onClick={ingestGeometry}>
            Ingest geometry ({geomFeatures.length} features)
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            This also upserts region stubs (centroid + bbox). {level === "SA3" ? "State + parent SA4" : "State"} can be applied
            via metadata below.
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          1b) {level === "SA3" ? "SA3" : "SA4"} metadata (state {level === "SA3" ? "+ parent SA4" : ""})
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          {level === "SA3" ? (
            <>
              Expected: <code>{`[{ code, state, parentSa4?, name? }]`}</code> — Attaches state+SA4 linkage to each SA3 for scope
              filtering.
            </>
          ) : (
            <>
              Expected: <code>{`[{ code, state, name? }]`}</code> — SA4s are already top-level regions, so no <code>parentSa4</code>{" "}
              needed.
            </>
          )}
        </div>
        <textarea
          value={metaText}
          onChange={(e) => setMetaText(e.target.value)}
          placeholder={
            level === "SA3"
              ? '[{ "code": "...", "state": "NSW", "parentSa4": "206", "name": "..." }]'
              : '[{ "code": "206", "state": "NSW", "name": "Greater Sydney" }]'
          }
          style={{ width: "100%", minHeight: 140, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
        />
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Parsed metadata entries: {regionMetaByCode.size}. Paste this <em>before</em> ingesting geometry so state linkage applies
          immediately.
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          2) {level === "SA3" ? "SA3" : "SA4"} Raw series rows
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Expected: JSON array of{" "}
          <code>{`{ code, year, medianPrice, medianAnnualRent, medianAnnualWage, population, dwellingStock }`}</code>.
        </div>
        <textarea
          value={seriesText}
          onChange={(e) => setSeriesText(e.target.value)}
          placeholder='Paste series JSON array here...'
          style={{ width: "100%", minHeight: 180, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" disabled={!convexUrl || busy} onClick={ingestSeries}>
            Ingest series ({seriesRows.length} rows)
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            Years detected: {yearsInSeries.length ? yearsInSeries.join(", ") : "none"}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>3) Recompute derived + cache</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" disabled={!convexUrl || busy || yearsInSeries.length === 0} onClick={() => recomputeForYear(yearsInSeries[yearsInSeries.length - 1])}>
            Recompute latest year
          </button>
          <button
            type="button"
            disabled={!convexUrl || busy || yearsInSeries.length === 0}
            onClick={() => recomputeForYearWithScopes(yearsInSeries[yearsInSeries.length - 1])}
          >
            Recompute latest year (NATIONAL + STATE{level === "SA3" ? " + SA4" : ""})
          </button>
          <button type="button" disabled={!convexUrl || busy || yearsInSeries.length === 0} onClick={recomputeAll}>
            Recompute all years ({yearsInSeries.length})
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Layer cache supports scopeKey=NATIONAL and STATE:XX for any level. For SA3 only, it also supports SA4:CODE (using parentSa4).
        </div>
      </div>

      <div className="card tone-neutral" style={{ padding: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Log</div>
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
          {(log.length ? log : ["(no events yet)"]).join("\n")}
        </div>
      </div>
    </div>
  );
}

