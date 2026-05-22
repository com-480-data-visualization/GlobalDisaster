import json
from collections import Counter
from pathlib import Path

import pandas as pd

HISTORICAL_ISO = {
    "SUN": "RUS",
    "YUG": "SRB",
    "SCG": "SRB",
    "CSK": "CZE",
    "DDR": "DEU",
    "DFR": "DEU",
    "ANT": "CUW",
    "YMD": "YEM",
    "YMN": "YEM",
    "SPI": "ESP",
    "AZO": "PRT",
    "CHA": "GBR",
    "TWN": "TWN",
}

NUMERIC_COLS = [
    "Start Year", "Start Month", "End Year", "End Month",
    "Total Deaths", "Total Affected",
    "Total Damage ('000 US$)",
]


def is_known(value):
    return pd.notna(value) and value != ""


def as_text(value):
    if not is_known(value):
        return None
    value = str(value).strip()
    return value if value else None


def as_int(value):
    if not is_known(value):
        return None
    return int(float(value))


def resolve_iso(value):
    iso = as_text(value)
    if not iso:
        return None
    iso = iso.upper()
    return HISTORICAL_ISO.get(iso, iso)


def make_clean_row(row):
    return {
        "id": as_text(row.get("DisNo.")),
        "iso3": as_text(row.get("ISO")),
        "country": as_text(row.get("Country")),
        "region": as_text(row.get("Region")),
        "subregion": as_text(row.get("Subregion")),
        "disaster_group": as_text(row.get("Disaster Group")),
        "disaster_type": as_text(row.get("Disaster Type")),
        "disaster_subtype": as_text(row.get("Disaster Subtype")),
        "location": as_text(row.get("Location")),
        "start_year": as_int(row.get("Start Year")),
        "start_month": as_int(row.get("Start Month")),
        "end_year": as_int(row.get("End Year")),
        "end_month": as_int(row.get("End Month")),
        "total_deaths": as_int(row.get("Total Deaths")),
        "total_affected": as_int(row.get("Total Affected")),
        "total_damage_usd_000": as_int(row.get("Total Damage ('000 US$)")),
    }


def make_small_event(row):
    return {
        "id": row["id"],
        "iso3": row["iso3"],
        "country": row["country"],
        "type": row["disaster_type"],
        "subtype": row["disaster_subtype"],
        "location": row["location"],
        "start_year": row["start_year"],
        "end_year": row["end_year"],
        "total_deaths": row["total_deaths"],
        "total_affected": row["total_affected"],
        "total_damage_usd_000": row["total_damage_usd_000"],
    }


def make_global_summary(disasters):
    years = [d["start_year"] for d in disasters if d["start_year"] is not None]
    countries = {d["iso3"] for d in disasters if d["iso3"]}
    type_counts = Counter(d["disaster_type"] or "Unknown" for d in disasters)
    region_counts = Counter(d["region"] or "Unknown" for d in disasters)
    yearly_counts = Counter(years)

    deadliest = sorted(
        [d for d in disasters if d["total_deaths"] is not None],
        key=lambda d: d["total_deaths"],
        reverse=True,
    )[:10]

    year_min = min(years)
    year_max = max(years)
    total = len(disasters)

    return {
        "total_events": total,
        "country_count": len(countries),
        "year_min": year_min,
        "year_max": year_max,
        "data_range_label": f"{year_min}–{year_max}",
        "avg_events_per_year": round(total / (year_max - year_min + 1), 1),
        "source": "EM-DAT",
        "most_common_types": [
            {"type": name, "count": count, "percentage": round(100 * count / total, 1)}
            for name, count in type_counts.most_common(8)
        ],
        "top_regions_by_event_count": [
            {"region": name, "event_count": count, "percentage": round(100 * count / total, 1)}
            for name, count in region_counts.most_common()
        ],
        "events_per_year": [
            {"year": int(year), "count": int(count)}
            for year, count in sorted(yearly_counts.items())
        ],
        "deadliest_events_all_time": [make_small_event(d) for d in deadliest],
    }


def main():
    project_root = Path(__file__).resolve().parents[1]
    input_path = project_root / "data" / "public_emdat.xlsx"
    output_dir = project_root / "Map" / "data"

    df = pd.read_excel(input_path, sheet_name="EM-DAT Data", engine="openpyxl")

    df[NUMERIC_COLS] = df[NUMERIC_COLS].apply(pd.to_numeric, errors="coerce")

    df["ISO"] = df["ISO"].apply(resolve_iso)

    disasters = [make_clean_row(row) for row in df.to_dict(orient="records")]

    outputs = {
        "disasters_clean.json": disasters,
        "global_summary.json": make_global_summary(disasters),
    }

    output_dir.mkdir(parents=True, exist_ok=True)

    for filename, data in outputs.items():
        path = output_dir / filename
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )

main()