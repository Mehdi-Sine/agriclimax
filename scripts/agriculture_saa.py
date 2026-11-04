"""Acquire/replay the qualified official SAA release into compact versioned server files."""
from __future__ import annotations

import argparse
import hashlib
import json
import urllib.request
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from agriclimax.agriculture.saa import YEARS, read_release
from agriclimax.ingestion.storage import atomic_write

SOURCE = "https://agreste.agriculture.gouv.fr/agreste-web/download/publication/publie/SAA-SeriesLongues/SAA-SeriesLongues-2010-2025_DonneesProvisoires-DepartementalesRegionales.zip"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("work/task25/saa.zip"))
    parser.add_argument("--output", type=Path, default=Path("apps/web/data/agriculture"))
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    if args.download and not args.cache.exists():
        with urllib.request.urlopen(SOURCE, timeout=60) as response:
            content = response.read(32 * 1024 * 1024 + 1)
        if len(content) > 32 * 1024 * 1024:
            raise ValueError("SAA release exceeds reviewed 32 MiB budget")
        atomic_write(args.cache, content)
    content = args.cache.read_bytes()
    sha = hashlib.sha256(content).hexdigest()
    records = defaultdict(list)
    catalog = {}
    controls = []
    samples = []
    for row in read_release(content):
        if row["scale"] == "national_control":
            controls.append(row)
            continue
        key = f"{row['production']}-{row['variable'].lower()}-{row['scale']}"
        if key not in catalog:
            catalog[key] = {k: row[k] for k in ("production", "label", "sheet", "variable", "variable_label", "unit", "scale", "unit_note")}
            catalog[key].update(id=key, years=YEARS, source_id="saa-20260710", sha256=sha)
        records[key].append({k: row[k] for k in ("code", "name", "values", "statuses", "quality_code", "source_anomalies")})
        if row["code"] in {"77", "2A", "2B"} and row["production"] in {"saa-cop-03", "saa-efa-01"}:
            samples.append(row)
    args.output.mkdir(parents=True, exist_ok=True)
    # Deterministic replay: unchanged input produces identical published bytes.
    for key in sorted(records):
        if not any(v is not None for row in records[key] for v in row["values"]):
            del catalog[key]
            continue
        payload = {"indicator": catalog[key], "rows": sorted(records[key], key=lambda r: r["code"])}
        atomic_write(args.output / f"{key}.json", json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode())
    manifest_path = args.output / "saa-manifest.json"
    acquired = datetime.now(UTC).isoformat()
    if manifest_path.exists():
        old = json.loads(manifest_path.read_text())
        if old.get("sha256") == sha:
            acquired = old["acquired_at"]
    manifest = {
        "schema_version": "agriculture-1", "rule_version": "saa-native-20260710-1",
        "source_id": "saa-20260710", "provider": "Agreste / SSP",
        "url": SOURCE, "page_url": "https://agreste.agriculture.gouv.fr/agreste-web/disaron/SAA-SeriesLongues/detail/",
        "license": "Licence Ouverte (data.gouv.fr : fr-lo)", "published_at": "2026-07-10",
        "statistical_cutoff": "2026-03-30", "acquired_at": acquired,
        "sha256": sha, "years": YEARS,
        "statistical_status": {str(y): "provisional" if y == 2025 else "revised_historical" for y in YEARS},
        "scope": "Statistique agricole annuelle ; définitions SSP, séries rétropolées 2010–2019",
        "indicators": [catalog[k] for k in sorted(catalog)],
    }
    atomic_write(manifest_path, json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode())
    evidence = Path("docs/codex/task25")
    evidence.mkdir(parents=True, exist_ok=True)
    atomic_write(evidence / "saa-import.json", json.dumps({
        "source_sha256": sha, "source_bytes": len(content),
        "indicators": len(catalog), "series": sum(len(records[k]) for k in catalog),
        "values": sum(sum(v is not None for v in r["values"]) for k in catalog for r in records[k]),
        "samples": samples, "national_controls": controls,
        "artifact_bytes": sum(p.stat().st_size for p in args.output.glob("saa-*.json")),
    }, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode())
    print(json.dumps({"indicators": len(catalog), "sha256": sha}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
