"""Download adapters. France stays disabled until URL and parser are confirmed."""

import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class SourcePayload:
    content: bytes
    retrieved_at: datetime


class WeatherProvider(Protocol):
    source_id: str
    demo: bool

    def download(self, day: date) -> SourcePayload: ...
    def decode(self, content: bytes) -> object: ...


class DemoWeatherProvider:
    source_id = "demo-weather"
    demo = True

    def __init__(self, directory: Path):
        self.directory = directory

    def download(self, day: date) -> SourcePayload:
        path = self.directory / f"{day.isoformat()}.json"
        # A missing fixture is explicitly absent, never generated weather.
        content = (
            path.read_bytes()
            if path.exists()
            else json.dumps(
                {"published_at": f"{day}T00:00:00Z", "expected_count": 1, "rows": []}
            ).encode()
        )
        return SourcePayload(content, datetime.now(UTC))

    def decode(self, content: bytes) -> object:
        return json.loads(content)


@dataclass(frozen=True)
class FranceConfig:
    url_template: str
    format_id: str
    confirmed: bool = False
    attempts: int = 3
    timeout_seconds: float = 30
    max_bytes: int = 10_000_000

    def __post_init__(self) -> None:
        parts = urlsplit(self.url_template)
        if (
            parts.scheme != "https"
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
        ):
            raise ValueError("HTTPS URL without embedded credentials/query required")
        if not 1 <= self.attempts <= 5 or self.timeout_seconds <= 0 or self.max_bytes <= 0:
            raise ValueError("Invalid bounded download policy")


class FranceWeatherProvider:
    source_id = "france-weather"
    demo = False

    def __init__(
        self,
        config: FranceConfig,
        decoder: Callable[[bytes], object],
        headers: Callable[[], dict[str, str]] = dict,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.config, self.decoder, self.headers, self.sleep = config, decoder, headers, sleep

    def download(self, day: date) -> SourcePayload:
        if not self.config.confirmed:
            raise ValueError("France source URL/format not confirmed")
        for attempt in range(self.config.attempts):
            try:
                request = Request(
                    self.config.url_template.format(date=day.isoformat()), headers=self.headers()
                )
                with urlopen(request, timeout=self.config.timeout_seconds) as response:
                    content = response.read(self.config.max_bytes + 1)
                if len(content) > self.config.max_bytes:
                    raise ValueError("Source exceeds byte limit")
                return SourcePayload(content, datetime.now(UTC))
            except (HTTPError, URLError, TimeoutError, ConnectionError) as error:
                retryable = not isinstance(error, HTTPError) or error.code in {
                    408,
                    429,
                    500,
                    502,
                    503,
                    504,
                }
                if not retryable or attempt + 1 == self.config.attempts:
                    raise RuntimeError("France download failed") from None
                self.sleep(min(2**attempt, 8))
        raise RuntimeError("Download exhausted")

    def decode(self, content: bytes) -> object:
        return self.decoder(content)
