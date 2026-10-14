"""Server-only, atomic station/day persistence via an invoker RPC."""

import hashlib
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from .meteofrance import NoRedirect, Station
from .models import DayBatch


class SupabaseStationRepository:
    def __init__(self, stations: tuple[Station, ...]):
        self.stations = stations
        base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        parsed = urlsplit(base)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path
        ):
            raise ValueError("Supabase HTTPS origin required")
        if not os.environ.get("SUPABASE_SECRET_KEY"):
            raise ValueError("SUPABASE_SECRET_KEY required")
        self.url = base + "/rest/v1/rpc/agriclimax_persist_station_batch"

    def persist(self, batch: DayBatch) -> bool:
        if batch.provenance.demo or batch.status == "invalid":
            raise ValueError("Only valid live station batches may be persisted")
        payload = batch.model_dump(mode="json")
        stable = json.loads(json.dumps(payload))
        stable["provenance"].pop("retrieved_at")
        for row in stable["observations"]:
            row["provenance"].pop("retrieved_at")
        digest = hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest()
        content = json.dumps(
            {
                "p_batch": payload,
                "p_stations": [s.model_dump(mode="json") for s in self.stations],
                "p_idempotency_key": f"{batch.source_id}:{batch.valid_date}:{digest}",
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
        try:
            with build_opener(NoRedirect()).open(request, timeout=30) as response:
                result = json.load(response)
            if type(result) is not bool:
                raise ValueError("Invalid persistence receipt")
            return result
        except (HTTPError, URLError, TimeoutError, OSError):
            # RPC is atomic; replay is safe after an uncertain transport outcome.
            raise RuntimeError("Supabase station persistence unavailable; replay safely") from None
