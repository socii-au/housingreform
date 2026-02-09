/**
 * Apply baseline updates from data/baseline-updates.json to src/model/presets.ts
 * Usage: npx tsx scripts/apply-baseline-updates.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPDATES_FILE = path.join(__dirname, "..", "data", "baseline-updates.json");
const PRESETS_FILE = path.join(__dirname, "..", "src", "model", "presets.ts");

function fmt(n: number): string {
  const s = String(n);
  // Add underscores for readability (1_190_000 style)
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, "_");
}

function main() {
  const updates = JSON.parse(fs.readFileSync(UPDATES_FILE, "utf8")) as Record<
    string,
    Record<string, number>
  >;
  let src = fs.readFileSync(PRESETS_FILE, "utf8");
  let totalCount = 0;

  for (const [cityId, patch] of Object.entries(updates)) {
    for (const [field, newVal] of Object.entries(patch)) {
      // Find the city block: from "cityId: "XXX"" to the next "cityId:" or closing brace
      const cityMarker = `cityId: "${cityId}"`;
      const cityStart = src.indexOf(cityMarker);
      if (cityStart < 0) {
        console.log("MISS city:", cityId);
        continue;
      }

      // Scan forward to find the field within this city's block
      // The block ends at the next "cityId:" or closing "},\n"
      const nextCity = src.indexOf("cityId:", cityStart + cityMarker.length);
      const blockEnd = nextCity > 0 ? nextCity : src.length;
      const blockSrc = src.slice(cityStart, blockEnd);

      // Match the field: e.g. "medianPrice: 1_150_000" or "medianPrice: 920000"
      const fieldRe = new RegExp(`(${field}:\\s*)([0-9_]+)`);
      const m = blockSrc.match(fieldRe);
      if (!m) {
        console.log("MISS field:", cityId, field);
        continue;
      }

      const oldFull = m[0];
      const prefix = m[1]; // e.g. "medianPrice: "
      const newFull = prefix + fmt(newVal);

      if (oldFull === newFull) continue;

      // Replace within this specific block only
      const newBlock = blockSrc.replace(oldFull, newFull);
      src = src.slice(0, cityStart) + newBlock + src.slice(blockEnd);
      totalCount++;
    }
  }

  fs.writeFileSync(PRESETS_FILE, src, "utf8");
  console.log(`Applied ${totalCount} field updates to presets.ts`);
}

main();
