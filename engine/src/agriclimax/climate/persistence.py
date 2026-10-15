"""Private server RPC transport; immutable content revisions, no live table writes."""

import hashlib
import json
import os
import time
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from agriclimax.ingestion.meteofrance import NoRedirect

from .models import ClimateResult, ReferenceDay


def content_key(payload: dict[str, object]) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


class SupabaseClimateRepository:
    def __init__(self) -> None:
        base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        parsed = urlsplit(base)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path
            or parsed.query
            or parsed.fragment
            or not os.environ.get("SUPABASE_SECRET_KEY")
        ):
            raise ValueError("Supabase HTTPS origin and SUPABASE_SECRET_KEY required")
        self.url = base + "/rest/v1/rpc/agriclimax_persist_climate"

    def persist(self, value: ReferenceDay | ClimateResult) -> bool:
        payload = value.model_dump(mode="json")
        kind: Literal["reference", "indicator"] = (
            "reference" if isinstance(value, ReferenceDay) else "indicator"
        )
        # Retrieval receipts remain part of the immutable provenance revision.
        # Exact replays reuse the verified source receipt and consequently the key.
        content = json.dumps(
            {"p_kind": kind, "p_payload": payload, "p_key": content_key(payload)}, allow_nan=False
        ).encode()
        for attempt in range(3):
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
                    raise ValueError("Invalid climate persistence receipt")
                return result
            except (HTTPError, URLError, TimeoutError, OSError) as error:
                retryable = not isinstance(error, HTTPError) or error.code in {
                    408,
                    429,
                    500,
                    502,
                    503,
                    504,
                }
                if not retryable or attempt == 2:
                    raise RuntimeError(
                        "Climate persistence failed; replay the same cached inputs"
                    ) from None
                time.sleep(2**attempt)
        raise RuntimeError("Climate persistence exhausted")
