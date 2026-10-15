"""Future validated-model seam. No implementation is selected or run by the MVP."""

from datetime import date
from typing import Protocol

from .models import Stage, Window


class ValidatedPhenologyProvider(Protocol):
    """Future integration must supply validation evidence and explicit calendar bounds."""

    model_id: str
    model_version: str
    validation_reference: str

    def window(self, *, station_id: str, stage: Stage, season_start: date) -> Window:
        """Return supplied_stage with stage_source including model/version/validation."""
        ...
