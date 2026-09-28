"""
Reads data/sites.xlsx and writes web/sites.json for the Leaflet map.

Usage:
    python scripts/build_data.py

data/sites.xlsx is the single source of truth. This script never writes
back to it and never invents data (no fake coordinates, no fake crops/
soil/treatments) -- fields that are missing in the workbook are simply
missing (null / empty) in the output, and are flagged so the map can be
honest about what's real.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX_PATH = ROOT / "data" / "sites.xlsx"
OUT_PATH = ROOT / "web" / "sites.json"

# The Sites tab's Country column uses plain names ("United States").
# web/countries.geojson (Natural-Earth-derived world borders) uses the
# formal names below for some countries. Extend this map as Dr. Laza
# adds the other two countries, if their geojson name differs too.
COUNTRY_NAME_ALIASES = {
    "united states": "United States of America",
}

REQUIRED_COLUMNS = [
    "Site_ID", "Site_Name", "Status", "Country", "State", "County", "City",
    "Latitude", "Longitude", "Coord_Source", "Crops", "Soil_Type",
    "Treatments", "Trial_Year", "Contact", "Notes",
]


def split_semicolon_list(value):
    if value is None:
        return []
    text = str(value).strip()
    if not text:
        return []
    return [part.strip() for part in text.split(";") if part.strip()]


def geojson_country_name(country_name):
    if not country_name:
        return None
    return COUNTRY_NAME_ALIASES.get(country_name.strip().lower(), country_name.strip())


def load_rows():
    if not XLSX_PATH.exists():
        print(f"ERROR: {XLSX_PATH} not found.", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    if "Sites" not in wb.sheetnames:
        print("ERROR: workbook has no 'Sites' tab.", file=sys.stderr)
        sys.exit(1)

    ws = wb["Sites"]
    header = [cell.value for cell in ws[1]]
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing_cols:
        print(f"ERROR: Sites tab is missing expected column(s): {missing_cols}", file=sys.stderr)
        sys.exit(1)

    col_index = {name: header.index(name) for name in header if name}

    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[col_index["Site_ID"]] is None and row[col_index["Site_Name"]] is None:
            continue  # blank template row
        rows.append({name: row[idx] for name, idx in col_index.items()})
    return rows


def build_site_record(row, warnings):
    site_id = row.get("Site_ID")
    name = row.get("Site_Name")

    if not site_id or not name:
        warnings.append(f"Skipped a row with no Site_ID/Site_Name: {row!r}")
        return None

    status_raw = (row.get("Status") or "").strip() if row.get("Status") else None
    if status_raw not in ("Tested", "Future"):
        warnings.append(f"{site_id}: Status is '{status_raw}', expected 'Tested' or 'Future' -- flagging as 'Unknown'")
        status = "Unknown"
    else:
        status = status_raw

    country = row.get("Country")
    lat = row.get("Latitude")
    lon = row.get("Longitude")
    has_coords = isinstance(lat, (int, float)) and isinstance(lon, (int, float))

    coord_source = row.get("Coord_Source")
    coord_source_norm = (coord_source or "").strip().lower()
    is_exact = coord_source_norm == "field gps"

    if has_coords and not coord_source:
        warnings.append(f"{site_id}: has coordinates but no Coord_Source -- treating as approximate/unknown")

    record = {
        "site_id": site_id,
        "name": name,
        "status": status,
        "country": country,
        "country_geojson_name": geojson_country_name(country),
        "state": row.get("State"),
        "county": row.get("County"),
        "city": row.get("City"),
        "lat": lat if has_coords else None,
        "lon": lon if has_coords else None,
        "has_coords": has_coords,
        "coord_source": coord_source,
        "is_exact": is_exact,
        "crops": split_semicolon_list(row.get("Crops")),
        "soil_type": row.get("Soil_Type"),
        "treatments": split_semicolon_list(row.get("Treatments")),
        "trial_year": row.get("Trial_Year"),
        "contact": row.get("Contact"),
        "notes": row.get("Notes"),
    }
    return record


def main():
    warnings = []
    rows = load_rows()

    all_sites = []
    for row in rows:
        record = build_site_record(row, warnings)
        if record is not None:
            all_sites.append(record)

    mappable = [s for s in all_sites if s["has_coords"]]
    unmappable = [s for s in all_sites if not s["has_coords"]]

    countries_with_sites = sorted({s["country"] for s in all_sites if s["country"]})

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_file": "data/sites.xlsx",
        "countries_with_sites": countries_with_sites,
        "sites": mappable,
        "sites_missing_coords": unmappable,
        "counts": {
            "total": len(all_sites),
            "mappable": len(mappable),
            "missing_coords": len(unmappable),
            "tested": len([s for s in all_sites if s["status"] == "Tested"]),
            "future": len([s for s in all_sites if s["status"] == "Future"]),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUT_PATH}")
    print(f"  {output['counts']['total']} sites total "
          f"({output['counts']['mappable']} mappable, {output['counts']['missing_coords']} missing coordinates)")
    print(f"  {output['counts']['tested']} Tested, {output['counts']['future']} Future")
    print(f"  Countries with sites: {countries_with_sites}")
    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  - {w}")


if __name__ == "__main__":
    main()
