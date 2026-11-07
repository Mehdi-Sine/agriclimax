"""Three-attempt read-only transport retry; callers own all resource accounting."""
import time
from collections.abc import Callable
from http.client import IncompleteRead
from typing import TypeVar
from urllib.error import HTTPError, URLError

T = TypeVar("T")
TRANSIENT = {408, 429, 500, 502, 503, 504}


def retry_read(operation: Callable[[], T], wait: Callable[[float], None] = time.sleep) -> T:
    for attempt in range(3):
        try:
            return operation()
        except HTTPError as error:
            if error.code not in TRANSIENT or attempt == 2:
                raise
            delay = error.headers.get("Retry-After", "") if error.headers else ""
            error.close()
            # A longer server delay is not shortened: defer to a later bounded job.
            if delay and (not delay.isdigit() or int(delay) > 30):
                raise
            wait(max(2 ** (attempt + 1), int(delay or 0)))
        except (URLError, TimeoutError, ConnectionError, IncompleteRead):
            if attempt == 2:
                raise
            wait(2 ** (attempt + 1))
    raise AssertionError("Unreachable retry state")
