#!/usr/bin/env node
/**
 * ASGS 2026 Data Extraction Pipeline (TypeScript/Node.js)
 * 
 * Downloads and processes ASGS SA3/SA4 geometry, metadata, and economic series
 * from ABS sources for ingestion into Convex.
 * 
 * Usage:
 *   npm run extract-asgs -- --level SA3 --output-dir ./data
 *   npm run extract-asgs -- --level SA4 --output-dir ./data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { simplify } from '@turf/turf';

type Level = 'SA3' | 'SA4';

interface Args {
  level: Level;
  outputDir: string;
  cacheDir: string;
  years: number[];
}

interface Feature {
  code: string;
  name: string;
  state: string;
  parentSa4?: string;
  polygon: [number, number][];
}

interface Metadata {
  code: string;
  name: string;
  state: string;
  parentSa4?: string;
}

interface SeriesRow {
  code: string;
  year: number;
  medianPrice?: number;
  medianAnnualRent?: number;
  medianAnnualWage?: number;
  population?: number;
  dwellingStock?: number;
  source?: string;
  imputed?: boolean;
}

// Australia bbox (approx): lon 113-154, lat -44 to -10
const AUSTRALIA_BBOX = { minLon: 113, maxLon: 154, minLat: -44, maxLat: -10 };
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 760;

// ABS Data Sources (placeholders - update with real URLs)
const ASGS_GEOJSON_URL_TEMPLATE = (level: Level) =>
  `https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files/${level}_2021_AUST_GDA2020.geojson`;

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const levelIdx = args.indexOf('--level');
  const outputIdx = args.indexOf('--output-dir');
  const cacheIdx = args.indexOf('--cache-dir');
  const yearsIdx = args.indexOf('--years');

  const level = levelIdx >= 0 ? args[levelIdx + 1] as Level : 'SA3';
  const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : './data';
  const cacheDir = cacheIdx >= 0 ? args[cacheIdx + 1] : './data/cache';
  const yearsStr = yearsIdx >= 0 ? args[yearsIdx + 1] : '2015,2016,2017,2018,2019,2020,2021,2022,2023,2024';
  const years = yearsStr.split(',').map((y) => parseInt(y, 10));

  if (!['SA3', 'SA4'].includes(level)) {
    console.error('❌ --level must be SA3 or SA4');
    process.exit(1);
  }

  return { level, outputDir, cacheDir, years };
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirects
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadAsgsGeometry(level: Level, cacheDir: string): Promise<string> {
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, `${level}_2021_AUST_GDA2020.geojson`);

  if (fs.existsSync(cacheFile)) {
    console.log(`✓ Using cached geometry: ${cacheFile}`);
    return cacheFile;
  }

  const url = ASGS_GEOJSON_URL_TEMPLATE(level);
  console.log(`⬇️  Downloading ${level} geometry from ABS...`);
  console.log(`   URL: ${url}`);
  console.log(`   If this fails, manually download from:`);
  console.log(`   https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files`);
  console.log(`   and save as: ${cacheFile}\n`);

  try {
    await downloadFile(url, cacheFile);
    console.log(`✓ Downloaded to ${cacheFile}`);
    return cacheFile;
  } catch (e: any) {
    console.error(`❌ Download failed: ${e.message}`);
    console.log(`   Please manually download the ${level} GeoJSON and place at: ${cacheFile}`);
    process.exit(1);
  }
}

function projectToSvg(lon: number, lat: number): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = AUSTRALIA_BBOX;
  const x = ((lon - minLon) / (maxLon - minLon)) * SVG_WIDTH;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * SVG_HEIGHT;
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function extractPolygonCoords(geom: any): [number, number][] {
  if (geom.type === 'Polygon') {
    return geom.coordinates[0]; // Exterior ring
  } else if (geom.type === 'MultiPolygon') {
    // Return largest polygon by area (simple heuristic: most points)
    const polygons = geom.coordinates;
    const largest = polygons.reduce((a: any, b: any) => (a[0].length > b[0].length ? a : b));
    return largest[0];
  }
  return [];
}

function processGeometry(geoJson: any, level: Level): Feature[] {
  const features: Feature[] = [];
  const geoFeatures = geoJson.features || [];

  console.log(`📐 Processing ${geoFeatures.length} ${level} regions...`);

  for (let idx = 0; idx < geoFeatures.length; idx++) {
    const f = geoFeatures[idx];
    const props = f.properties || {};
    const code = String(props[`${level}_CODE_2021`] || props.code || `UNKNOWN_${idx}`);
    const name = String(props[`${level}_NAME_2021`] || props.name || code);
    const state = String(props.STE_CODE_2021 || props.state || 'UNKNOWN');
    const parentSa4 = level === 'SA3' ? String(props.SA4_CODE_2021 || '') : undefined;

    let geom = f.geometry;
    if (!geom || !geom.coordinates) continue;

    // Simplify geometry using turf
    try {
      const simplified = simplify(f, { tolerance: 0.01, highQuality: false });
      geom = simplified.geometry;
    } catch (e) {
      // If simplification fails, use original
    }

    const coords = extractPolygonCoords(geom);
    if (coords.length < 3) continue;

    // Project to SVG
    const svgCoords = coords.map(([lon, lat]) => projectToSvg(lon, lat));

    features.push({
      code,
      name,
      state,
      parentSa4: parentSa4 || undefined,
      polygon: svgCoords,
    });

    if ((idx + 1) % 50 === 0) {
      console.log(`   Processed ${idx + 1}/${geoFeatures.length}...`);
    }
  }

  console.log(`✓ Processed ${features.length} features`);
  return features;
}

function extractMetadata(features: Feature[], level: Level): Metadata[] {
  return features.map((f) => {
    const meta: Metadata = {
      code: f.code,
      name: f.name,
      state: f.state,
    };
    if (level === 'SA3' && f.parentSa4) {
      meta.parentSa4 = f.parentSa4;
    }
    return meta;
  });
}

function generateSampleSeries(features: Feature[], years: number[]): SeriesRow[] {
  const series: SeriesRow[] = [];
  console.log(`📊 Generating sample series for ${features.length} regions × ${years.length} years...`);

  for (const f of features) {
    const basePrice = 400000 + Math.random() * 800000;
    const baseRent = 18000 + Math.random() * 27000;
    const baseWage = 55000 + Math.random() * 40000;
    const basePop = 5000 + Math.random() * 145000;
    const baseStock = basePop / (2.3 + Math.random() * 0.5);

    for (const year of years) {
      const yearOffset = year - years[0];
      const growth = 1.0 + yearOffset * 0.04;

      series.push({
        code: f.code,
        year,
        medianPrice: Math.round(basePrice * growth),
        medianAnnualRent: Math.round(baseRent * growth),
        medianAnnualWage: Math.round(baseWage * (1 + yearOffset * 0.025)),
        population: Math.round(basePop * (1 + yearOffset * 0.015)),
        dwellingStock: Math.round(baseStock * (1 + yearOffset * 0.02)),
        source: 'synthetic',
        imputed: true,
      });
    }
  }

  console.log(`✓ Generated ${series.length} series rows`);
  return series;
}

async function main() {
  const args = parseArgs();
  const { level, outputDir, cacheDir, years } = args;

  console.log('\n' + '='.repeat(60));
  console.log(`ASGS 2026 ${level} Extraction Pipeline (Node.js)`);
  console.log('='.repeat(60) + '\n');

  // Step 1: Download geometry
  const geojsonPath = await downloadAsgsGeometry(level, cacheDir);

  // Step 2: Load and process
  console.log(`\n📂 Loading ${level} GeoJSON...`);
  let geoJson: any;
  try {
    const content = fs.readFileSync(geojsonPath, 'utf-8');
    geoJson = JSON.parse(content);
    console.log(`✓ Loaded ${geoJson.features?.length || 0} features`);
  } catch (e: any) {
    console.error(`❌ Failed to load GeoJSON: ${e.message}`);
    process.exit(1);
  }

  // Step 3: Process geometry
  const features = processGeometry(geoJson, level);

  // Step 4: Extract metadata
  const metadata = extractMetadata(features, level);

  // Step 5: Generate sample series
  const series = generateSampleSeries(features, years);

  // Step 6: Write outputs
  fs.mkdirSync(outputDir, { recursive: true });
  const geomFile = path.join(outputDir, `${level.toLowerCase()}_geometry.json`);
  const metaFile = path.join(outputDir, `${level.toLowerCase()}_metadata.json`);
  const seriesFile = path.join(outputDir, `${level.toLowerCase()}_series.json`);

  console.log(`\n💾 Writing outputs...`);
  fs.writeFileSync(geomFile, JSON.stringify({ features }, null, 2));
  console.log(`   ✓ ${geomFile}`);

  fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
  console.log(`   ✓ ${metaFile}`);

  fs.writeFileSync(seriesFile, JSON.stringify(series, null, 2));
  console.log(`   ✓ ${seriesFile}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Extraction complete!');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Go to http://localhost:5173/#/sa3-admin');
  console.log(`2. Select '${level}'`);
  console.log('3. Paste contents of:');
  console.log(`   - Metadata: ${metaFile}`);
  console.log(`   - Geometry: ${geomFile}`);
  console.log(`   - Series: ${seriesFile}`);
  console.log('4. Click Ingest buttons and recompute caches\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
