# ASGS 2026 Data Extraction Scripts

Python scripts to extract SA3/SA4 geometry, metadata, and economic series from ABS and external sources.

---

## Setup

Install dependencies:

```bash
pip install requests geopandas shapely pyproj pandas openpyxl
```

---

## Scripts

### 1. `extract-asgs.py` — Geometry + Metadata Extraction

Downloads ASGS 2026 SA3/SA4 boundaries from ABS, simplifies geometry, projects to SVG coordinates, and generates output files for Convex ingestion.

**Usage:**

```bash
# Extract SA3 regions
python scripts/extract-asgs.py --level SA3 --output-dir ./data

# Extract SA4 regions
python scripts/extract-asgs.py --level SA4 --output-dir ./data
```

**Outputs:**
- `data/sa3_geometry.json` — Simplified polygons in SVG coords (0-1000 x 0-760)
- `data/sa3_metadata.json` — Region codes, names, state, parent SA4
- `data/sa3_series.json` — Sample/synthetic economic series

**Manual step (if download fails):**

1. Go to [ABS ASGS Digital Boundaries](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files)
2. Download:
   - `SA3_2021_AUST_GDA2020.geojson`
   - `SA4_2021_AUST_GDA2020.geojson`
3. Place in `./data/cache/`

---

### 2. `fetch-abs-series.py` — Economic Series Data (TEMPLATE)

Fetches real economic data from ABS API or Excel tables.

**⚠️ Note:** This is a **template**. Real estate price/rent data is NOT available from ABS at SA3/SA4 level. You need to source from:

- **Population & Dwellings**: ABS Census / ERP tables
- **Median Prices**: CoreLogic API, Domain API, or state government property data
- **Median Rents**: CoreLogic, Domain, or rental bond data (varies by state)
- **Median Wages**: ABS Census / Labour Force Survey (limited regional detail)

**Usage:**

```bash
python scripts/fetch-abs-series.py --level SA3 --output ./data/series_real.json
```

**Real data sources:**

| Metric | Source | Notes |
|--------|--------|-------|
| Population | [ABS ERP by SA2](https://www.abs.gov.au/statistics/people/population/regional-population) | SA2 → aggregate to SA3/SA4 |
| Dwelling stock | [ABS Census](https://www.abs.gov.au/census) | Table G01 (Dwellings) by SA3 |
| Median house price | [CoreLogic API](https://www.corelogic.com.au/products/apis) | Commercial; requires subscription |
| Median rent | [Domain API](https://developer.domain.com.au/) or state bond boards | Domain has free tier (limited) |
| Median wage | [ABS Census](https://www.abs.gov.au/census) | Table G02 (Income) by SA3 |

---

## Workflow: Ingest into Convex

After running extraction scripts:

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Deploy Convex functions:
   ```bash
   npx convex deploy
   ```

3. Set your Convex URL in `.env.local`:
   ```
   VITE_CONVEX_URL=https://your-deployment.convex.cloud
   ```

4. Go to [http://localhost:5173/#/sa3-admin](http://localhost:5173/#/sa3-admin)

5. **For SA3:**
   - Select "SA3"
   - Paste contents of `data/sa3_metadata.json` → click next section
   - Paste contents of `data/sa3_geometry.json` → click "Ingest geometry"
   - Paste contents of `data/sa3_series.json` → click "Ingest series"
   - Click "Recompute latest year (NATIONAL + STATE + SA4)"

6. **For SA4:**
   - Select "SA4"
   - Paste contents of `data/sa4_metadata.json` → click next section
   - Paste contents of `data/sa4_geometry.json` → click "Ingest geometry"
   - Paste contents of `data/sa4_series.json` → click "Ingest series"
   - Click "Recompute latest year (NATIONAL + STATE)"

7. View the map:
   - Go to [http://localhost:5173/#/sa3](http://localhost:5173/#/sa3)
   - Use Level selector (SA3/SA4)
   - Use Scope selector (National/State/SA4)

---

## Data Quality Notes

### Geometry
- **Simplification**: Polygons are simplified using Shapely's `simplify()` with tolerance=0.01° (~1km). Adjust if needed.
- **Projection**: Simple bbox fit to SVG (not true Mercator). For production, consider proper web Mercator projection.
- **Holes**: Only exterior rings are extracted. Interior holes (e.g., islands) are ignored.

### Metadata
- **State codes**: Extracted from `STE_CODE_2021` field in ASGS GeoJSON
- **SA3→SA4 linkage**: Extracted from `SA4_CODE_2021` field (SA3 only)
- **Names**: Official ABS names from GeoJSON

### Series
- **Synthetic data**: The extraction script generates **synthetic** series by default for testing.
- **Real data**: You must source real data separately (see table above).
- **Imputation**: For missing values, consider:
  - Spatial interpolation (IDW, kriging)
  - Temporal interpolation (linear, exponential smoothing)
  - Borrowing from parent SA4 or state averages

---

## Advanced: Automate with GitHub Actions

You can automate monthly data refreshes using GitHub Actions:

1. Store ABS download URLs or API keys as secrets
2. Run extraction script on schedule (cron)
3. Commit outputs to repo or upload to Convex via API
4. Trigger Convex recompute mutations

Example workflow (`.github/workflows/update-asgs.yml`):

```yaml
name: Update ASGS Data
on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly on 1st
  workflow_dispatch:

jobs:
  extract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r scripts/requirements.txt
      - run: python scripts/extract-asgs.py --level SA3
      - run: python scripts/extract-asgs.py --level SA4
      # TODO: Upload to Convex via API or commit to repo
```

---

## Troubleshooting

**"Download failed" errors:**
- ABS URLs change frequently. Check the [ASGS downloads page](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files) for current links.
- Manually download GeoJSON files and place in `./data/cache/`

**"Column not found" errors in Excel parsing:**
- ABS table formats vary. Inspect the Excel file manually.
- Adjust `skiprows` parameter in `pd.read_excel()` to skip metadata rows.
- Check column names match your code.

**Missing price/rent data:**
- This is expected! ABS doesn't publish SA3-level real estate data.
- Use CoreLogic, Domain, or state government APIs.
- For prototyping, use the synthetic data generated by `extract-asgs.py`.

---

## Next Steps

1. **Run extraction for both SA3 and SA4**
2. **Source real economic data** (price, rent, wage) from external APIs
3. **Ingest into Convex** via `/sa3-admin`
4. **View live maps** at `/sa3`
5. **Automate updates** with scheduled scripts

For questions or issues, check the [ABS Data Services docs](https://www.abs.gov.au/about/data-services) or open an issue.
