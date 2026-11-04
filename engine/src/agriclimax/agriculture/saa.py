"""Reader for the actual SSP 2010–2025 provisional departmental/regional XLSX release.

No guessed column aliases or conversions: fail closed when the publisher changes its schema.
The release's quality code is retained verbatim and is not an intensity/risk score.
"""
from __future__ import annotations

import io
import math
import re
import zipfile
from collections.abc import Iterator
from typing import Any

import openpyxl

YEARS = list(range(2010, 2026))
VARIABLES = {
    "SURF": ("Surface", "ha"),
    "SURF_TOT": ("Surface totale", "ha"),
    "SURF_PROD": ("Surface en production", "ha"),
    "REND": ("Rendement", "q/ha"),
    "PROD": ("Production récoltée", "q"),
    "EFF": ("Effectif en fin d’année", "têtes"),
    "LAIT": ("Production laitière", "hl"),
}
SHEETS = ("COP", "FOU", "EFA", "EFV", "LAI", "VIG")


def statistical_value(raw: object) -> tuple[float | None, str]:
    """Keep real zero separate from absent, confidential and unavailable values."""
    if raw is None or raw == "":
        return None, "unavailable"
    if isinstance(raw, str):
        if raw.strip().lower() in {"s", "secret", "secret statistique"}:
            return None, "suppressed"
        if raw.strip() in {"..", "...", "nd", "ND", "-"}:
            return None, "unavailable"
        raise ValueError(f"Unknown statistical convention: {raw!r}")
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
        raise ValueError("Invalid statistical value")
    if raw < 0:
        return None, "unavailable"
    return float(raw), "available"


def geography(label: str, scale: str) -> tuple[str, str]:
    code, name = label.split(" - ", 1)
    # SSP pads departmental codes to 3 characters; retain Corsican 2A/2B.
    if scale == "departement":
        code = code.lstrip("0").zfill(2)
    elif code in {"971", "972", "973", "974", "976"}:
        code = {"971": "01", "972": "02", "973": "03", "974": "04", "976": "06"}[code]
    return code, name


def read_release(content: bytes) -> Iterator[dict[str, Any]]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        members = archive.namelist()
        if len(members) != 2 or not all(n.endswith(".xlsx") for n in members):
            raise ValueError("Expected the two official SAA XLSX workbooks")
        for member in sorted(members):
            scale = "departement" if "departementales" in member else "region"
            workbook = openpyxl.load_workbook(
                io.BytesIO(archive.read(member)), read_only=True, data_only=True
            )
            try:
                for sheet_name in SHEETS:
                    if sheet_name not in workbook:
                        continue
                    sheet = workbook[sheet_name]
                    # Publisher declares A1 despite thousands of rows. Do not trust dimensions.
                    sheet.reset_dimensions()
                    rows = iter(sheet.values)
                    preamble = [next(rows) for _ in range(6)]
                    if "30/03/2026" not in str(preamble[2][0]) or "2025 provisoires" not in str(preamble[2][0]):
                        raise ValueError("Unreviewed SAA release/status")
                    headers = list(preamble[5])
                    required = ["LIB_REG2", "LIB_SAA", "STATUT_QUALITE"]
                    if scale == "departement":
                        required.append("LIB_DEP")
                    if not all(h in headers for h in required):
                        raise ValueError("Unrecognized SAA dimensions")
                    for row in rows:
                        if not row or not row[0]:
                            continue
                        cells = dict(zip(headers, row))
                        label = str(cells["LIB_SAA"])
                        if not re.match(r"^\d+ - ", label):
                            raise ValueError("Unrecognized SAA production nomenclature")
                        code, name = geography(str(cells.get("LIB_DEP", cells["LIB_REG2"])), scale)
                        # France / metropolitan aggregates are controls, never region polygons.
                        effective_scale = "national_control" if scale == "region" and code in {"001", "002"} else scale
                        for variable in VARIABLES:
                            columns = [f"{variable}_{y}" for y in YEARS]
                            if not any(c in headers for c in columns):
                                continue
                            if not all(c in headers for c in columns):
                                raise ValueError("Incomplete SAA calendar columns")
                            values, statuses = zip(*(statistical_value(cells.get(c)) for c in columns))
                            unit = "milliers de têtes" if sheet_name == "EFV" else VARIABLES[variable][1]
                            yield {
                                "production": f"saa-{sheet_name.lower()}-{label.split(' - ', 1)[0]}",
                                "label": label.split(" - ", 1)[1],
                                "sheet": sheet_name, "variable": variable,
                                "variable_label": VARIABLES[variable][0], "unit": unit,
                                "scale": effective_scale, "code": code, "name": name,
                                "values": list(values), "statuses": list(statuses),
                                "quality_code": str(cells["STATUT_QUALITE"]),
                                "source_anomalies": {str(y): cells[c] for y, c in zip(YEARS, columns) if isinstance(cells.get(c), (float, int)) and cells[c] < 0},
                                "unit_note": str(preamble[1][0]), "workbook": member,
                            }
            finally:
                workbook.close()
