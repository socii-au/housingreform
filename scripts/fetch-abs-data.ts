/**
 * Fetch ABS/open datasets and normalize to the expected raw inputs for import-abs-history.
 *
 * Usage: npx tsx scripts/fetch-abs-data.ts
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import { CITIES, type CityMeta, type StateId } from "../src/model/regions";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DIR = path.join(__dirname, "..", "data", "abs", "raw");

const ARC = "https://geo.abs.gov.au/arcgis/rest/services/Hosted";

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json,text/plain,*/*",
          "Accept-Language": "en-AU,en;q=0.9",
          "Referer": "https://geo.abs.gov.au/",
          "Origin": "https://geo.abs.gov.au",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function fetchJson(url: string): Promise<any> {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "\"" && inQuotes && next === "\"") {
      cur += "\"";
      i++;
      continue;
    }
    if (ch === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur);
        rows.push(row.map((c) => c.trim()));
        row = [];
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row.map((c) => c.trim()));
  }
  return rows.filter((r) => r.length > 1);
}

function toNum(x: string | undefined): number | null {
  if (!x) return null;
  const n = Number(String(x).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function writeCsv(pathOut: string, rows: string[][]) {
  const text = rows.map((r) => r.map((c) => (c.includes(",") ? `"${c.replace(/\"/g, "\"\"")}"` : c)).join(",")).join("\n");
  fs.writeFileSync(pathOut, text, "utf8");
}

function isProbablyCsv(text: string): boolean {
  if (!text) return false;
  if (text.includes("<html") || text.includes("<!DOCTYPE")) return false;
  const lines = text.split(/\r?\n/).slice(0, 3);
  return lines.some((l) => l.includes(","));
}

async function fetchArcgisAllFeatures(opts: {
  serviceUrl: string;
  outFields: string[];
  returnCentroid?: boolean;
}): Promise<any[]> {
  const { serviceUrl, outFields } = opts;
  const base = `${serviceUrl}/query`;
  const page = 2000;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const url =
      `${base}?where=1%3D1&outFields=${encodeURIComponent(outFields.join(","))}` +
      `&returnGeometry=false&f=json&resultOffset=${offset}&resultRecordCount=${page}` +
      (opts.returnCentroid ? "&returnCentroid=true" : "");
    const json = await fetchJson(url);
    const feats = json.features || [];
    all.push(...feats);
    if (!json.exceededTransferLimit || feats.length === 0) break;
    offset += page;
  }
  return all;
}

async function buildSa3Income() {
  const serviceUrl = `${ARC}/ABS_Income_including_government_allowances_by_2021_SA2/FeatureServer/0`;
  const feats = await fetchArcgisAllFeatures({
    serviceUrl,
    outFields: ["sa2_code_2021", "equiv_22021"],
  });
  const out = [["SA2_CODE", "YEAR", "MEDIAN_WEEKLY_HH_INCOME", "POP"]];
  feats.forEach((f) => {
    const code = f.attributes?.sa2_code_2021;
    const val = f.attributes?.equiv_22021;
    if (!code || val == null) return;
    out.push([String(code), "2021", String(val), ""]);
  });
  writeCsv(path.join(RAW_DIR, "sa2_income.csv"), out);
}

function parseRentBins(fields: Array<{ name: string; alias?: string }>) {
  const bins: Array<{ field: string; low: number; high: number | null }> = [];
  fields.forEach((f) => {
    const name = f.name;
    if (!/^r_/.test(name) || !/_tot$/.test(name)) return;
    const m = name.match(/^r_(\\d+)(?:_(\\d+))?_tot$/);
    if (m) {
      const low = Number(m[1]);
      const high = m[2] ? Number(m[2]) : null;
      bins.push({ field: name, low, high });
    } else if (/over/i.test(name)) {
      const lo = Number((name.match(/r_(\\d+)/) || [])[1]);
      if (Number.isFinite(lo)) bins.push({ field: name, low: lo, high: null });
    }
  });
  return bins.sort((a, b) => a.low - b.low);
}

function medianFromBins(bins: Array<{ low: number; high: number | null; count: number }>): number | null {
  const total = bins.reduce((s, b) => s + b.count, 0);
  if (!total) return null;
  const target = total / 2;
  let acc = 0;
  for (let i = 0; i < bins.length; i++) {
    const b = bins[i];
    acc += b.count;
    if (acc >= target) {
      const prev = bins[i - 1];
      const width = b.high != null ? b.high - b.low : prev ? (prev.high ?? prev.low) - prev.low : b.low * 0.25;
      const high = b.high != null ? b.high : b.low + width;
      return (b.low + high) / 2;
    }
  }
  return null;
}

async function buildSa2Rent() {
  const serviceUrl = `${ARC}/ABS_2021_Census_G40_SA2/FeatureServer/0`;
  const meta = await fetchJson(`${serviceUrl}?f=pjson`);
  const bins = parseRentBins(meta.fields || []);
  const outFields = ["sa2_code_2021", ...bins.map((b) => b.field)];
  const feats = await fetchArcgisAllFeatures({ serviceUrl, outFields });
  const out = [["SA2_CODE", "YEAR", "MEDIAN_WEEKLY_RENT", "POP"]];
  feats.forEach((f) => {
    const code = f.attributes?.sa2_code_2021;
    if (!code) return;
    const counts = bins.map((b) => ({
      low: b.low,
      high: b.high,
      count: Number(f.attributes?.[b.field] ?? 0),
    }));
    const med = medianFromBins(counts);
    if (med == null) return;
    out.push([String(code), "2021", String(Math.round(med)), ""]);
  });
  writeCsv(path.join(RAW_DIR, "sa2_rent.csv"), out);
}

function stateFromSa2Code(code: string): StateId | null {
  const c = String(code)[0];
  switch (c) {
    case "1": return "NSW";
    case "2": return "VIC";
    case "3": return "QLD";
    case "4": return "SA";
    case "5": return "WA";
    case "6": return "TAS";
    case "7": return "NT";
    case "8": return "ACT";
    default: return null;
  }
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CITY_NAME_ALIASES: Record<string, string[]> = {
  ALW: ["albury", "wodonga"],
  CCS: ["central coast"],
  GC: ["gold coast"],
  SC: ["sunshine coast"],
  MBH: ["maryborough"],
  GYP: ["gympie"],
  ROP: ["rockhampton"],
  MKY: ["mackay"],
  GLA: ["gladstone"],
  TSV: ["townsville"],
  CNS: ["cairns"],
  DVP: ["devonport"],
  VHB: ["victor harbor", "victor harbour"],
  FOS: ["forster", "tuncurry"],
  PST: ["port stephens"],
  PMQ: ["port macquarie"],
  TWD: ["tweed heads", "tweed"],
  BYR: ["byron bay"],
  NCL: ["newcastle"],
  WOL: ["wollongong"],
  WGA: ["wagga"],
  PHD: ["port hedland"],
  TMP: ["tom price"],
  NWM: ["newman"],
  KAL: ["kalgoorlie", "boulder", "kalgoorlie-boulder"],
  BUN: ["bunbury", "busselton"],
  GER: ["geraldton", "mid west"],
  ALB: ["albany", "great southern"],
  BRO: ["broome", "kimberley"],
  KAR: ["karratha", "roebourne", "pilbara"],
  WHY: ["whyalla", "upper spencer gulf"],
  PLN: ["port lincoln", "lower eyre"],
  PPR: ["port pirie", "flinders ranges"],
  PAG: ["port augusta", "far north"],
  MBR: ["murray bridge", "murraylands"],
  NRC: ["naracoorte", "limestone coast"],
  MTG: ["mount gambier", "mt gambier"],
  LST: ["launceston", "west tamar"],
  HBA: ["hobart", "southern tasmania"],
  KAT: ["katherine", "roper gulf"],
  TNC: ["tennant creek", "barkly"],
  ASP: ["alice springs", "macdonnell"],
  COF: ["coffs harbour", "coffs"],
  LSM: ["lismore", "richmond valley"],
  TMW: ["tamworth", "peel"],
  DBO: ["dubbo", "western plains"],
  ORG: ["orange", "central west"],
  BTH: ["bathurst", "bathurst-regional"],
  GOU: ["goulburn", "goulburn-mulwaree"],
  GRF: ["griffith", "murrumbidgee"],
  LET: ["leeton", "riverina"],
  NMB: ["nambucca", "nambucca valley"],
  KPS: ["kempsey", "kempsey shire"],
  TAR: ["taree", "mid north coast"],
  FOS: ["forster", "tuncurry", "great lakes"],
  NRA: ["nowra", "shoalhaven", "south coast"],
  BLN: ["ballina", "ballina shire"],
};

async function buildSa2CityMap() {
  const serviceUrl = "https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA2/FeatureServer/0";
  const feats = await fetchArcgisAllFeatures({
    serviceUrl,
    outFields: ["sa2_code_2021", "sa2_name_2021"],
    returnCentroid: true,
  });

  const sa2 = feats
    .map((f) => ({
      code: String(f.attributes?.sa2_code_2021 ?? ""),
      name: String(f.attributes?.sa2_name_2021 ?? ""),
      centroid: f.centroid as { x: number; y: number } | undefined,
    }))
    .filter((r) => r.code && r.centroid);

  const cityCentroids: Record<string, { x: number; y: number; state: StateId }> = {};
  const cityByState = new Map<StateId, CityMeta[]>();
  CITIES.forEach((c) => {
    cityByState.set(c.state, [...(cityByState.get(c.state) || []), c]);
  });

  const sa3Service = "https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA3/FeatureServer/0";
  const sa3Feats = await fetchArcgisAllFeatures({
    serviceUrl: sa3Service,
    outFields: ["sa3_code_2021", "sa3_name_2021"],
    returnCentroid: true,
  });
  const sa3 = sa3Feats
    .map((f) => ({
      code: String(f.attributes?.sa3_code_2021 ?? ""),
      name: String(f.attributes?.sa3_name_2021 ?? ""),
      centroid: f.centroid as { x: number; y: number } | undefined,
    }))
    .filter((r) => r.code && r.centroid);

  const wordMatch = (hay: string, needle: string) => {
    if (!needle) return false;
    const h = ` ${normName(hay)} `;
    const n = ` ${normName(needle)} `;
    return h.includes(n);
  };

  CITIES.forEach((c) => {
    const tokens = new Set<string>();
    const base = normName(c.name);
    tokens.add(base);
    base.split(" ").forEach((t) => t.length >= 5 && tokens.add(t));
    (CITY_NAME_ALIASES[c.id] || []).forEach((a) => tokens.add(normName(a)));

    const matches = sa2.filter((s) => {
      const st = stateFromSa2Code(s.code);
      if (st !== c.state) return false;
      return Array.from(tokens).some((t) => wordMatch(s.name, t));
    });
    if (matches.length === 0) return;
    const avg = matches.reduce(
      (acc, m) => {
        acc.x += m.centroid!.x;
        acc.y += m.centroid!.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    cityCentroids[c.id] = {
      x: avg.x / matches.length,
      y: avg.y / matches.length,
      state: c.state,
    };
  });

  // SA3 fallback: try to place city centroids using SA3 names if SA2 match sparse.
  CITIES.forEach((c) => {
    if (cityCentroids[c.id]) return;
    const tokens = new Set<string>();
    const base = normName(c.name);
    tokens.add(base);
    base.split(" ").forEach((t) => t.length >= 5 && tokens.add(t));
    (CITY_NAME_ALIASES[c.id] || []).forEach((a) => tokens.add(normName(a)));
    const matches = sa3.filter((s) => {
      const st = stateFromSa2Code(s.code);
      if (st !== c.state) return false;
      return Array.from(tokens).some((t) => wordMatch(s.name, t));
    });
    if (matches.length === 0) return;
    const avg = matches.reduce(
      (acc, m) => {
        acc.x += m.centroid!.x;
        acc.y += m.centroid!.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    cityCentroids[c.id] = {
      x: avg.x / matches.length,
      y: avg.y / matches.length,
      state: c.state,
    };
  });

  const out = [["SA2_CODE", "CITY_ID"]];
  sa2.forEach((s) => {
    const st = stateFromSa2Code(s.code);
    if (!st) return;
    const cities = cityByState.get(st) || [];
    let bestId: string | null = null;
    let bestD = Infinity;
    cities.forEach((c) => {
      const ctr = cityCentroids[c.id];
      if (!ctr) return;
      const dx = s.centroid!.x - ctr.x;
      const dy = s.centroid!.y - ctr.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestId = c.id;
      }
    });
    if (!bestId) {
      // SA3 fallback: find nearest SA3 centroid that matched a city.
      let bestSa3: { cityId: string; d: number } | null = null;
      sa3.forEach((r) => {
        const st3 = stateFromSa2Code(r.code);
        if (st3 !== st) return;
        const city = Object.entries(cityCentroids).find(([_, v]) => v.state === st);
        if (!city) return;
        const dx = s.centroid!.x - r.centroid!.x;
        const dy = s.centroid!.y - r.centroid!.y;
        const d = dx * dx + dy * dy;
        if (!bestSa3 || d < bestSa3.d) bestSa3 = { cityId: city[0], d };
      });
      if (bestSa3) bestId = bestSa3.cityId;
    }
    if (bestId) out.push([s.code, bestId]);
  });
  writeCsv(path.join(RAW_DIR, "sa2_to_city.csv"), out);
}

async function buildStatePriceIndex() {
  const url = "https://api.data.abs.gov.au/data/RES_DWELL_ST/5..Q";
  const xml = await fetchText(url);
  const seriesBlocks = xml.split("<generic:Series>").slice(1);
  const byYear: Record<number, Record<string, number[]>> = {};
  const regionMap: Record<string, string> = {
    "1": "NSW",
    "2": "VIC",
    "3": "QLD",
    "4": "SA",
    "5": "WA",
    "6": "TAS",
    "7": "NT",
    "8": "ACT",
  };
  seriesBlocks.forEach((block) => {
    const regMatch = block.match(/id=\\\"REGION\\\" value=\\\"([^\\\"]+)\\\"/);
    const region = regMatch ? regionMap[regMatch[1]] : null;
    if (!region) return;
    const obs = [...block.matchAll(/TIME_PERIOD\\\" value=\\\"(\\d{4})-Q(\\d)\\\"[^>]*>\\s*<generic:ObsValue value=\\\"([^\\\"]+)\\\"/g)];
    obs.forEach((m) => {
      const year = Number(m[1]);
      const val = Number(m[3]);
      if (!Number.isFinite(year) || !Number.isFinite(val)) return;
      byYear[year] = byYear[year] || {};
      byYear[year][region] = byYear[year][region] || [];
      byYear[year][region].push(val);
    });
  });
  const out = [["YEAR", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]];
  Object.keys(byYear).sort().forEach((yStr) => {
    const y = Number(yStr);
    const row = [String(y)];
    ["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].forEach((st) => {
      const xs = byYear[y][st] || [];
      const avg = xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : "";
      row.push(avg ? String(avg) : "");
    });
    out.push(row);
  });
  writeCsv(path.join(RAW_DIR, "state_price_index.csv"), out);
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  await buildSa3Income();
  await buildSa2Rent();
  await buildSa2CityMap();
  await buildStatePriceIndex();
  console.log("ABS raw inputs written to data/abs/raw");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
