"""An incomplete catalog or altered privilege must never authorize reconciliation."""

import copy
import runpy
from pathlib import Path

import pytest

RECONCILE = runpy.run_path(str(Path(__file__).resolve().parents[3] / "scripts/pra_migration_reconcile.py"))


def catalog():
    return {"table": {"rls": True, "force_rls": True}, "columns": [1, 2, 3, 4],
            "functions": [{"body": "\nbegin\n return true;\nend\n", "anon_execute": False},
                          {"body": "begin return null; end", "anon_execute": False}],
            "dependency_persist_wheat": "agriclimax_persist_wheat(text,jsonb)"}


def test_crlf_equivalence_does_not_hide_sql_change():
    expected = catalog()
    observed = copy.deepcopy(expected)
    observed["functions"][0]["body"] = expected["functions"][0]["body"].replace("\n", "\r\n")
    assert RECONCILE["compare"](expected, observed)["catalog_matches"]
    observed["functions"][0]["body"] = "begin return false; end"
    assert not RECONCILE["compare"](expected, observed)["catalog_matches"]


@pytest.mark.parametrize("change", ["missing_function", "public_execute", "missing_rls", "column_type"])
def test_schema_or_permission_drift_stops_reconciliation(change):
    expected = catalog()
    observed = copy.deepcopy(expected)
    if change == "missing_function":
        observed["functions"].pop()
    elif change == "public_execute":
        observed["functions"][0]["anon_execute"] = True
    elif change == "missing_rls":
        observed["table"]["force_rls"] = False
    else:
        observed["columns"][0] = "changed"
    assert not RECONCILE["compare"](expected, observed)["catalog_matches"]


def test_two_missing_catalogs_are_not_a_match():
    assert not RECONCILE["compare"]({}, {})["catalog_matches"]


def test_history_alias_requires_sql_identity(tmp_path):
    (tmp_path / "20260101000000_daily.sql").write_text("begin;\nselect 1;\ncommit;\n")
    row = {"version": "20260202000000", "name": "daily", "statements": ["begin;\r\nselect 1;\r\ncommit;\r\n"]}
    assert RECONCILE["history_mapping"]([row], tmp_path)[0]["exact_after_line_ending_normalization"]
    row["statements"] = ["begin; select 2; commit;"]
    assert not RECONCILE["history_mapping"]([row], tmp_path)[0]["exact_after_line_ending_normalization"]
