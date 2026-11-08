"""Provider-independent coverage policy. No interpolation or acquisition."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

POLICY = json.loads((Path(__file__).resolve().parents[3] / "config/climate-coverage-1.json").read_text())


def qualify_coverage(
    value: float | None, family: str, e: dict[str, Any],
    certificates: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """JSON-schema-validated adapter evidence; output matches TypeScript exactly."""
    if family not in POLICY["families"]:
        raise ValueError("Unknown indicator family")
    registry = POLICY["estimate_certificates"] if certificates is None else certificates
    certificate = registry.get(e["estimate_certificate"]) or {}
    certified = (certificate.get("method") == e["method"]
                 and e["support_id"] in certificate.get("support_ids", [])
                 and bool(certificate.get("evidence_ids")))
    numeric = value is not None and math.isfinite(value)
    fraction = e["fraction"]
    valid_fraction = fraction is not None and math.isfinite(fraction) and 0 <= fraction <= 1 + POLICY["complete_tolerance"]
    temporal = (isinstance(e["expected_days"], int) and e["expected_days"] > 0
                and e["available_days"] == e["expected_days"] and e["continuous"] and e["homogeneous"])
    state, reason = "unavailable", None
    if not valid_fraction or not e["support_id"] or not e["method"]:
        state, reason = "unknown", "missing_support_metadata"
    elif not numeric or fraction == 0:
        reason = "value_unavailable"
    elif not temporal:
        reason = "incomplete_or_incompatible_period"
    elif family == "normal_anomaly" and not e["reference_compatible"]:
        reason = "incompatible_reference"
    elif fraction >= 1 - POLICY["complete_tolerance"]:
        state = "native_complete"
    elif (POLICY["families"][family]["estimate"] and fraction >= POLICY["estimate_minimum_fraction"]
          and certified and e["mask"] == "native_valid_cells"):
        state = "qualified_estimate"
    elif POLICY["families"][family]["observed"]:
        state, reason = "observed_partial", "observed_area_only"
    else:
        reason = "complete_support_required"
    eligible = state in {"native_complete", "qualified_estimate", "observed_partial"}
    return {"version": POLICY["version"], "state": state, "numeric_value": numeric,
            "scope": "observed_area" if state == "observed_partial" else "whole_pra" if eligible else "unavailable",
            "scientific_status": "exploratory", "indicator_eligible": eligible,
            "journal_eligible": eligible and state != "observed_partial", "reason": reason, "evidence": e}
