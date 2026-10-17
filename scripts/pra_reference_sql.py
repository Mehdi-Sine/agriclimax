"""Generate insert-only SQL from a checksummed PRA bundle; never connects to a DB."""

import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

from agriclimax.territories.reference_sql import reference_sql
from agriclimax.territories.spatial import METHOD, Weight, load_reference


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    a = parser.parse_args()
    expected = {
        "reference.json",
        "weights.json",
        "manifest.json",
        "source-properties.json",
    }
    checksums = json.loads((a.bundle / "checksums.json").read_text())
    if set(checksums) != expected:
        parser.error("Unexpected bundle paths")
    for name, checksum in checksums.items():
        path = a.bundle / name
        if (
            path.stat().st_size > 128 * 1024**2
            or hashlib.sha256(path.read_bytes()).hexdigest() != checksum
        ):
            parser.error("Bundle checksum or size mismatch")
    manifest = json.loads((a.bundle / "manifest.json").read_text())
    territories, report = load_reference(
        json.loads((a.bundle / "reference.json").read_text()),
        version=manifest["reference_version"],
    )
    if report["normalized_sha256"] != manifest["normalized_sha256"]:
        parser.error("Normalized reference digest differs")
    weights = [
        Weight(**row) for row in json.loads((a.bundle / "weights.json").read_text())
    ]
    areas = {t.id: t.area_km2 for t in territories}
    sums: dict[str, float] = defaultdict(float)
    pairs = set()
    for w in weights:
        pair = (w.pra_id, w.cell_id)
        if (
            pair in pairs
            or w.pra_id not in areas
            or w.method != METHOD
            or not all(
                math.isfinite(v)
                for v in [w.weight, w.intersection_km2, w.latitude, w.longitude]
            )
            or w.weight <= 0
            or w.intersection_km2 <= 0
            or w.cell_id != f"era5land.{w.latitude:.1f}.{w.longitude:.1f}"
            or abs(w.longitude * 10 - round(w.longitude * 10)) > 1e-8
            or abs(w.latitude * 10 - round(w.latitude * 10)) > 1e-8
            or abs(w.weight - w.intersection_km2 / areas[w.pra_id]) > 1e-8
        ):
            parser.error("Invalid native-grid weight")
        pairs.add(pair)
        sums[w.pra_id] += w.weight
    if (
        set(sums) != set(areas)
        or any(abs(v - 1) > 1e-4 for v in sums.values())
        or len(weights) != manifest["intersection_count"]
    ):
        parser.error("Incomplete correspondence")
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(reference_sql(territories, weights, manifest))
    print(
        json.dumps(
            {
                "sql_generated": True,
                "database_connected": False,
                "pra": len(territories),
                "weights": len(weights),
            }
        )
    )


if __name__ == "__main__":
    main()
