import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function computeCrisisScore(opts: { price: number; rent: number; wage: number }): number {
  const { price, rent, wage } = opts;
  if (!(price > 0 && rent > 0 && wage > 0)) return 0.5;
  const rentBurden = rent / wage;
  const pti = price / wage;
  const rentScore = clamp01((rentBurden - 0.25) / 0.15);
  const ptiScore = clamp01((pti - 6.0) / 6.0);
  return clamp01(0.6 * rentScore + 0.4 * ptiScore);
}

export const getGeometryChunk = query({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    scopeKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("asgsGeometryChunks")
      .withIndex("by_scope", (q) => q.eq("edition", args.edition).eq("level", args.level).eq("scopeKey", args.scopeKey))
      .unique();
  },
});

export const getLayer = query({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    metric: v.string(),
    year: v.number(),
    scopeKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("asgsLayerCache")
      .withIndex("by_layer", (q) =>
        q.eq("edition", args.edition).eq("level", args.level).eq("metric", args.metric).eq("year", args.year).eq("scopeKey", args.scopeKey)
      )
      .unique();
  },
});

export const listAvailableYears = query({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("asgsSeriesDerived")
      .filter((q) => q.eq(q.field("edition"), args.edition))
      .filter((q) => q.eq(q.field("level"), args.level))
      .take(5000);
    const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b);
    return years;
  },
});

export const listScopes = query({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("asgsRegions")
      .withIndex("by_level_state", (q) => q.eq("edition", args.edition).eq("level", args.level))
      .take(5000);

    const states = Array.from(
      new Set(rows.map((r) => r.state).filter((s) => typeof s === "string" && s.length > 0 && s !== "UNKNOWN"))
    ).sort();
    const sa4s = Array.from(
      new Set(rows.map((r) => r.parentSa4).filter((x): x is string => typeof x === "string" && x.length > 0))
    ).sort();

    return { states, sa4s };
  },
});

export const upsertRegions = mutation({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    regions: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        state: v.string(),
        parentSa4: v.optional(v.string()),
        centroid: v.object({ x: v.number(), y: v.number() }),
        bbox: v.object({ minX: v.number(), minY: v.number(), maxX: v.number(), maxY: v.number() }),
      })
    ),
  },
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    for (const r of args.regions) {
      const existing = await ctx.db
        .query("asgsRegions")
        .withIndex("by_level_code", (q) => q.eq("edition", args.edition).eq("level", args.level).eq("code", r.code))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...r, updatedAt });
      } else {
        await ctx.db.insert("asgsRegions", { edition: args.edition, level: args.level, ...r, updatedAt });
      }
    }
    return { ok: true, count: args.regions.length };
  },
});

export const upsertGeometryChunk = mutation({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    scopeKey: v.string(),
    data: v.any(),
    featureCount: v.number(),
    bbox: v.object({ minX: v.number(), minY: v.number(), maxX: v.number(), maxY: v.number() }),
  },
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const existing = await ctx.db
      .query("asgsGeometryChunks")
      .withIndex("by_scope", (q) => q.eq("edition", args.edition).eq("level", args.level).eq("scopeKey", args.scopeKey))
      .unique();
    const payload = { ...args, updatedAt };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { ok: true, updated: true };
    }
    await ctx.db.insert("asgsGeometryChunks", payload);
    return { ok: true, created: true };
  },
});

export const upsertSeriesRawBatch = mutation({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    rows: v.array(
      v.object({
        code: v.string(),
        year: v.number(),
        medianPrice: v.optional(v.number()),
        medianAnnualRent: v.optional(v.number()),
        medianAnnualWage: v.optional(v.number()),
        population: v.optional(v.number()),
        dwellingStock: v.optional(v.number()),
        source: v.optional(v.string()),
        imputed: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    for (const r of args.rows) {
      const existing = await ctx.db
        .query("asgsSeriesRaw")
        .withIndex("by_key", (q) => q.eq("edition", args.edition).eq("level", args.level).eq("code", r.code).eq("year", r.year))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...r, updatedAt });
      } else {
        await ctx.db.insert("asgsSeriesRaw", { edition: args.edition, level: args.level, ...r, updatedAt });
      }
    }
    return { ok: true, count: args.rows.length };
  },
});

