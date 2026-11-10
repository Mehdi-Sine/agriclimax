"""Station API authentication only. Never infer credential type or log service text."""

import json
import os
import time
from collections.abc import Callable
from contextlib import AbstractContextManager
from http.client import HTTPResponse
from threading import Lock
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request

from .providers import FatalProviderError

TOKEN_URL = "https://portail-api.meteofrance.fr/token"
Product = Literal["climatology", "observations"]


class MeteoFranceAccessError(FatalProviderError):
    """Only fixed diagnostics, never upstream response bodies or credentials."""

    def __init__(self, message: str, *, reason: str = "authentication_invalid_or_expired",
                 status: int | None = None, phase: str = "resource",
                 service_code: str | None = None) -> None:
        super().__init__(message)
        self.reason, self.http_status, self.phase = reason, status, phase
        self.service_code = service_code


class MeteoFranceTransportError(RuntimeError):
    """Safe status/cooldown metadata, no URL, key or upstream response body."""

    def __init__(self, status: int, retry_after: str = "") -> None:
        super().__init__(f"MeteoFrance HTTP {status}")
        self.http_status = status
        self.retry_after = retry_after[:128]


def access_error(error: HTTPError, variable: str, *, phase: str = "resource") -> MeteoFranceAccessError:
    """A 401 alone cannot distinguish a bad, revoked, wrong-type or expired token."""
    try:
        body = json.loads(error.read(4097))
    except (ValueError, OSError):
        body = {}
    finally:
        error.close()
    # Inspect service evidence, return only our own enum and allowlisted codes.
    code = str(body.get("code", "")) if isinstance(body, dict) else ""
    if code not in {"900901", "900902", "900903", "900904", "900905", "900908", "900909"}:
        code = ""
    descriptions = [body.get(k, "") for k in ("message", "description", "error_description")] if isinstance(body, dict) else []
    expired = code == "900903" or any(isinstance(s, str) and "expir" in s.lower() for s in descriptions)
    reason = ("token_expired" if expired else "subscription_not_authorized" if error.code == 403
              else "endpoint_incompatible" if error.code in {404, 405, 410}
              else "authentication_invalid_or_expired")
    if phase == "token" and not expired and error.code in {400, 401, 403}:
        reason = "oauth_application_rejected"
    return MeteoFranceAccessError(f"{variable}: HTTP {error.code}; {reason}", reason=reason,
                                 status=error.code, phase=phase, service_code=code or None)


class StationAuth:
    def __init__(self, product: Product, opener: Callable[..., AbstractContextManager[HTTPResponse]],
                 clock: Callable[[], float] = time.monotonic):
        stem = "METEOFRANCE_CLIMATOLOGY" if product == "climatology" else "METEOFRANCE_OBSERVATIONS"
        self.key_variable, self.application_variable = stem + "_API_KEY", stem + "_APPLICATION_ID"
        # Explicit, documented priority. Never try an API Key as a Bearer token.
        self.mode = "oauth2" if os.environ.get(self.application_variable, "").strip() else "api_key"
        self.variable = self.application_variable if self.mode == "oauth2" else self.key_variable
        if not os.environ.get(self.variable, "").strip():
            raise MeteoFranceAccessError(f"Missing {self.variable}", reason="credential_missing")
        self.opener, self.clock = opener, clock
        self._token, self._expires_at = "", float("-inf")
        self._lock = Lock()

    def invalidate(self) -> None:
        with self._lock:
            self._token, self._expires_at = "", float("-inf")

    def headers(self) -> dict[str, str]:
        value = os.environ.get(self.variable, "").strip()
        if not value or "\n" in value or "\r" in value:
            raise MeteoFranceAccessError(f"Invalid {self.variable}", reason="credential_missing")
        if self.mode == "api_key":
            return {"apikey": value}
        with self._lock:
            if not self._token or self.clock() >= self._expires_at:
                self._obtain(value)
            return {"Authorization": "Bearer " + self._token}

    def _obtain(self, application_id: str) -> None:
        request = Request(TOKEN_URL, data=b"grant_type=client_credentials", method="POST",
                          headers={"Authorization": "Basic " + application_id,
                                   "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"})
        started = self.clock()
        try:
            with self.opener(request, timeout=15) as response:
                raw = response.read(16385)
                if response.status != 200 or len(raw) > 16384:
                    raise ValueError("token contract")
            body = json.loads(raw)
            token, ttl = body["access_token"], body["expires_in"]
            if (not isinstance(token, str) or not token or any(c.isspace() for c in token)
                    or body.get("token_type", "").lower() != "bearer"
                    or isinstance(ttl, bool) or not isinstance(ttl, (int, float)) or not 0 < ttl <= 86400):
                raise ValueError("token contract")
            self._token, self._expires_at = token, started + ttl - min(30, ttl / 10)
        except HTTPError as error:
            if error.code in {408, 429, 500, 502, 503, 504}:
                delay = error.headers.get("Retry-After", "") if error.headers else ""
                error.close()
                raise MeteoFranceTransportError(error.code, delay) from None
            raise access_error(error, self.variable, phase="token") from None
        except (URLError, TimeoutError, OSError):
            raise RuntimeError("OAuth token service unavailable") from None
        except (ValueError, KeyError, TypeError, AttributeError):
            raise MeteoFranceAccessError("OAuth token response incompatible", reason="endpoint_incompatible", phase="token") from None
