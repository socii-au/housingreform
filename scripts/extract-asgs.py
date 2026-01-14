#!/usr/bin/env python3
"""
ASGS 2026 Data Extraction Pipeline
===================================
Downloads and processes ASGS SA3/SA4 geometry, metadata, and economic series
from ABS sources for ingestion into Convex.

Usage:
    python extract-asgs.py --level SA3 --output-dir ./data
    python extract-asgs.py --level SA4 --output-dir ./data

Requirements:
    pip install requests geopandas shapely pyproj pandas
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple
import requests
from shapely.geometry import shape, mapping
from shapely.ops import transform
import pyproj
import geopandas as gpd


# ABS Data Sources (2026 ASGS)
ASGS_2026_BASE = "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files"
ASGS_GEOJSON_URL_TEMPLATE = "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files/{level}_2021_AUST_GDA2020.geojson"

# Projection: WGS84 (EPSG:4326) → SVG viewport (0-1000 x 0-760)
# Australia bbox (approx): lon 113-154, lat -44 to -10
AUSTRALIA_BBOX = {"minLon": 113, "maxLon": 154, "minLat": -44, "maxLat": -10}
SVG_WIDTH = 1000
SVG_HEIGHT = 760


def download_asgs_geometry(level: str, cache_dir: Path) -> Path:
    """Download ASGS GeoJSON from ABS if not cached."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{level}_2021_AUST_GDA2020.geojson"
    
    if cache_file.exists():
        print(f"✓ Using cached geometry: {cache_file}")
        return cache_file
    
    # Note: ABS URLs change frequently. This is a placeholder.
    # You'll need to navigate to the ABS ASGS downloads page and get the actual URL.
    url = ASGS_GEOJSON_URL_TEMPLATE.format(level=level)
    print(f"⬇️  Downloading {level} geometry from ABS...")
    print(f"   URL: {url}")
    print(f"   If this fails, manually download from:")
    print(f"   {ASGS_2026_BASE}")
    print(f"   and save as: {cache_file}\n")
    
    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        cache_file.write_bytes(resp.content)
        print(f"✓ Downloaded to {cache_file}")
        return cache_file
    except Exception as e:
        print(f"❌ Download failed: {e}")
        print(f"   Please manually download the {level} GeoJSON and place at: {cache_file}")
        sys.exit(1)


def simplify_geometry(geom: Any, tolerance: float = 0.01) -> Any:
    """Simplify geometry to reduce polygon complexity."""
    try:
        return geom.simplify(tolerance, preserve_topology=True)
    except Exception:
        return geom


def project_to_svg(lon: float, lat: float) -> Tuple[float, float]:
    """Project WGS84 (lon, lat) to SVG viewport coordinates (0-1000 x 0-760)."""
    bbox = AUSTRALIA_BBOX
    # Mercator-ish scaling (not true projection, just a bbox fit)
    x = (lon - bbox["minLon"]) / (bbox["maxLon"] - bbox["minLon"]) * SVG_WIDTH
    # Flip Y (lat increases upward, but SVG Y increases downward)
    y = (1 - (lat - bbox["minLat"]) / (bbox["maxLat"] - bbox["minLat"])) * SVG_HEIGHT
    return round(x, 2), round(y, 2)


def extract_polygon_coords(geom: Any) -> List[Tuple[float, float]]:
    """Extract exterior ring coordinates from a Polygon/MultiPolygon."""
    if geom.geom_type == "Polygon":
        return list(geom.exterior.coords)
    elif geom.geom_type == "MultiPolygon":
        # Return largest polygon by area
        largest = max(geom.geoms, key=lambda p: p.area)
        return list(largest.exterior.coords)
    return []


def process_geometry(gdf: gpd.GeoDataFrame, level: str) -> List[Dict[str, Any]]:
    """Process GeoDataFrame into simplified, projected features."""
    features = []
    
    print(f"📐 Processing {len(gdf)} {level} regions...")
    
    for idx, row in gdf.iterrows():
        code = str(row.get(f"{level}_CODE_2021", row.get("code", f"UNKNOWN_{idx}")))
        name = str(row.get(f"{level}_NAME_2021", row.get("name", code)))
        state = str(row.get("STE_CODE_2021", row.get("state", "UNKNOWN")))
        parent_sa4 = str(row.get("SA4_CODE_2021", "")) if level == "SA3" else None
        
        # Simplify geometry
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        
        geom = simplify_geometry(geom, tolerance=0.01)
        coords = extract_polygon_coords(geom)
        
        if len(coords) < 3:
            continue
        
        # Project to SVG
        svg_coords = [project_to_svg(lon, lat) for lon, lat in coords]
        
        features.append({
            "code": code,
            "name": name,
            "state": state,
            "parentSa4": parent_sa4 if parent_sa4 else None,
            "polygon": svg_coords
        })
        
        if (idx + 1) % 50 == 0:
            print(f"   Processed {idx + 1}/{len(gdf)}...")
    
    print(f"✓ Processed {len(features)} features")
    return features


