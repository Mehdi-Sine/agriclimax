"""Explicit synthetic local fixtures for national status and uniqueness checks."""

import json
import runpy
import sys
from datetime import timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
REVIEW = runpy.run_path(str(ROOT / "scripts/pra_national_review.py"))
from pra_national_30day import ALL_WINDOWS, NATIONAL_EDITION


def fixture(monkeypatch, tmp_path):
    ids = [f"pra:{i:05}" for i in range(713)]
    (tmp_path / "reference.json").write_text(
        json.dumps({"features": [{"properties": {"code": p[4:]}} for p in ids]})
    )
    monkeypatch.setitem(REVIEW["inventory"].__globals__, "BUNDLE", tmp_path)
    batches = []
    for pid in ids:
        for start, end in ALL_WINDOWS:
            days = []
            for i in range((end - start).days + 1):
                row = {
                    "pra_id": pid,
                    "valid_date": str(start + timedelta(days=i)),
                    "expected_cells": 1,
                    "valid_counts": [1] * 4,
                    "coverage": [1.0] * 4,
                    "status": "available",
                    **{v: 1.0 for v in REVIEW["VARIABLES"]},
                }
                if pid in ids[:2]:
                    row.update(
                        expected_cells=2,
                        valid_counts=[0 if pid == ids[0] else 1] * 4,
                        coverage=[0.0 if pid == ids[0] else 0.5] * 4,
                        status="partial",
                        **{v: None for v in REVIEW["VARIABLES"]},
                    )
                days.append(row)
            batches.append(
                {
                    "identity": {
                        "pra": pid,
                        "dataset": {"dataset_version": NATIONAL_EDITION},
                        "parameters": None,
                    },
                    "diagnostics": [],
                    "daily": days,
                }
            )
    return batches


def test_national_statuses_include_all713_and_keep_missing_values(monkeypatch, tmp_path):
    report = REVIEW["inventory"](fixture(monkeypatch, tmp_path))
    assert report["pra_days"] == 21390 and len(report["availability"]) == 713
    assert report["pra_states"] == {"unavailable": 1, "partial": 1, "complete": 711}
    assert report["availability"][0]["null_scalar_count"] == 120


@pytest.mark.parametrize("fault", ["duplicate", "missing", "diagnostics", "fabricated_full_value"])
def test_national_inventory_rejects_incorrect_publications(monkeypatch, tmp_path, fault):
    batches = fixture(monkeypatch, tmp_path)
    if fault == "duplicate":
        batches[0]["daily"][1] = batches[0]["daily"][0]
    elif fault == "missing":
        batches[0]["daily"].pop()
    elif fault == "diagnostics":
        batches[0]["diagnostics"] = [{"synthetic": "forbidden"}]
    else:
        batches[0]["daily"][0]["temperature"] = 1.0
    with pytest.raises(ValueError):
        REVIEW["inventory"](batches)
