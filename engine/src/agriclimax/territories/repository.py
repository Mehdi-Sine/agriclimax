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