export const recomputeDerivedForYear = mutation({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const raws = await ctx.db
      .query("asgsSeriesRaw")
      .filter((q) => q.eq(q.field("edition"), args.edition))
      .filter((q) => q.eq(q.field("level"), args.level))
      .filter((q) => q.eq(q.field("year"), args.year))
      .take(5000);

    for (const r of raws) {
      const price = r.medianPrice ?? 0;
      const rent = r.medianAnnualRent ?? 0;
      const wage = r.medianAnnualWage ?? 0;
      const rentBurden = wage > 0 ? rent / wage : 0;
      const priceToIncome = wage > 0 ? price / wage : 0;
      const crisisScore = computeCrisisScore({ price, rent, wage });
      const confidence01 = r.imputed ? 0.55 : 0.9;

      const existing = await ctx.db
        .query("asgsSeriesDerived")
        .withIndex("by_key", (q) =>
          q.eq("edition", args.edition).eq("level", args.level).eq("code", r.code).eq("year", args.year)
        )
        .unique();
      const payload = {
        edition: args.edition,
        level: args.level,
        code: r.code,
        year: args.year,
        rentBurden,
        priceToIncome,
        crisisScore,
        confidence01,
        updatedAt,
      };
      if (existing) await ctx.db.patch(existing._id, payload);
      else await ctx.db.insert("asgsSeriesDerived", payload);
    }

    return { ok: true, derivedCount: raws.length };
  },
});

export const recomputeLayerCacheForYear = mutation({
  args: {
    edition: v.number(),
    level: v.union(v.literal("SA3"), v.literal("SA4")),
    metric: v.string(),
    year: v.number(),
    scopeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const rows = await ctx.db
      .query("asgsSeriesDerived")
      .filter((q) => q.eq(q.field("edition"), args.edition))
      .filter((q) => q.eq(q.field("level"), args.level))
      .filter((q) => q.eq(q.field("year"), args.year))
      .take(5000);

    // Scope filtering uses asgsRegions metadata (code -> state/parentSa4).
    const regions = await ctx.db
      .query("asgsRegions")
      .withIndex("by_level_state", (q) => q.eq("edition", args.edition).eq("level", args.level))
      .take(5000);
    const metaByCode = new Map<string, { state: string; parentSa4?: string }>();
    regions.forEach((r) => metaByCode.set(r.code, { state: r.state, parentSa4: r.parentSa4 }));

    const keep = (code: string): boolean => {
      if (args.scopeKey === "NATIONAL") return true;
      if (args.scopeKey.startsWith("STATE:")) {
        const st = args.scopeKey.replace("STATE:", "");
        return metaByCode.get(code)?.state === st;
      }
      if (args.scopeKey.startsWith("SA4:")) {
        const sa4 = args.scopeKey.replace("SA4:", "");
        return metaByCode.get(code)?.parentSa4 === sa4;
      }
      return false;
    };

    const values: any[] = [];
    for (const r of rows) {
      const v0 = (r as any)[args.metric];
      if (typeof v0 !== "number" || !Number.isFinite(v0)) continue;
      if (!keep(r.code)) continue;
      values.push([r.code, v0]);
    }

    const existing = await ctx.db
      .query("asgsLayerCache")
      .withIndex("by_layer", (q) =>
        q.eq("edition", args.edition).eq("level", args.level).eq("metric", args.metric).eq("year", args.year).eq("scopeKey", args.scopeKey)
      )
      .unique();

    const payload = { edition: args.edition, level: args.level, metric: args.metric, year: args.year, scopeKey: args.scopeKey, values, updatedAt };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("asgsLayerCache", payload);

    return { ok: true, valueCount: values.length };
  },
});

