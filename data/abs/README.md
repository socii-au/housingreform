# ABS/Open Data Sources (optional)

This model can run with synthetic history built from city baselines and coarse growth profiles.
If you want ABS-anchored rent/income and open price indices, drop the raw datasets here and
run `npm run import-abs-history` to generate `src/model/history/absBundle.ts`.

Recommended sources:

- ABS Data by Region – Income (SA3 2011–2019)
  https://data.gov.au/data/dataset/au-govt-abs-abs-data-by-region-income-asgs-sa3-2011-2019-sa3-2016

- ABS Census SA2 household income (2016)
  https://www.data.gov.au/data/dataset/au-govt-abs-census-sa2-p28-total-hsehold-income-by-hsehold-census-2016-sa2-2016

- ABS RPPI (capital cities, historic series)
  https://www.housingdata.gov.au/visualisation/housing-affordability/residential-property-price-index-capital-cities-hi

Raw files expected in `data/abs/raw`:
- `sa2_income.csv` with columns: SA2_CODE, YEAR, MEDIAN_WEEKLY_HH_INCOME[, POP]
- `sa2_rent.csv` with columns: SA2_CODE, YEAR, MEDIAN_WEEKLY_RENT[, POP]
- `sa2_to_city.csv` with columns: SA2_CODE, CITY_ID
- `state_price_index.csv` with columns: YEAR, NSW, VIC, QLD, WA, SA, TAS, ACT, NT

Notes:
- These datasets are typically provided as CSV/XLSX resources under the dataset page.
- If direct download is blocked in-app, download locally and place files in this directory.
