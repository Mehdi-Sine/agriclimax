"""The operational pilot must keep its geographic strata and native-tile identity."""

import json
import runpy
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = runpy.run_path(str(ROOT / "scripts/pra_pilot_sample.py"))
RUN = runpy.run_path(str(ROOT / "scripts/pra_pilot_run.py"))


def test_sample_is_reproducible_and_keeps_required_coverage():
    bundle = ROOT / "config/coverage/ofb-masa-pra-2017-snapshot-20261017"
    source = json.loads((bundle / "reference.json").read_text())
    published = json.loads((ROOT / "config/pilots/pra73-v1.json").read_text())
    result = SAMPLE["select"](source, published["reference_version"])
    assert result == published
    codes = {r["code"] for r in result["selection"]}
    assert len(codes) == 73
    assert set(SAMPLE["ANCHORS"]) <= codes
    assert {"29102", "2A258", "2B260", "09472", "39449", "74458", "13469", "69196"} <= codes
    assert len({r["region"] for r in result["selection"]}) == 13
    assert not result["statistically_representative"]
    assert not result["scientific_geometry_modified"]


def test_native_grid_roundoff_does_not_move_integer_boundary_to_wrong_tile():
    # Validated native 0.1-degree coordinates, not arbitrary points or interpolation.
    for coordinate, expected in [
        (48.999999999999986, 49),
        (-5.0000000000000036, -5),
        (3.99999999999999, 4),
    ]:
        assert RUN["native_tile"](coordinate, 45.0) == (expected, 45)


@pytest.mark.parametrize("phase", ["persist", "replay"])
def test_remote_pilot_rejects_another_project_before_creating_outputs(
    monkeypatch, tmp_path, phase
):
    root = tmp_path / "untouched"
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://another.supabase.co")
    monkeypatch.setattr("sys.argv", ["pilot", "--phase", phase, "--root", str(root)])
    with pytest.raises(SystemExit) as error:
        RUN["main"]()
    assert error.value.code == 2
    assert not root.exists()
