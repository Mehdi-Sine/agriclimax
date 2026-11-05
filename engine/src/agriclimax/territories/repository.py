"""Explicit operator-only persistence; no schema deployment or browser credentials."""

import json
import os
from typing import Any
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from agriclimax.ingestion.meteofrance import NoRedirect


class PraRepository:
    def __init__(self, reference_version: str, dataset_version: str):
        base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
        u = urlsplit(base)
        if (
            u.scheme != "https"
            or not u.hostname
            or u.path not in {"", "/"}
            or u.username
            or u.password
            or u.query
            or u.fragment
        ):
            raise ValueError("Supabase HTTPS origin required")
        if not os.environ.get("SUPABASE_SECRET_KEY"):
            raise ValueError("Server credential required")
        self.url = base.rstrip("/") + "/rest/v1/rpc/agriclimax_persist_pra"
        self.reference_version = reference_version
        self.dataset_version = dataset_version

    def read_day(self, day: str) -> list[dict[str, Any]]:
        """Existing paginated contract; missing rows have no batch_key."""
        rows: list[dict[str, Any]] = []
        after = ""
        for _ in range(8):
            request = Request(
                self.url.replace("agriclimax_persist_pra", "agriclimax_pra_read"),
                data=json.dumps(
                    {
                        "p_reference": self.reference_version,
                        "p_dataset": self.dataset_version,
                        "p_date": day,
                        "p_scope": "france",
                        "p_id": "",
                        "p_after": after,
                        "p_limit": 100,
                    }
                ).encode(),
                headers={
                    "apikey": os.environ["SUPABASE_SECRET_KEY"],
                    "Content-Type": "application/json",
                },
            )
            with build_opener(NoRedirect()).open(request, timeout=30) as response:
                raw = json.loads(response.read(300_001))
            page = raw.get("data")
            if not isinstance(page, list) or len(page) > 100:
                raise ValueError("Invalid PRA read receipt")
            if any(
                not isinstance(r, dict) or not isinstance(r.get("id"), str) or r["id"] <= after
                for r in page
            ):
                raise ValueError("Invalid PRA read identities")
            for row in page:
                if row.get("valid_counts") == [0, 0, 0, 0] and all(
                    row.get(v) is None
                    for v in ("temperature", "temperature_min", "temperature_max", "precipitation")
                ):
                    row["status"] = "unavailable"
            rows.extend(page)
            cursor = raw.get("next_cursor")
            if cursor is None:
                if len({r["id"] for r in rows}) != len(rows):
                    raise ValueError("Duplicate PRA read identities")
                return rows
            if not page or cursor != page[-1]["id"] or cursor <= after:
                raise ValueError("Invalid PRA read cursor")
            after = cursor
        raise ValueError("PRA read exceeded eight pages")

    def persist(self, envelope: dict[str, Any]) -> None:
        content = json.dumps(
            {
                "p_reference": self.reference_version,
                "p_dataset": self.dataset_version,
                "p_envelope": envelope,
            },
            allow_nan=False,
        ).encode()
        request = Request(
            self.url,
            data=content,
            headers={
                "apikey": os.environ["SUPABASE_SECRET_KEY"],
                "Content-Type": "application/json",
            },
        )
        # Keep transport exception type for bounded retry; caller suppresses exception
        # text. No redirects: privileged key can never follow an external location.
        with build_opener(NoRedirect()).open(request, timeout=30) as response:
            result = json.load(response)
        if type(result) is not bool:
            raise ValueError("Invalid PRA persistence receipt")
