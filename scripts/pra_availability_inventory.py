"""Inventory PRA/native support without confusing a temporal pilot with a static mask.

Offline: no acquisition, inference from neighbours, or database writes. The optional
support file must describe verified native structural availability, not weather
values at one instant. Unknown cells remain unknown in both CSV and JSON.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from agriclimax.territories.availability import inventory


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--support", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    a = parser.parse_args()
    checksums = json.loads((a.bundle / "checksums.json").read_text())
    for name in ("reference.json", "weights.json"):
        if (
            hashlib.sha256((a.bundle / name).read_bytes()).hexdigest()
            != checksums[name]
        ):
            raise ValueError("Reference bundle checksum mismatch")
    result = inventory(
        json.loads((a.bundle / "reference.json").read_text()),
        json.loads((a.bundle / "weights.json").read_text()),
        json.loads(a.support.read_text()) if a.support else None,
    )
    a.output.mkdir(parents=True, exist_ok=True)
    (a.output / "structural-inventory.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    )
    with (a.output / "structural-inventory.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(
            stream, fieldnames=list(result["rows"][0]), lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(result["rows"])
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}))


if __name__ == "__main__":
    main()
