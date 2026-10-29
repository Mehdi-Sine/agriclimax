"""Restricted workflow adapter: no schema deployment, persistence or national fan-out."""

import json
import os
import re
import subprocess
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path


def main() -> int:
    directory = Path(os.environ["REFERENCE_DIRECTORY"]).resolve()
    if not directory.is_relative_to(Path("config/coverage").resolve()):
        raise ValueError("Reference directory must stay under config/coverage")
    ids = [p for p in os.environ.get("PRA_IDS", "").split(",") if p]
    national = os.environ.get("NATIONAL_AUTHORIZED") == "true"
    if not (0 if national else 1) <= len(ids) <= 4 or any(
        not re.fullmatch(r"pra:[0-9AB]{4,8}", i) for i in ids
    ):
        raise ValueError("Explicit one-to-four PRA pilot selection required")
    manifest = json.loads((directory / "manifest.json").read_text())
    start = date.fromisoformat(
        os.environ.get("DATE_FROM") or str(datetime.now(UTC).date() - timedelta(days=5))
    )
    end = date.fromisoformat(os.environ.get("DATE_TO") or str(start))
    args = [
        sys.executable,
        "scripts/pra_climate.py",
        "--reference",
        str(directory / "reference.json"),
        "--weights",
        str(directory / "weights.json"),
        "--reference-version",
        manifest["reference_version"],
        "--dataset-version",
        os.environ["DATASET_VERSION"],
        "--from",
        str(start),
        "--to",
        str(end),
        "--max-batches",
        "713" if national else "1",
        "--max-downloads",
        "1",
    ]
    if national:
        args += ["--national-authorized"]
    for pra in ids:
        args += ["--pra", pra]
    if os.environ.get("EXECUTE_BATCH") == "true":
        args += ["--execute"]
    return subprocess.run(args, check=False, timeout=1400).returncode


if __name__ == "__main__":
    raise SystemExit(main())
