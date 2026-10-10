"""Read-only REST inspection. Never print credentials or upstream error bodies.

This cannot prove PostgreSQL extension/index/RLS state. SQL access is required.
"""
import json
import os
import urllib.error
import urllib.request
from datetime import UTC, datetime
from urllib.parse import urlparse


def inspect() -> dict[str, object]:
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise SystemExit("Supabase HTTPS URL missing or invalid")
    roles: dict[str, object] = {}
    report: dict[str, object] = {"inspected_at": datetime.now(UTC).isoformat(),
              "method": "read-only REST; no SQL access", "roles": roles,
              "sql_state": {name: "unverified" for name in ("tables", "postgis", "indexes", "rls", "migration_history")},
              "migrations_applied_by_task04": []}
    for role, variable in (("server", "SUPABASE_SECRET_KEY"),
                           ("publishable", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")):
        key = os.environ.get(variable)
        if not key:
            roles[role] = {"credential": "missing"}
            continue
        outcomes: dict[str, dict[str, object]] = {}
        request = urllib.request.Request(f"{base}/rest/v1/",
                                         headers={"apikey": key, "Accept": "application/openapi+json"})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                document = json.load(response)
                known_tables = {"sources", "productions", "grid_cells", "risk_results", "watch_signals"}
                known_rpcs = {"agriclimax_map_risks", "agriclimax_risk_series", "agriclimax_territory_risks"}
                outcomes["openapi"] = {"http_status": response.status,
                    "task_tables_listed": sorted(known_tables.intersection(document.get("definitions", {}))),
                    "task_rpcs_listed": sorted(name for name in known_rpcs
                                               if f"/rpc/{name}" in document.get("paths", {}))}
        except urllib.error.HTTPError as error:
            outcomes["openapi"] = {"http_status": error.code}
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            outcomes["openapi"] = {"connection": "failed"}
        for name in ("sources", "productions", "grid_cells", "risk_results", "watch_signals"):
            request = urllib.request.Request(f"{base}/rest/v1/{name}?select=id&limit=0",
                                             headers={"apikey": key, "Accept": "application/json"})
            try:
                with urllib.request.urlopen(request, timeout=15) as response:
                    response.read()
                    outcomes[name] = {"http_status": response.status}
            except urllib.error.HTTPError as error:
                # Error bodies may contain sensitive SQL details; record status only.
                outcomes[name] = {"http_status": error.code}
                try:
                    code = json.load(error).get("code")
                    if code in ("PGRST205", "42501", "PGRST106"):
                        outcomes[name]["postgrest_code"] = code
                except (ValueError, AttributeError):
                    pass
            except (urllib.error.URLError, TimeoutError, OSError):
                outcomes[name] = {"connection": "failed"}
        roles[role] = outcomes
    return report


if __name__ == "__main__":
    print(json.dumps(inspect(), indent=2))
