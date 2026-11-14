"""Export only the current archive day; retain all original files and historical evidence."""

import argparse
import json
import re
import shutil
from pathlib import Path


def export(root: Path, destination: Path) -> dict[str, object]:
    report_path = root / "report.json"
    candidate = root / "sim-candidate"
    # SIM errors must never prevent the pre-existing ERA checkpoint export.
    try:
        if not candidate.is_symlink() and (candidate / "index.json").exists():
            candidate_files = [p for p in candidate.rglob("*") if p.is_file()]
            if (not any(p.is_symlink() for p in candidate_files)
                    and sum(p.stat().st_size for p in candidate_files) <= 16 * 1024**2):
                shutil.copytree(candidate, destination / "sim-candidate", dirs_exist_ok=True)
    except OSError:
        pass  # optional shadow checkpoint, original ERA export continues
    if not report_path.exists():
        return {"exported": False, "reason": "no_run_report"}
    report = json.loads(report_path.read_text())
    if not report.get("date"):
        return {"exported": False, "reason": "no_new_archive_day"}
    day = report["date"]
    if not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("Reviewed checkpoint date required")
    source = root / day
    files = [p for name in ["tiles", "batches", "source-cache"] for p in (source / name).rglob("*") if p.is_file()]
    files += [p for p in source.glob("exact.json*") if p.is_file()]
    if any(p.is_symlink() for p in files) or sum(p.stat().st_size for p in files) > 448 * 1024**2:
        raise ValueError("Checkpoint export exceeds safe workspace budget")
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copy2(report_path, destination / "report.json")
    for path in files:
        target = destination / day / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
    return {"exported": True, "date": day, "files": len(files), "bytes": sum(p.stat().st_size for p in files), "source_files_deleted": 0}


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=Path("work/era5-archive"))
    p.add_argument("--output", type=Path, default=Path("work/era5-archive-export"))
    args = p.parse_args()
    print(json.dumps(export(args.root, args.output)))
