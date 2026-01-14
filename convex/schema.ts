import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ASGS 2026 SA3-first schema.
 *
 * Notes:
 * - We store "projected" geometry (already converted into a screen coordinate system)
 *   so the client can render without heavy geo/projection libraries.
 * - We chunk geometry and layers so this scales to SA2 later.
 */
export default defineSchema({
  asgsRegions: defineTable({
    edition: v.number(), // 2026
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    code: v.string(), // ABS code as string
    name: v.string(),
    state: v.string(), // "NSW" etc
    parentSa4: v.optional(v.string()),
    centroid: v.object({ x: v.number(), y: v.number() }),
    bbox: v.object({ minX: v.number(), minY: v.number(), maxX: v.number(), maxY: v.number() }),
    updatedAt: v.number(),
  })
    .index("by_level_code", ["edition", "level", "code"])
    .index("by_level_state", ["edition", "level", "state"])
    .index("by_level_parent", ["edition", "level", "parentSa4"]),

  asgsGeometryChunks: defineTable({
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    // e.g. "NATIONAL", "STATE:NSW", "SA4:206" (future)
    scopeKey: v.string(),
    // Projected polygons: FeatureCollection-like payload, but kept minimal.
    // data is expected to be <= ~900KB. Chunk if larger.
    data: v.any(),
    featureCount: v.number(),
    bbox: v.object({ minX: v.number(), minY: v.number(), maxX: v.number(), maxY: v.number() }),
    updatedAt: v.number(),
  }).index("by_scope", ["edition", "level", "scopeKey"]),

  asgsSeriesRaw: defineTable({
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    code: v.string(),
    year: v.number(),
    // Core economic series (nominal, AUD).
    medianPrice: v.optional(v.number()),
    medianAnnualRent: v.optional(v.number()),
    medianAnnualWage: v.optional(v.number()),
    population: v.optional(v.number()),
    dwellingStock: v.optional(v.number()),
    // provenance / imputation flags
    source: v.optional(v.string()),
    imputed: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_key", ["edition", "level", "code", "year"]),

  asgsSeriesDerived: defineTable({
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    code: v.string(),
    year: v.number(),
    rentBurden: v.number(), // annual rent / annual wage
    priceToIncome: v.number(), // price / annual wage
    crisisScore: v.number(), // 0..1
    confidence01: v.number(), // 0..1 (imputation-aware, optional)
    updatedAt: v.number(),
  }).index("by_key", ["edition", "level", "code", "year"]),

  asgsLayerCache: defineTable({
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    metric: v.string(), // e.g. "crisisScore"
    year: v.number(),
    scopeKey: v.string(), // "NATIONAL" or "STATE:NSW"
    // array of [code, value] pairs to keep JSON compact & stable
    values: v.array(v.array(v.any())),
    updatedAt: v.number(),
  }).index("by_layer", ["edition", "level", "metric", "year", "scopeKey"]),
});

