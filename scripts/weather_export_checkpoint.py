"""Export one current weather cycle without deleting any acquired source files."""
import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path


def export(root: Path, destination: Path) -> dict[str, object]:
    report = root / "report.json"
    if not report.exists():
        return {"exported": False, "reason": "no_run_report"}
    receipt = json.loads(report.read_text())
    run = datetime.fromisoformat(receipt["run"])
    cycle = root / "cycles" / run.strftime("%Y%m%dT%H")
    if not cycle.exists():
        cycles = sorted((root / "cycles").glob("*"))
        if not cycles:
            return {"exported": False, "reason": "no_acquired_cycle"}
        cycle = cycles[-1]
    files = [p for p in cycle.rglob("*") if p.is_file()]
    size = sum(p.stat().st_size for p in files)
    if size > 448 * 1024**2 or any(p.is_symlink() for p in cycle.rglob("*")):
        raise ValueError("Weather checkpoint export budget exceeded")
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copytree(cycle, destination / "cycles" / cycle.name, dirs_exist_ok=True)
    shutil.copy2(report, destination / "report.json")
    return {"exported": True, "cycle": cycle.name, "bytes": size, "files": len(files)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("work/national-weather"))
    parser.add_argument("--output", type=Path, default=Path("work/national-weather-export"))
    args = parser.parse_args()
    print(json.dumps(export(args.root, args.output)))
