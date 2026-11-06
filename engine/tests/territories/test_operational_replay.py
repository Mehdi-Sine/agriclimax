"""Replay retained real IFS inputs without network; protect reviewed scientific output."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def test_real_pilot_is_reproducible_offline_without_grib_reacquisition(tmp_path):
    root = Path(__file__).parents[3]
    source = root / "config/pilots/ifs-oper-20261105-00z"
    for name in ("native.json.gz", "native.json.sha256", "native-manifest.json"):
        shutil.copyfile(source / name, tmp_path / name)
    program = """
import runpy, sys
module = runpy.run_path(sys.argv[1])
def forbidden(*args, **kwargs):
    raise AssertionError('Scientific replay must never access the network')
module['main'].__globals__['urlopen'] = forbidden
sys.argv = ['pilot','--run-date','2026-11-05','--root',sys.argv[2],'--offline-native','--execute']
module['main']()
"""
    subprocess.run(
        [
            sys.executable,
            "-c",
            program,
            str(root / "scripts/operational_weather_pilot.py"),
            str(tmp_path),
        ],
        cwd=root,
        env={**os.environ, "PYTHONPATH": str(root / "engine/src"), "OPENBLAS_NUM_THREADS": "1"},
        check=True,
        capture_output=True,
    )
    actual = json.loads((tmp_path / "cycle.json").read_text())
    public = json.loads((root / "apps/web/data/operational/cycle.json").read_text())
    assert actual["rows"] == public["rows"]
    assert actual["metrics"]["network_requests"] == actual["metrics"]["downloaded_bytes"] == 0
    assert len(actual["rows"]) == 420
