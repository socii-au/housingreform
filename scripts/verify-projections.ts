/**
 * Verify model projections across all cities.
 *
 * Checks:
 * - No city has price CAGR > 8% or < -3%
 * - No city has final PTI < 4 or > 25
 * - No city has final rent burden < 18% or > 55%
 * - Capitals produce realistic 20-year trajectories
 * - Regional cities maintain plausible price floors
 *
 * Usage: npx tsx scripts/verify-projections.ts
 */

import { buildDefaultScenario } from "../src/model/presets";
import { runScenario } from "../src/model/runScenario";
import type { CityScenarioOutputs } from "../src/model/runScenario";

const YEARS = 20;

function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return Math.pow(end / start, 1 / years) - 1;
}

function main() {
  console.log(`\n=== Projection Verification (${YEARS}-year baseline) ===\n`);

  const scenario = buildDefaultScenario(YEARS, true);
  const outputs = runScenario(scenario);

  const cities = Object.values(outputs.byCity) as CityScenarioOutputs[];
  const failures: string[] = [];
  const warnings: string[] = [];

  // Summary stats
  let minPriceCagr = Infinity;
  let maxPriceCagr = -Infinity;
  let minFinalPTI = Infinity;
  let maxFinalPTI = -Infinity;
  let minFinalRentBurden = Infinity;
  let maxFinalRentBurden = -Infinity;

  console.log(
    "City".padEnd(6) +
      "Name".padEnd(22) +
      "PriceCAGR".padEnd(11) +
      "RentCAGR".padEnd(11) +
      "FinalPTI".padEnd(10) +
      "RentBurden".padEnd(12) +
      "FinalPrice".padEnd(14) +
      "Status"
  );
  console.log("-".repeat(100));

  for (const city of cities) {
    const first = city.years[0];
    const last = city.years[city.years.length - 1];

    const priceCagr = cagr(first.medianPrice, last.medianPrice, YEARS);
    const rentCagr = cagr(first.medianAnnualRent, last.medianAnnualRent, YEARS);
    const finalPTI = last.medianPrice / Math.max(1, last.medianAnnualWage);
    const finalRentBurden = last.medianAnnualRent / Math.max(1, last.medianAnnualWage);

    minPriceCagr = Math.min(minPriceCagr, priceCagr);
    maxPriceCagr = Math.max(maxPriceCagr, priceCagr);
    minFinalPTI = Math.min(minFinalPTI, finalPTI);
    maxFinalPTI = Math.max(maxFinalPTI, finalPTI);
    minFinalRentBurden = Math.min(minFinalRentBurden, finalRentBurden);
    maxFinalRentBurden = Math.max(maxFinalRentBurden, finalRentBurden);

    const issues: string[] = [];

    // Check price CAGR
    if (priceCagr > 0.08) {
      issues.push(`Price CAGR ${(priceCagr * 100).toFixed(1)}% > 8%`);
    }
    if (priceCagr < -0.03) {
      issues.push(`Price CAGR ${(priceCagr * 100).toFixed(1)}% < -3%`);
    }

    // Check final PTI
    if (finalPTI < 4) {
      issues.push(`Final PTI ${finalPTI.toFixed(1)}x < 4x`);
    }
    if (finalPTI > 25) {
      issues.push(`Final PTI ${finalPTI.toFixed(1)}x > 25x`);
    }

    // Check final rent burden
    if (finalRentBurden < 0.18) {
      issues.push(`Rent burden ${(finalRentBurden * 100).toFixed(1)}% < 18%`);
    }
    if (finalRentBurden > 0.55) {
      issues.push(`Rent burden ${(finalRentBurden * 100).toFixed(1)}% > 55%`);
    }

    const status = issues.length === 0 ? "OK" : "FAIL";
    if (issues.length > 0) {
      failures.push(`${city.cityId} (${city.cityName}): ${issues.join("; ")}`);
    }

    console.log(
      city.cityId.padEnd(6) +
        city.cityName.padEnd(22) +
        `${(priceCagr * 100).toFixed(1)}%`.padEnd(11) +
        `${(rentCagr * 100).toFixed(1)}%`.padEnd(11) +
        `${finalPTI.toFixed(1)}x`.padEnd(10) +
        `${(finalRentBurden * 100).toFixed(1)}%`.padEnd(12) +
        `$${Math.round(last.medianPrice / 1000)}K`.padEnd(14) +
        status +
        (issues.length > 0 ? ` - ${issues.join("; ")}` : "")
    );
  }

  console.log("\n" + "=".repeat(100));
  console.log(`\nSummary across ${cities.length} cities:`);
  console.log(`  Price CAGR range: ${(minPriceCagr * 100).toFixed(1)}% to ${(maxPriceCagr * 100).toFixed(1)}%`);
  console.log(`  Final PTI range: ${minFinalPTI.toFixed(1)}x to ${maxFinalPTI.toFixed(1)}x`);
  console.log(
    `  Final rent burden range: ${(minFinalRentBurden * 100).toFixed(1)}% to ${(maxFinalRentBurden * 100).toFixed(1)}%`
  );

  // Check for CAGR clustering (multiple cities with identical CAGR)
  const cagrBuckets = new Map<string, string[]>();
  for (const city of cities) {
    const first = city.years[0];
    const last = city.years[city.years.length - 1];
    const priceCagr = cagr(first.medianPrice, last.medianPrice, YEARS);
    const bucket = (priceCagr * 100).toFixed(1);
    const arr = cagrBuckets.get(bucket) ?? [];
    arr.push(city.cityId);
    cagrBuckets.set(bucket, arr);
  }

  const clusterThreshold = 5;
  const clusters = Array.from(cagrBuckets.entries())
    .filter(([, ids]) => ids.length >= clusterThreshold)
    .sort((a, b) => b[1].length - a[1].length);

  if (clusters.length > 0) {
    console.log(`\n  CAGR clusters (${clusterThreshold}+ cities at same CAGR):`);
    clusters.forEach(([bucket, ids]) => {
      console.log(`    ${bucket}%: ${ids.length} cities (${ids.join(", ")})`);
      if (ids.length >= 10) {
        warnings.push(`${ids.length} cities cluster at price CAGR ${bucket}%`);
      }
    });
  } else {
    console.log("\n  No significant CAGR clustering detected.");
  }

  // Capital city summary
  const capitals = ["SYD", "MEL", "BNE", "PER", "ADL", "HBA", "DRW", "CBR"];
  console.log("\nCapital city details:");
  console.log(
    "City".padEnd(6) +
      "StartPrice".padEnd(12) +
      "EndPrice".padEnd(12) +
      "CAGR".padEnd(8) +
      "StartPTI".padEnd(10) +
      "EndPTI".padEnd(10) +
      "RentBurden"
  );
  for (const id of capitals) {
    const city = outputs.byCity[id as any];
    if (!city) continue;
    const first = city.years[0];
    const last = city.years[city.years.length - 1];
    const priceCagr = cagr(first.medianPrice, last.medianPrice, YEARS);
    const startPTI = first.medianPrice / Math.max(1, first.medianAnnualWage);
    const endPTI = last.medianPrice / Math.max(1, last.medianAnnualWage);
    const rentBurden = last.medianAnnualRent / Math.max(1, last.medianAnnualWage);
    console.log(
      id.padEnd(6) +
        `$${Math.round(first.medianPrice / 1000)}K`.padEnd(12) +
        `$${Math.round(last.medianPrice / 1000)}K`.padEnd(12) +
        `${(priceCagr * 100).toFixed(1)}%`.padEnd(8) +
        `${startPTI.toFixed(1)}x`.padEnd(10) +
        `${endPTI.toFixed(1)}x`.padEnd(10) +
        `${(rentBurden * 100).toFixed(1)}%`
    );
  }

  console.log("\n" + "=".repeat(100));

  if (failures.length > 0) {
    console.log(`\n*** ${failures.length} FAILURES ***`);
    failures.forEach((f) => console.log(`  - ${f}`));
  } else {
    console.log("\n*** ALL CHECKS PASSED ***");
  }

  if (warnings.length > 0) {
    console.log(`\n*** ${warnings.length} WARNINGS ***`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  }

  console.log("");

  // Exit with error code if there are failures
  if (failures.length > 0) {
    process.exit(1);
  }
}

main();
