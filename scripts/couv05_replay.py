"""Offline-only native proof replay from an existing weather checkpoint ZIP.

Never downloads a source, schedules a workflow or publishes an archive. Reduced
checkpoints are compared, never treated as native evidence or overwritten.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import resource
import shutil
import subprocess
import sys
import time
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import patch

import national_weather_models as reductions
from agriclimax.ingestion.storage import atomic_write
from national_weather_models import model_day, reference, weights_for
from national_weather_sources import Budget, WcsProvider
from probe_operational_access import ORIGIN, capabilities


class CachedWcsProvider(WcsProvider):
    """Use advertised IDs from verified original capabilities, never today's endpoint."""
    def catalogue(self) -> list[str]:
        if not self.ids:
            ids = set()
            for receipt_path in sorted(self.root.glob("*.json")):
                receipt = json.loads(receipt_path.read_text())
                if not receipt.get("url", "").startswith(ORIGIN + self.path + "GetCapabilities?"):
                    continue
                raw = receipt_path.with_suffix(".body").read_bytes()
                if receipt.get("status") != 200 or hashlib.sha256(raw).hexdigest() != receipt["sha256"]:
                    raise ValueError("Corrupt original WCS capabilities")
                ids.update(capabilities(raw))
            if not ids:
                raise ValueError("Verified original WCS capabilities missing")
            self.ids = sorted(ids)
        return self.ids


def extract_checkpoint(archive: Path, destination: Path) -> dict[str, Any]:
    if destination.exists() and any(p.is_symlink() for p in destination.rglob("*")):
        raise ValueError("Checkpoint destination contains symbolic links")
    with zipfile.ZipFile(archive) as source:
        members = source.infolist()
        total = sum(m.file_size for m in members)
        if total > 448 * 1024**2 or len(members) > 3000:
            raise ValueError("Checkpoint extraction budget exceeded")
        for member in members:
            name = Path(member.filename)
            if name.is_absolute() or ".." in name.parts or (member.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Unsafe checkpoint member")
        source.extractall(destination)
    return {"zip_bytes": archive.stat().st_size, "extracted_bytes": total, "files": len(members),
            "zip_sha256": hashlib.sha256(archive.read_bytes()).hexdigest()}


def replay(archive: Path, output: Path) -> dict[str, Any]:
    started = time.monotonic()
    output.mkdir(parents=True, exist_ok=True)
    source = output / "original"
    receipt = extract_checkpoint(archive, source)
    cycles = sorted((source / "cycles").glob("*"))
    if len(cycles) != 1:
        raise ValueError("One explicit checkpoint cycle required")
    cycle = cycles[0]
    comparisons = replay_cycle(cycle, output / "replayed")
    receipt.update(cycle=cycle.name, comparisons=comparisons, source_requests=0, source_bytes=0,
                   seconds=time.monotonic()-started, max_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                   child_max_rss_kib=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss)
    atomic_write(output / "replay.json", json.dumps(receipt, indent=2).encode())
    return receipt


def replay_cycle(cycle: Path, target: Path) -> list[dict[str, Any]]:
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cycle / "cycle.compact.json.gz", target / "cycle.compact.json.gz")
    territories, reference_sha = reference()
    budget = Budget(requests_limit=0, bytes_limit=0)
    comparisons = []
    for model in ("arome", "arpege"):
        weights = weights_for(model, territories, reference_sha, cycle)
        for suffix in ("json.gz", "json.sha256"):
            shutil.copy2(cycle / f"weights-{model}.{suffix}", target / f"weights-{model}.{suffix}")
        provider = CachedWcsProvider(model, cycle, budget)
        for original in sorted((cycle / "reduced").glob(f"{model}-*.json.gz")):
            raw = original.read_bytes()
            if hashlib.sha256(raw).hexdigest() != original.with_suffix(".sha256").read_text():
                raise ValueError("Corrupt original reduced checkpoint")
            saved = json.loads(gzip.decompress(raw))
            run = datetime.fromisoformat(saved["run"])
            from datetime import date
            day = date.fromisoformat(saved["rows"][0]["valid_date"])
            recent_flag = "retrospective_forecast_model_estimate_not_analysis"
            recent = recent_flag in saved["rows"][0]["quality_flags"]
            if any((recent_flag in r["quality_flags"]) != recent for r in saved["rows"]):
                raise ValueError("Original daily temporal classification is inconsistent")
            frozen_day = day + timedelta(days=1) if recent else day
            class ReplayDatetime(datetime):
                as_of_day = frozen_day
                @classmethod
                def now(cls, tz: Any = None) -> datetime:
                    return datetime.combine(cls.as_of_day, datetime.min.time(), UTC).astimezone(tz)
            # Preserve the original forecast/recent-estimate context after UTC rollover.
            # Field issue/validity and acquisition timestamps are still decoded from source evidence.
            with patch.object(reductions, "datetime", ReplayDatetime), patch.dict(os.environ, {"COUV05_CAPTURE_NATIVE_MASKS": "true"}):
                rows, _ = model_day(provider, run, day, territories, weights, target, reference_sha)
            if rows != saved["rows"]:
                raise ValueError(f"Scientific replay differs from original reduced checkpoint: {model}/{day}")
            comparisons.append({"model": model, "day": str(day), "run": run.isoformat(),
                                "rows": len(rows), "identical": True})
            print(json.dumps(comparisons[-1]), flush=True)
    if budget.requests or budget.bytes:
        raise ValueError("Offline WCS replay attempted remote acquisition")
    ifs_target = target / "ifs"
    if not ifs_target.exists():
        shutil.copytree(cycle / "ifs", ifs_target)
    manifest = json.loads((ifs_target / "native-manifest.json").read_text())
    subprocess.run([sys.executable, "scripts/operational_weather_pilot.py", "--scope", "national",
                    "--run-date", manifest["run_date"], "--root", str(ifs_target),
                    "--offline-native", "--execute"], check=True,
                   env={**os.environ, "COUV05_CAPTURE_NATIVE_MASKS": "true"})
    a = json.loads((cycle / "ifs/cycle.json").read_text())
    b = json.loads((ifs_target / "cycle.json").read_text())
    if a["rows"] != b["rows"]:
        raise ValueError("IFS offline replay changed original scientific rows")
    if b["metrics"]["network_requests"] != 0:
        raise ValueError("IFS offline replay attempted acquisition")
    comparisons.append({"model": "ifs", "rows": len(b["rows"]), "identical": True})
    return comparisons



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(replay(args.checkpoint, args.output), indent=2))
