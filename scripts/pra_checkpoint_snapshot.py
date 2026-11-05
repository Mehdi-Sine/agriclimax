"""Export only the explicit recovery window; never delete original checkpoints."""

import gzip
import hashlib
import json
import shutil
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write


def snapshot(root: Path, destination: Path) -> dict[str, int]:
    if destination.exists():
        raise ValueError("Snapshot destination must be new")
    report = json.loads((root / "run.json").read_text())
    days = set(report.get("requested_dates", []))
    selected = []
    for path in sorted((root / "tiles").glob("*.json.gz")):
        raw = path.read_bytes()
        sidecar = path.with_suffix(".sha256")
        if hashlib.sha256(raw).hexdigest() != sidecar.read_text():
            raise ValueError("Corrupt checkpoint")
        rows = json.loads(gzip.decompress(raw))["rows"]
        if any(r["valid_date"] in days for r in rows):
            selected.extend([path, sidecar])
    for path in sorted((root / "batches").glob("*/output.json")):
        identity = json.loads(path.read_text())["identity"]
        if any(identity["start"] <= d <= identity["end"] for d in days):
            selected.append(path)
            completed = path.with_name("completed.json")
            if completed.exists():
                selected.append(completed)
    for name in ("run.json", "state.json"):
        if (root / name).exists():
            selected.append(root / name)
    total = 0
    for path in selected:
        target = destination / path.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        total += path.stat().st_size
    result = {"files": len(selected), "bytes": total, "recovery_dates": len(days)}
    atomic_write(destination / "snapshot.json", json.dumps(result, indent=2).encode())
    return result


if __name__ == "__main__":
    print(json.dumps(snapshot(Path("work/pra-daily"), Path("work/pra-daily-export"))))
