/**
 * Build a HistoryBundle from ABS/Open datasets and write it to src/model/history/absBundle.ts.
 *
 * Expected raw files (place in data/abs/raw):
 * - sa3_income.csv        (SA3_CODE, YEAR, MEDIAN_WEEKLY_HH_INCOME[, POP])
 * - sa2_rent.csv          (SA2_CODE, YEAR?, MEDIAN_WEEKLY_RENT[, POP])
 * - state_price_index.csv (YEAR, NSW, VIC, QLD, WA, SA, TAS, ACT, NT)
 *
 * Usage: npx tsx scripts/import-abs-history.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildSyntheticHistoryBundle } from "../src/model/history/synthetic";
import { getAllCityBaselines } from "../src/model/presets";
import { cityMeta, type StateId, type CityId } from "../src/model/regions";
import type { HistoryBundle } from "../src/model/history/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DIR = path.join(__dirname, "..", "data", "abs", "raw");
const OUT_FILE = path.join(__dirname, "..", "src", "model", "history", "absBundle.ts");

function readFileIfExists(p: string): string | null {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
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

function buildSa2YearMap(opts: {
  csv: string;
  codeCol: string;
  yearCol: string;
  valueCol: string;
  popCol?: string;
}): Record<string, Record<number, { value: number; pop?: number }>> {
  const rows = parseCsv(opts.csv);
  const head = rows[0];
  const idx = (name: string) => head.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iCode = idx(opts.codeCol);
  const iYear = idx(opts.yearCol);
  const iVal = idx(opts.valueCol);
  const iPop = opts.popCol ? idx(opts.popCol) : -1;
  const out: Record<string, Record<number, { value: number; pop?: number }>> = {};
  rows.slice(1).forEach((r) => {
    const code = r[iCode];
    const year = toNum(r[iYear]);
    const val = toNum(r[iVal]);
    if (!code || !year || val == null) return;
    const pop = iPop >= 0 ? toNum(r[iPop]) ?? undefined : undefined;
    out[String(code)] = out[String(code)] || {};
    out[String(code)][year] = { value: val, pop };
  });
  return out;
}

function readSa2ToCityMap(csv: string): Record<string, CityId> {
  const rows = parseCsv(csv);
  const head = rows[0];
  const idx = (name: string) => head.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iCode = idx("SA2_CODE");
  const iCity = idx("CITY_ID");
  const out: Record<string, CityId> = {};
  rows.slice(1).forEach((r) => {
    const code = r[iCode];
    const city = r[iCity] as CityId | undefined;
    if (code && city) out[String(code)] = city;
  });
  return out;
}

function aggregateSa2ToCity(opts: {
  sa2Map: Record<string, Record<number, { value: number; pop?: number }>>;
  sa2ToCity: Record<string, CityId>;
}): Record<CityId, Record<number, number>> {
  const out: Record<CityId, Record<number, { sum: number; w: number }>> = {} as any;
  Object.entries(opts.sa2Map).forEach(([sa2, byYear]) => {
    const city = opts.sa2ToCity[sa2];
    if (!city) return;
    Object.entries(byYear).forEach(([yStr, v]) => {
      const y = Number(yStr);
      if (!Number.isFinite(y)) return;
      out[city] = out[city] || {};
      const w = v.pop ?? 1;
      const cur = out[city][y] || { sum: 0, w: 0 };
      cur.sum += v.value * w;
      cur.w += w;
      out[city][y] = cur;
    });
  });
  const result: Record<CityId, Record<number, number>> = {} as any;
  Object.entries(out).forEach(([city, byYear]) => {
    result[city as CityId] = {};
    Object.entries(byYear).forEach(([yStr, v]) => {
      const y = Number(yStr);
      if (v.w > 0) result[city as CityId][y] = v.sum / v.w;
    });
  });
  return result;
}

function buildStateSeriesFromIndex(csv: string): Record<StateId, Record<number, number>> {
  const rows = parseCsv(csv);
  const head = rows[0].map((h) => h.toUpperCase());
  const idx = (name: string) => head.findIndex((h) => h === name);
  const iYear = idx("YEAR");
  const states: StateId[] = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
  const out: Record<StateId, Record<number, number>> = {
    NSW: {}, VIC: {}, QLD: {}, WA: {}, SA: {}, TAS: {}, ACT: {}, NT: {},
  };
  rows.slice(1).forEach((r) => {
    const y = toNum(r[iYear]);
    if (!y) return;
    states.forEach((st) => {
      const i = idx(st);
      const v = i >= 0 ? toNum(r[i]) : null;
      if (v != null) out[st][y] = v;
    });
  });
  return out;
}

function stateIdFromCodePrefix(prefix: string): StateId | null {
  switch (prefix) {
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

function toAnnual(weekly: number): number {
  return Math.round(weekly * 52);
}

function writeAbsBundle(bundle: HistoryBundle, note: string) {
  const content =
    `import type { HistoryBundle } from \"./types\";\\n\\n` +
    `// Auto-generated by scripts/import-abs-history.ts\\n` +
    `// ${note}\\n` +
    `export const ABS_HISTORY_BUNDLE: HistoryBundle = ${JSON.stringify(bundle, null, 2)};\\n`;
  fs.writeFileSync(OUT_FILE, content, "utf8");
  console.log(`Wrote ${OUT_FILE}`);
}

function main() {
  const cities = getAllCityBaselines();
  const synthetic = buildSyntheticHistoryBundle({ cities });

  const sa2IncomeCsv = readFileIfExists(path.join(RAW_DIR, "sa2_income.csv"));
  const sa2RentCsv = readFileIfExists(path.join(RAW_DIR, "sa2_rent.csv"));
  const priceIdxCsv = readFileIfExists(path.join(RAW_DIR, "state_price_index.csv"));
  const sa2ToCityCsv = readFileIfExists(path.join(RAW_DIR, "sa2_to_city.csv"));

  if (!sa2IncomeCsv || !sa2RentCsv || !priceIdxCsv || !sa2ToCityCsv) {
    writeAbsBundle(synthetic, "Raw ABS/Open files not found; using synthetic history.");
    return;
  }

  const sa2Income = buildSa2YearMap({
    csv: sa2IncomeCsv,
    codeCol: "SA2_CODE",
    yearCol: "YEAR",
    valueCol: "MEDIAN_WEEKLY_HH_INCOME",
    popCol: "POP",
  });

  const sa2Rent = buildSa2YearMap({
    csv: sa2RentCsv,
    codeCol: "SA2_CODE",
    yearCol: "YEAR",
    valueCol: "MEDIAN_WEEKLY_RENT",
    popCol: "POP",
  });

  const sa2ToCity = readSa2ToCityMap(sa2ToCityCsv);
  const incomeByCity = aggregateSa2ToCity({ sa2Map: sa2Income, sa2ToCity });
  const rentByCity = aggregateSa2ToCity({ sa2Map: sa2Rent, sa2ToCity });

  const priceIdxByState = buildStateSeriesFromIndex(priceIdxCsv);

  const bundle: HistoryBundle = JSON.parse(JSON.stringify(synthetic));
  bundle.meta.notes.push("ABS/Open anchors applied to synthetic series (state-level).");

  Object.entries(bundle.byCity).forEach(([cityId, series]) => {
    if (!series) return;
    const meta = cityMeta(cityId as any);
    const state = meta.state;
    const statePrefix = (() => {
      switch (state) {
        case "NSW": return "1";
        case "VIC": return "2";
        case "QLD": return "3";
        case "SA": return "4";
        case "WA": return "5";
        case "TAS": return "6";
        case "NT": return "7";
        case "ACT": return "8";
        default: return null;
      }
    })();

    const years = series.years;
    const idx2016 = years.indexOf(2016 as any);
    const idx2019 = years.indexOf(2019 as any);

    const incomeAnchor = (() => {
      const cityIncome = incomeByCity[cityId as CityId];
      const v = cityIncome?.[2021] ?? cityIncome?.[2019] ?? null;
      return v != null ? toAnnual(v) : null;
    })();
    if (incomeAnchor && series.medianAnnualWage && idx2019 >= 0) {
      const base = series.medianAnnualWage[idx2019] ?? null;
      if (typeof base === "number" && base > 0) {
        const ratio = incomeAnchor / base;
        series.medianAnnualWage = series.medianAnnualWage.map((v) =>
          typeof v === "number" ? Math.round(v * ratio) : v
        );
      }
    }

    const rentAnchor = (() => {
      const cityRent = rentByCity[cityId as CityId];
      const v = cityRent?.[2021] ?? cityRent?.[2016] ?? null;
      return v != null ? toAnnual(v) : null;
    })();
    if (rentAnchor && series.medianAnnualRent && idx2016 >= 0) {
      const base = series.medianAnnualRent[idx2016] ?? null;
      if (typeof base === "number" && base > 0) {
        const ratio = rentAnchor / base;
        series.medianAnnualRent = series.medianAnnualRent.map((v) =>
          typeof v === "number" ? Math.round(v * ratio) : v
        );
      }
    }

    const idxSeries = priceIdxByState[state];
    if (idxSeries && series.medianPrice) {
      const endYear = years[years.length - 1];
      const endIdx = idxSeries[endYear] ?? null;
      if (endIdx != null && endIdx > 0) {
        series.medianPrice = years.map((y, i) => {
          const idx = idxSeries[y];
          const base = series.medianPrice?.[i] ?? null;
          if (idx == null || typeof base !== "number") return base;
          const ratio = idx / endIdx;
          return Math.round(base * ratio);
        });
      }
    }
  });

  writeAbsBundle(bundle, "ABS/Open anchors applied. Ensure raw files are current.");
}

main();
