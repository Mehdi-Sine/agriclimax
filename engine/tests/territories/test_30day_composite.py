"""Explicit synthetic fixtures for edition composition and full-period diagnostics."""

import copy
import json
import runpy
import sys
from datetime import timedelta
from pathlib import Path

import pytest

from agriclimax.territories.spatial import Weight
from agriclimax.wheat.models import Parameters

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
REVIEW = runpy.run_path(str(ROOT / "scripts/pra_30day_review.py"))
RUN = runpy.run_path(str(ROOT / "scripts/pra_30day_run.py"))


def envelopes():
    old = []
    new = []
    start = RUN["START"]
    identity = RUN["dataset"]().model_dump(mode="json")
    for item in json.loads((ROOT / "config/pilots/pra73-v1.json").read_text())["selection"]:
        for edition, first, last, destination in [
            (REVIEW["OLD_EDITION"], start + timedelta(days=23), REVIEW["LAST"], old),
            *[(RUN["EDITION"], s, e, new) for s, e in RUN["WINDOWS"]],
        ]:
            days = [str(first + timedelta(days=i)) for i in range((last - first).days + 1)]
            destination.append(
                {
                    "identity": {
                        "pra": item["id"],
                        "dataset": identity | {"dataset_version": edition},
                        "reference_geometry_sha256": "synthetic-geometry",
                        "weights_sha256": "synthetic-weights",
                        "method": "pra-native-1",
                        "parameters": None,
                    },
                    "diagnostics": [],
                    "batch_key": "synthetic-batch",
                    "computed_at": "2026-10-30T08:00:00Z",
                    "daily": [
                        {
                            "pra_id": item["id"],
                            "valid_date": day,
                            "temperature": 1.0,
                            "temperature_min": 0.0,
                            "temperature_max": 2.0,
                            "precipitation": 0.0,
                            "valid_counts": [1] * 4,
                            "expected_cells": 1,
                            "coverage": [1.0] * 4,
                            "status": "available",
                        }
                        for day in days
                    ],
                }
            )
    return old, new


def test_explicit_two_edition_composition_has_exactly_30_days_per_pra():
    old, new = envelopes()
    result = REVIEW["composite"](old, new)
    assert result["pra_days"] == 2190
    assert result["states"] == {"complete": 2190}
    assert len(result["component_editions"]) == 2


@pytest.mark.parametrize("fault", ["weights", "method", "dataset", "gap", "overlap", "diagnostics"])
def test_incoherent_composite_is_rejected(fault):
    old, new = envelopes()
    new = copy.deepcopy(new)
    if fault == "weights":
        new[0]["identity"]["weights_sha256"] = "different"
    elif fault == "method":
        new[0]["identity"]["method"] = "different"
    elif fault == "dataset":
        new[0]["identity"]["dataset"]["transformation_version"] = "different"
    elif fault == "gap":
        new[0]["daily"].pop()
    elif fault == "overlap":
        new[0]["daily"].append(new[0]["daily"][0])
    else:
        new[0]["diagnostics"] = [{"synthetic": "forbidden systematic diagnostic"}]
    with pytest.raises(ValueError):
        REVIEW["composite"](old, new)


def test_on_demand_heat_spell_spans_week_and_edition_boundaries():
    parameters = Parameters.model_validate_json((ROOT / "config/wheat-mvp.json").read_text())
    rows = {}
    for i in range(30):
        rows["synthetic-cell", str(RUN["START"] + timedelta(days=i))] = {
            "temperature": 15.0,
            "temperature_min": 5.0,
            "temperature_max": parameters.heat_threshold_c + 1 if i >= 15 else 10.0,
            "precipitation": 0.0,
        }
    weight = Weight("pra:28341", "synthetic-cell", 0.0, 0.0, 1.0, 1.0, "total-area-epsg3035-1")
    value = REVIEW["diagnostic"](
        "pra:28341", rows, [weight], parameters, ["synthetic-old", "synthetic-new"]
    )
    assert value["indicators"]["heat_spell_max"]["value"] == 15
    assert not value["risk_computed"]


@pytest.mark.parametrize("phase", ["persist", "replay"])
def test_30day_writer_rejects_other_project(monkeypatch, tmp_path, phase):
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://another.supabase.co")
    monkeypatch.setattr(
        sys, "argv", ["pilot", "--phase", phase, "--root", str(tmp_path / "untouched")]
    )
    with pytest.raises(SystemExit) as error:
        RUN["main"]()
    assert error.value.code == 2
    assert not (tmp_path / "untouched").exists()


def test_http_comparison_accepts_only_expected_float4_serializations():
    import numpy as np
    from pra_30day_http import float4_matches

    for value in [0.0, -3.141592653589, 12.3456789, 234.56789123]:
        stored = float(np.float32(value))
        assert float4_matches(float(str(np.float32(value))), value)
        assert float4_matches(float(format(stored, ".6g")), value)
        assert not float4_matches(stored + 0.01, value)


def test_modified_inputs_cannot_reuse_an_old_independent_proof(tmp_path):
    import hashlib

    archive = tmp_path / "tiles/synthetic.json.gz"
    archive.parent.mkdir()
    archive.write_bytes(b"synthetic compact fixture")
    content = b"synthetic raw fixture"
    sha = hashlib.sha256(content).hexdigest()
    raw = tmp_path / "source-cache/sources" / (sha + ".source")
    raw.parent.mkdir(parents=True)
    raw.write_bytes(content)
    proof = {
        "tile_inputs_sha256": RUN["digest"](
            [(archive.name, hashlib.sha256(archive.read_bytes()).hexdigest())]
        ),
        "source_files": {sha: {}},
    }
    RUN["verify_proof_inputs"](tmp_path, proof)
    archive.write_bytes(b"controlled changed compact bytes")
    with pytest.raises(ValueError, match="compact"):
        RUN["verify_proof_inputs"](tmp_path, proof)
    archive.write_bytes(b"synthetic compact fixture")
    raw.write_bytes(b"controlled changed raw bytes")
    with pytest.raises(ValueError, match="raw"):
        RUN["verify_proof_inputs"](tmp_path, proof)
