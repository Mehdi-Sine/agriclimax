"""Bounded same-branch artifact lookup, including the last ERA5 continuation."""
import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path


def restore(kind: str, destination: Path, selected: str = "") -> dict[str, object]:
    names = (["national-weather-checkpoints"] if kind == "weather" else
             ["era5-resume-2-checkpoints", "era5-resume-1-checkpoints", "era5-archive-checkpoints"])
    if selected and not selected.isdigit():
        raise ValueError("Numeric checkpoint run ID required")
    runs = ([selected] if selected else json.loads(subprocess.check_output([
        "gh", "run", "list", "--workflow", "pra-climate.yml", "--branch",
        os.environ["GITHUB_REF_NAME"], "--limit", "20", "--json", "databaseId",
        "--jq", "map(.databaseId | tostring)",
    ])))
    for run in runs:
        if str(run) == os.environ.get("GITHUB_RUN_ID"):
            continue
        metadata = json.loads(subprocess.check_output([
            "gh", "api", f"repos/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{run}/artifacts?per_page=100",
        ]))
        available = {a["name"] for a in metadata["artifacts"] if not a["expired"]}
        # A known checkpoint that cannot be downloaded is an error, never an
        # invitation to start the source cycle again.
        for name in names:
            if name not in available:
                continue
            with tempfile.TemporaryDirectory() as scratch:
                subprocess.run(["gh", "run", "download", str(run), "--name", name,
                                "--dir", scratch], check=True, capture_output=True)
                import shutil
                destination.mkdir(parents=True, exist_ok=True)
                shutil.copytree(scratch, destination, dirs_exist_ok=True)
                return {"restored": True, "run_id": str(run), "artifact": name}
    if selected:
        raise RuntimeError("Explicit checkpoint unavailable; acquisition refused")
    return {"restored": False, "searched_runs": len(runs)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=["weather", "era5"])
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(json.dumps(restore(args.kind, args.destination, os.environ.get("PREVIOUS_RUN", ""))))
