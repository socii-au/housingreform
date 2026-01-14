# ASGS 2026 Data Extraction Scripts (Node.js/TypeScript)

Extract SA3/SA4 geometry, metadata, and economic series from ABS sources using **Node.js**.

---

## Setup

Install dependencies:

```bash
npm install
```

This installs:
- `@turf/turf` — Geometry simplification
- `tsx` — Run TypeScript directly
- `@types/node` — Node.js type definitions

---

## Usage

### Extract SA3 regions

```bash
npm run extract-asgs -- --level SA3 --output-dir ./data
```

### Extract SA4 regions

```bash
npm run extract-asgs -- --level SA4 --output-dir ./data
```

### Options

- `--level` — SA3 or SA4 (required)
- `--output-dir` — Output directory (default: `./data`)
- `--cache-dir` — Cache directory for downloads (default: `./data/cache`)
- `--years` — Comma-separated years for series (default: `2015,2016,...,2024`)

Example:

```bash
npm run extract-asgs -- --level SA3 --output-dir ./data --years 2018,2019,2020,2021,2022,2023,2024
```

---

## Outputs

After running the script, you'll have:

```
data/
├── sa3_geometry.json   ← Paste into /sa3-admin (Geometry)
├── sa3_metadata.json   ← Paste into /sa3-admin (Metadata)
├── sa3_series.json     ← Paste into /sa3-admin (Series)
├── sa4_geometry.json
├── sa4_metadata.json
└── sa4_series.json
```

---

## Manual Download (if auto-download fails)

If the script can't download ASGS GeoJSON automatically:

1. Go to [ABS ASGS Digital Boundaries](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files)

2. Download:
   - `SA3_2021_AUST_GDA2020.geojson`
   - `SA4_2021_AUST_GDA2020.geojson`

3. Place in `./data/cache/`

4. Re-run the extraction script

---

## Ingestion Workflow

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Deploy Convex functions:**
   ```bash
   npx convex deploy
   ```

3. **Set Convex URL in `.env.local`:**
   ```
   VITE_CONVEX_URL=https://your-deployment.convex.cloud
   ```

4. **Go to [http://localhost:5173/#/sa3-admin](http://localhost:5173/#/sa3-admin)**

5. **For SA3:**
   - Select "SA3"
   - Paste contents of `data/sa3_metadata.json` into metadata field
   - Paste contents of `data/sa3_geometry.json` into geometry field → click "Ingest geometry"
   - Paste contents of `data/sa3_series.json` into series field → click "Ingest series"
   - Click "Recompute latest year (NATIONAL + STATE + SA4)"

6. **For SA4:**
   - Select "SA4"
   - Paste contents of `data/sa4_metadata.json` into metadata field
   - Paste contents of `data/sa4_geometry.json` into geometry field → click "Ingest geometry"
   - Paste contents of `data/sa4_series.json` into series field → click "Ingest series"
   - Click "Recompute latest year (NATIONAL + STATE)"

7. **View the map:**
   - Go to [http://localhost:5173/#/sa3](http://localhost:5173/#/sa3)
   - Use Level selector (SA3/SA4)
   - Use Scope selector (National/State/SA4)

---

## Data Notes

### ⚠️ Synthetic Data Warning

**The extraction script generates SYNTHETIC data for testing** because:

- Real estate prices/rents are NOT available from ABS at SA3/SA4 level
- For production, you must source from commercial APIs:
  - **CoreLogic** (property prices/rents) — requires subscription
  - **Domain API** (property data) — has free tier with limits
  - **State government data** (e.g., NSW Rent and Sales Report)

### Data Sources (Production)

| Metric | Source | Notes |
|--------|--------|-------|
| Population | [ABS ERP by SA2](https://www.abs.gov.au/statistics/people/population/regional-population) | Aggregate SA2 → SA3/SA4 |
| Dwelling stock | [ABS Census](https://www.abs.gov.au/census) | Table G01 by SA3 |
| Median house price | [CoreLogic API](https://www.corelogic.com.au/products/apis) | Commercial subscription |
| Median rent | [Domain API](https://developer.domain.com.au/) | Free tier available |
| Median wage | [ABS Census](https://www.abs.gov.au/census) | Table G02 (Income) by SA3 |

---

## Next Steps

1. ✅ Run extraction for SA3 and SA4
2. ⚠️ Ingest into Convex (synthetic data for testing)
3. 🎯 Source real data from CoreLogic/Domain/ABS for production
4. 🗺️ View live maps at `/sa3`

For real data integration, see the original `scripts/README.md` for API integration guidance.