def extract_metadata(features: List[Dict[str, Any]], level: str) -> List[Dict[str, Any]]:
    """Extract SA3/SA4 metadata (code, name, state, parentSa4)."""
    metadata = []
    for f in features:
        meta = {
            "code": f["code"],
            "name": f["name"],
            "state": f["state"],
        }
        if level == "SA3" and f.get("parentSa4"):
            meta["parentSa4"] = f["parentSa4"]
        metadata.append(meta)
    return metadata


def generate_sample_series(features: List[Dict[str, Any]], years: List[int]) -> List[Dict[str, Any]]:
    """
    Generate sample/placeholder series data.
    
    In production, you'd fetch this from:
    - ABS Census (population, dwelling counts)
    - CoreLogic/Domain (median prices, rents)
    - ABS Labour Force / wage data
    
    For now, this generates synthetic data to test the pipeline.
    """
    import random
    random.seed(42)
    
    series = []
    print(f"📊 Generating sample series for {len(features)} regions × {len(years)} years...")
    
    for f in features:
        code = f["code"]
        # Generate plausible ranges based on region (simplified)
        base_price = random.uniform(400_000, 1_200_000)
        base_rent = random.uniform(18_000, 45_000)
        base_wage = random.uniform(55_000, 95_000)
        base_pop = random.uniform(5_000, 150_000)
        base_stock = base_pop / random.uniform(2.3, 2.8)  # ~2.5 persons per dwelling
        
        for year in years:
            year_offset = year - years[0]
            growth = 1.0 + (year_offset * 0.04)  # 4% annual growth (simplified)
            
            series.append({
                "code": code,
                "year": year,
                "medianPrice": round(base_price * growth),
                "medianAnnualRent": round(base_rent * growth),
                "medianAnnualWage": round(base_wage * (1 + year_offset * 0.025)),  # 2.5% wage growth
                "population": round(base_pop * (1 + year_offset * 0.015)),  # 1.5% pop growth
                "dwellingStock": round(base_stock * (1 + year_offset * 0.02)),  # 2% stock growth
                "source": "synthetic",
                "imputed": True
            })
    
    print(f"✓ Generated {len(series)} series rows")
    return series


def main():
    parser = argparse.ArgumentParser(description="Extract ASGS 2026 data for Convex ingestion")
    parser.add_argument("--level", choices=["SA3", "SA4"], required=True, help="ASGS level to extract")
    parser.add_argument("--output-dir", type=Path, default=Path("./data"), help="Output directory")
    parser.add_argument("--cache-dir", type=Path, default=Path("./data/cache"), help="Cache directory for downloads")
    parser.add_argument("--years", type=str, default="2015,2016,2017,2018,2019,2020,2021,2022,2023,2024", help="Comma-separated years for series")
    args = parser.parse_args()
    
    level = args.level
    output_dir = args.output_dir
    cache_dir = args.cache_dir
    years = [int(y) for y in args.years.split(",")]
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*60}")
    print(f"ASGS 2026 {level} Extraction Pipeline")
    print(f"{'='*60}\n")
    
    # Step 1: Download geometry
    geojson_path = download_asgs_geometry(level, cache_dir)
    
    # Step 2: Load and process
    print(f"\n📂 Loading {level} GeoJSON...")
    try:
        gdf = gpd.read_file(geojson_path)
        print(f"✓ Loaded {len(gdf)} features")
        print(f"   Columns: {list(gdf.columns)}")
    except Exception as e:
        print(f"❌ Failed to load GeoJSON: {e}")
        sys.exit(1)
    
    # Step 3: Process geometry
    features = process_geometry(gdf, level)
    
    # Step 4: Extract metadata
    metadata = extract_metadata(features, level)
    
    # Step 5: Generate sample series
    series = generate_sample_series(features, years)
    
    # Step 6: Write outputs
    geom_file = output_dir / f"{level.lower()}_geometry.json"
    meta_file = output_dir / f"{level.lower()}_metadata.json"
    series_file = output_dir / f"{level.lower()}_series.json"
    
    print(f"\n💾 Writing outputs...")
    geom_file.write_text(json.dumps({"features": features}, indent=2))
    print(f"   ✓ {geom_file}")
    
    meta_file.write_text(json.dumps(metadata, indent=2))
    print(f"   ✓ {meta_file}")
    
    series_file.write_text(json.dumps(series, indent=2))
    print(f"   ✓ {series_file}")
    
    print(f"\n{'='*60}")
    print(f"✅ Extraction complete!")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"1. Go to http://localhost:5173/#/sa3-admin")
    print(f"2. Select '{level}'")
    print(f"3. Paste contents of:")
    print(f"   - Geometry: {geom_file}")
    print(f"   - Metadata: {meta_file}")
    print(f"   - Series: {series_file}")
    print(f"4. Click 'Ingest' buttons and recompute caches\n")


if __name__ == "__main__":
    main()
