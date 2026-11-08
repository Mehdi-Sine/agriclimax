"""Scientific guardrails for the shared coverage contract."""
from agriclimax.coverage import qualify_coverage


def test_percentage_does_not_certify_coastal_representativeness() -> None:
    e = {"fraction": .95, "support_id": "synthetic", "mask": "native_valid_cells",
         "represented_area_m2": None, "expected_days": 7, "available_days": 7,
         "continuous": True, "homogeneous": True, "method": "synthetic-1",
         "estimate_certificate": None, "reference_compatible": False}
    assert qualify_coverage(0, "mean_sum", e)["state"] == "observed_partial"
    assert not qualify_coverage(0, "mean_sum", e)["journal_eligible"]
    assert qualify_coverage(None, "mean_sum", e)["state"] == "unavailable"
    e["estimate_certificate"] = "synthetic-reviewed-method-1"
    assert qualify_coverage(0, "mean_sum", e)["state"] == "observed_partial"
    approved = {"synthetic-reviewed-method-1": {"method": "synthetic-1",
                "support_ids": ["synthetic"], "evidence_ids": ["synthetic-test-only"]}}
    assert qualify_coverage(0, "mean_sum", e, approved)["state"] == "qualified_estimate"
    assert qualify_coverage(0, "extreme_event", e)["state"] == "observed_partial"
    e["available_days"] = 6
    assert not qualify_coverage(0, "sequence", e)["indicator_eligible"]
