"""Bounded private RPC transport. No browser credentials, no Task11/12 writes."""

import json
import os
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from agriclimax.climate.persistence import content_key
from agriclimax.ingestion.meteofrance import NoRedirect

from .models import Portfolio


class WheatRepository:
    def __init__(self) -> None:
        base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        url = urlsplit(base)
        if (
            url.scheme != "https"
            or not url.hostname
            or url.username
            or url.password
            or url.path
            or url.query
            or url.fragment
            or not os.environ.get("SUPABASE_SECRET_KEY")
        ):
            raise ValueError("Server Supabase HTTPS origin and secret required")
        self.base = base

    def rpc(self, name: str, body: dict[str, object]) -> object:
        request = Request(
            self.base + "/rest/v1/rpc/" + name,
            data=json.dumps(body, allow_nan=False).encode(),
            headers={
                "apikey": os.environ["SUPABASE_SECRET_KEY"],
                "Content-Type": "application/json",
            },
        )
        # An uncertain write is replayable with the same computed_at and inputs.
        with build_opener(NoRedirect()).open(request, timeout=60) as response:
            return json.loads(response.read(16_000_001))

    def persist(self, portfolio: Portfolio) -> bool:
        payload = portfolio.model_dump(mode="json")
        receipt = self.rpc(
            "agriclimax_persist_wheat", {"p_key": content_key(payload), "p_payload": payload}
        )
        if type(receipt) is not bool:
            raise ValueError("Invalid wheat persistence receipt")
        return receipt
