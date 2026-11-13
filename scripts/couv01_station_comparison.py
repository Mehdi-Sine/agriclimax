"""Bounded public Météo-France station diagnostics; no station is territorial truth.

Stations may be assimilated by SAFRAN: this is an external point comparison, not
an independent held-out validation. Selection uses geography/completeness only.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
from agriclimax.territories.weather_archive import decode
from pyproj import Transformer
from safran_pilot import Acquisition
from shapely.geometry import Point, shape
from shapely.ops import transform

CATALOGUE = "https://www.data.gouv.fr/api/1/datasets/6569b51ae64326786e4e8e1a/"
SAMPLES = {
    "pra:29102": "29",
    "pra:50081": "50",
    "pra:13244": "13",
    "pra:2A258": "20",
    "pra:2B260": "20",
    "pra:28341": "28",
    "pra:05236": "05",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("work/couv01/stations"))
    parser.add_argument(
        "--evidence", type=Path, default=Path("docs/codex/COUV-01/evidence")
    )
    parser.add_argument("--acquire", action="store_true")
    args = parser.parse_args()
    acquisition = Acquisition(args.root)
    if args.acquire:
        catalogue = json.loads(
            acquisition.get("catalogue.json", CATALOGUE).read_bytes()
        )
        for dep in sorted(set(SAMPLES.values())):
            entry = next(
                r
                for r in catalogue["resources"]
                if r["title"] == f"QUOT_departement_{dep}_periode_2025-2026_RR-T-Vent"
            )
            acquisition.get(dep + ".csv.gz", entry["url"])
        entry = next(r for r in catalogue["resources"] if r.get("format") == "pdf")
        acquisition.get("description.pdf", entry["url"])
    reference = json.loads(
        Path(
            "config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json"
        ).read_bytes()
    )
    features = {"pra:" + f["properties"]["code"]: f for f in reference["features"]}
    dates = [str(date(2026, 10, 31) + timedelta(days=i)) for i in range(6)]
    daily = {}
    summary = json.loads((args.evidence / "summary.json").read_bytes())
    snapshot = args.evidence / "snapshots" / summary["source_sha256"]
    manifest = json.loads((snapshot / "manifest.json").read_bytes())
    for day in dates:
        entry = next(e for e in manifest["days"] if e["date"] == day)
        doc = decode((snapshot / (day + ".json.gz")).read_bytes(), entry["sha256"])
        daily.update({(r["pra_id"], r["date"], r["variable"]): r for r in doc["rows"]})
    project = Transformer.from_crs(4326, 3035, always_xy=True)
    results: list[dict[str, Any]] = []
    selected_native: list[dict[str, str]] = []
    for pra, dep in SAMPLES.items():
        polygon = shape(features[pra]["geometry"])
        centre = transform(project.transform, polygon).centroid
        stations: dict[str, dict[str, dict[str, Any]]] = {}
        for row in csv.DictReader(
            io.StringIO(
                gzip.decompress((args.root / (dep + ".csv.gz")).read_bytes()).decode()
            ),
            delimiter=";",
        ):
            day = row["AAAAMMJJ"]
            iso = f"{day[:4]}-{day[4:6]}-{day[6:]}"
            if iso not in dates or not row["TM"] or row["QTM"] not in {"0", "1"}:
                continue
            point = Point(float(row["LON"]), float(row["LAT"]))
            if not polygon.covers(point):
                continue
            stations.setdefault(row["NUM_POSTE"], {})[iso] = row
        candidates = []
        for station, rows in stations.items():
            if set(rows) != set(dates):
                continue
            meta = next(iter(rows.values()))
            point = transform(
                project.transform, Point(float(meta["LON"]), float(meta["LAT"]))
            )
            candidates.append((point.distance(centre), station))
        if not candidates:
            results.append(
                {
                    "pra_id": pra,
                    "status": "no_inside_station_with_six_quality_0_or_1_TM_days",
                }
            )
            continue
        distance, station = min(candidates)
        rows = stations[station]
        meta = next(iter(rows.values()))
        for var, field, qfield in [
            ("temperature_mean", "TM", "QTM"),
            ("precipitation", "RR", "QRR"),
        ]:
            differences = []
            pairs = []
            for day, row in sorted(rows.items()):
                if not row[field] or row[qfield] not in {"0", "1"}:
                    continue
                sim = daily[pra, day, var]
                value = (
                    sim["value"] if sim["value"] is not None else sim["partial_value"]
                )
                if value is None:
                    continue
                observed = float(row[field])
                delta = value - observed
                differences.append(delta)
                pairs.append(
                    {
                        "date": day,
                        "sim": value,
                        "station": observed,
                        "difference": delta,
                        "sim_state": sim["state"],
                        "coverage": sim["spatial_coverage"],
                        "station_quality": row[qfield],
                    }
                )
            if not differences:
                continue
            a = np.array(differences)
            results.append(
                {
                    "pra_id": pra,
                    "station_id": station,
                    "station_name": meta["NOM_USUEL"],
                    "station_lat": float(meta["LAT"]),
                    "station_lon": float(meta["LON"]),
                    "station_altitude_m": float(meta["ALTI"]),
                    "inside_pra": True,
                    "candidate_stations": len(candidates),
                    "centroid_distance_m": distance,
                    "variable": var,
                    "unit": "degC" if var == "temperature_mean" else "mm",
                    "pairs": pairs,
                    "bias": float(a.mean()),
                    "mae": float(np.abs(a).mean()),
                    "p95_absolute": float(np.quantile(np.abs(a), 0.95)),
                    "minimum_difference": float(a.min()),
                    "maximum_difference": float(a.max()),
                    "validation_scope": "external_point_diagnostic_not_held_out_or_territorial_validation",
                }
            )
        selected_native.extend({"pra_id": pra, **r} for r in rows.values())
    args.evidence.mkdir(parents=True, exist_ok=True)
    (args.evidence / "station-comparison.json").write_text(
        json.dumps(
            {
                "selection": "nearest projected PRA centroid among inside stations with 6 TM days quality 0/1; no value-based selection",
                "start": dates[0],
                "end": dates[-1],
                "results": results,
                "source_calls": acquisition.calls,
                "source_bytes": acquisition.bytes,
                "station_may_be_assimilated": True,
                "sim_date_label_alignment": "nominal same dates; rain 06UTC-06UTC, hourly mean temperature",
                "not_a_scientific_acceptance_certificate": True,
            },
            indent=2,
        )
    )
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(selected_native[0]))
    writer.writeheader()
    writer.writerows(selected_native)
    (args.evidence / "selected-station-rows.csv.gz").write_bytes(
        gzip.compress(buffer.getvalue().encode(), mtime=0)
    )
    print(
        json.dumps(
            {
                "diagnostics": len(results),
                "point_pairs": sum(len(r.get("pairs", [])) for r in results),
                "source_calls": acquisition.calls,
                "source_bytes": acquisition.bytes,
            }
        )
    )


if __name__ == "__main__":
    main()
