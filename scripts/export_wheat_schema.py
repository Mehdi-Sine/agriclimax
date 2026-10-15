"""Regenerate private web transport schema/defaults; never changes shared contracts."""

import json
from pathlib import Path

from agriclimax.wheat.models import Parameters, Portfolio

ROOT = Path(__file__).resolve().parents[1]
parameters = Parameters.model_validate_json(
    (ROOT / "config/wheat-mvp.json").read_bytes()
)
target = ROOT / "apps/web/features/wheat"
(target / "portfolio.schema.json").write_text(
    json.dumps(Portfolio.model_json_schema(), indent=2) + "\n"
)
(target / "defaults.json").write_text(
    json.dumps(
        {
            "parameters": parameters.model_dump(),
            "parameter_fingerprint": parameters.fingerprint(),
        },
        indent=2,
    )
    + "\n"
)
