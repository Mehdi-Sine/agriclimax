"""Independent geographic, climatic and diagnostic coverage, never one blended score."""

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any


def coverage_report(
    reference: dict[str, Any],
    outputs: list[dict[str, Any]],
    start: date,
    end: date,
    storage: dict[str, Any],
) -> dict[str, Any]:
    if not 0 <= (end - start).days < 90:
        raise ValueError("Coverage period must be 1–90 days")
    count = reference["imported_count"]
    dates = {str(start + timedelta(days=i)) for i in range((end - start).days + 1)}
    daily: dict[tuple[str, str], dict[str, Any]] = {}
    successes = []
    wheat: set[str] = set()
    failures = 0
    retrievals: list[str] = []
    for output in outputs:
        if output.get("status") == "failed":
            failures += 1
            continue
        for source in output.get("source_receipts", {}).values():
            retrievals.extend(
                r["retrieved_at"] for r in source.get("receipts", []) if r.get("retrieved_at")
            )
        for r in output.get("daily", []):
            if r["valid_date"] in dates:
                key = (r["pra_id"], r["valid_date"])
                if key in daily and daily[key] != r:
                    raise ValueError("Conflicting source revisions in coverage report")
                daily[key] = r
        if output.get("daily"):
            successes.append(output.get("computed_at"))
        if (
            any(
                start <= date.fromisoformat(r["valid_date"]) <= end for r in output.get("daily", [])
            )
            and output.get("diagnostics")
            and all(d["status"] == "available" for d in output["diagnostics"])
        ):
            wheat.add(output["identity"]["pra"])
    complete = {
        pra
        for pra, _ in daily
        if all((pra, day) in daily and daily[(pra, day)]["status"] == "available" for day in dates)
    }
    available_days = sum(r["status"] == "available" for r in daily.values())
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "from": str(start),
        "to": str(end),
        "geography": {
            k: reference.get(k)
            for k in [
                "imported_count",
                "expected_official_count",
                "valid_geometry_count",
                "area_km2",
                "geographic_coverage_rate",
                "corsica_departments",
                "independent_boundary_gap_check",
            ]
        },
        "climate": {
            "pra_complete_period": len(complete),
            "pra_with_batch_rows": len({p for p, _ in daily}),
            "pra_with_any_data": len(
                {
                    p
                    for (p, _), row in daily.items()
                    if any(v > 0 for v in row.get("valid_counts", []))
                    or any(
                        row.get(v) is not None
                        for v in (
                            "temperature",
                            "temperature_min",
                            "temperature_max",
                            "precipitation",
                        )
                    )
                }
            ),
            "pra_with_any_data_semantics": "At least one valid native value or complete PRA scalar, not merely a published missing-data row",
            "pra_missing_inputs": count - len(complete) if count else None,
            "valid_pra_days": available_days,
            "expected_pra_days": count * len(dates) if count else None,
            "temporal_completeness": available_days / (count * len(dates)) if count else None,
            "last_successful_batch_calculation": max(filter(None, successes), default=None),
            "source_last_successful_ingestion": max(retrievals, default=None),
            "source_freshness": "unknown"
            if not daily
            else "stale"
            if (datetime.now(UTC).date() - end).days > 5
            else "recent_reanalysis_not_live",
        },
        "diagnostics": {
            "wheat_pra_exploratory_available": len(wheat & complete),
            "wheat_expert_validated_pra": 0,
            "wheat_coverage_semantics": "available bounded diagnostic windows within period, not a reconstructed full-period risk",
            "cattle_supported_pra": 0,
            "cattle_reason": "ERA5 provider has no humidity; no grid THI model validation",
        },
        "failed_batches": failures,
        "storage": storage,
        "national_operational_validation": "pending",
        "note": "Geographic count and CI success are not proof of national climate coverage.",
    }


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, allow_nan=False))
    path.with_suffix(".md").write_text(
        "# Territorial coverage report\n\n"
        f"Period UTC: {report['from']} → {report['to']}\n\n"
        f"Geography imported: {report['geography']['imported_count']} PRA.\n\n"
        f"Climate complete period: {report['climate']['pra_complete_period']} PRA; "
        f"temporal completeness: {report['climate']['temporal_completeness']}.\n\n"
        f"Diagnostics: {json.dumps(report['diagnostics'])}\n\n"
        f"Storage (measurements and estimates explicitly labelled): {json.dumps(report['storage'])}\n\n"
        "**CODE READINESS MUST BE ASSESSED SEPARATELY — NATIONAL OPERATIONAL VALIDATION PENDING.**\n"
    )
