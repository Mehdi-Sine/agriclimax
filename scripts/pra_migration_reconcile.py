"""Compare catalog evidence and migration SQL offline; never modifies history/DB.

Capture the local expected daily catalog by replaying the immutable migrations in
a disposable Postgres, then compare it with task19-daily-catalog.sql on the target.
Only CRLF/LF and surrounding whitespace are normalized, never SQL semantics.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def normalize(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace("\r\n", "\n").strip()
    if isinstance(value, list):
        return [normalize(v) for v in value]
    if isinstance(value, dict):
        return {k: normalize(v) for k, v in value.items()}
    return value


def history_mapping(history: list[dict[str, Any]], directory: Path) -> list[dict[str, Any]]:
    result = []
    files = sorted(directory.glob("*.sql"))
    for row in history:
        candidates = [p for p in files if p.stem == row["name"] or p.stem.endswith("_" + row["name"])]
        statement = normalize("\n".join(row["statements"]))
        result.append({
            "remote_version": row["version"], "remote_name": row["name"],
            "git_file": str(candidates[0]) if len(candidates) == 1 else None,
            "normalized_sql_sha256": hashlib.sha256(statement.encode()).hexdigest(),
            "exact_after_line_ending_normalization": len(candidates) == 1
            and statement == normalize(candidates[0].read_text()),
        })
    return result


def compare(expected: dict[str, Any], observed: dict[str, Any]) -> dict[str, Any]:
    keys = sorted(set(expected) | set(observed))
    mismatches = [k for k in keys if normalize(expected.get(k)) != normalize(observed.get(k))]
    # Missing objects in BOTH snapshots must never count as successful reconciliation.
    complete = (expected.get("table") == {"rls": True, "force_rls": True}
                and len(expected.get("columns") or []) == 4
                and len(expected.get("functions") or []) == 2
                and bool(expected.get("dependency_persist_wheat")))
    return {"catalog_matches": not mismatches and complete, "different_sections": mismatches,
            "expected_catalog_complete": complete,
            "comparison": "exact structured equality except CRLF/LF and outer whitespace",
            "remote_ddl_executed": False, "migration_history_modified": False}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--expected-catalog", type=Path, required=True)
    p.add_argument("--observed-catalog", type=Path, required=True)
    p.add_argument("--history", type=Path, required=True)
    p.add_argument("--migrations", type=Path, default=Path("supabase/migrations"))
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    result = compare(json.loads(a.expected_catalog.read_text()), json.loads(a.observed_catalog.read_text()))
    result["history_mapping"] = history_mapping(json.loads(a.history.read_text()), a.migrations)
    matched = {r["git_file"] for r in result["history_mapping"]}
    result["git_files_without_history_row"] = [str(p) for p in sorted(a.migrations.glob("*.sql")) if str(p) not in matched]
    result["history_only_does_not_prove_applied_objects"] = True
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    if not result["catalog_matches"] or not all(r["exact_after_line_ending_normalization"] for r in result["history_mapping"]):
        raise SystemExit("Mismatch: stop; do not replay/repair remote migrations")


if __name__ == "__main__":
    main()
