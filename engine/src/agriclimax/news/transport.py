"""Bounded HTTPS GET to reviewed hosts only. Redirects and compression are refused."""

import ipaddress
import socket
import time
from dataclasses import dataclass
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

USER_AGENT = "AgriclimaxNews/1.0"
MAX_BYTES = 1_000_000


class FetchError(ValueError):
    def __init__(self, code: str, *, attempts: int = 0) -> None:
        super().__init__(code)
        self.attempts = attempts


def validate_url(url: str, hosts: list[str], *, resolve: bool = False) -> str:
    p = urlsplit(url)
    if (
        p.scheme != "https"
        or p.hostname not in hosts
        or p.username
        or p.password
        or p.port not in (None, 443)
        or p.fragment
        or len(url) > 2048
        or any(ord(c) < 33 for c in url)
        or "\\" in url
    ):
        raise FetchError("untrusted_url")
    if resolve:
        addresses = socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise FetchError("non_public_address")
    return url


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


@dataclass(frozen=True)
class Response:
    body: bytes
    attempts: int


def fetch(
    url: str,
    hosts: list[str],
    *,
    max_bytes: int = MAX_BYTES,
    timeout: float = 10,
    attempts: int = 2,
) -> Response:
    if not 1 <= attempts <= 2 or not 0 < timeout <= 15 or not 0 < max_bytes <= MAX_BYTES:
        raise FetchError("invalid_fetch_budget")
    opener = build_opener(NoRedirect())
    for attempt in range(1, attempts + 1):
        validate_url(url, hosts, resolve=True)
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
            with opener.open(req, timeout=timeout) as response:
                if response.headers.get("Content-Encoding", "identity") != "identity":
                    raise FetchError("compressed_response_refused")
                length = response.headers.get("Content-Length")
                if length and int(length) > max_bytes:
                    raise FetchError("response_too_large")
                deadline = time.monotonic() + timeout
                chunks: list[bytes] = []
                size = 0
                while True:
                    if time.monotonic() > deadline:
                        raise FetchError("response_deadline")
                    chunk = response.read(min(65536, max_bytes + 1 - size))
                    if not chunk:
                        break
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > max_bytes:
                        raise FetchError("response_too_large")
                return Response(b"".join(chunks), attempt)
        except HTTPError as exc:
            # Do not bypass redirects, authorization or rate limits; retry only 5xx.
            if exc.code not in (500, 502, 503, 504) or attempt == attempts:
                raise FetchError(f"http_{exc.code}", attempts=attempt) from exc
        except (URLError, TimeoutError, OSError, HTTPException) as exc:
            if attempt == attempts:
                raise FetchError("network_unavailable", attempts=attempt) from exc
        time.sleep(0.5 * attempt)
    raise FetchError("unavailable")
