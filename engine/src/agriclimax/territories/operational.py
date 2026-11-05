"""Exploratory IFS grid adapter using the existing area/aggregation primitives."""

import math
from dataclasses import asdict

from shapely.geometry import box, mapping, shape

from .pipeline import digest
from .spatial import Territory, Weight, projected

PILOT_CODES = (
    "28341",
    "29102",
    "50081",
    "06245",
    "13244",
    "2A258",
    "2B260",
    "05457",
    "15167",
    "31391",
    "01446",
    "14085",
)
GRID = "ifs-regular-0p25-centre-footprints-epsg3035-1"


def grid_weights(territories: list[Territory], spacing: float = 0.25) -> list[Weight]:
    """Independent grid weights; total PRA area, densified native footprints.

    These are footprint averages, not an assertion that a grid point is an
    areal measurement. Ocean-intersecting cells are retained and flagged.
    """
    if spacing != 0.25:
        raise ValueError("Only the verified IFS 0.25 degree grid is supported")
    result = []
    for t in territories:
        polygon = projected(t.geometry)
        west, south, east, north = shape(t.geometry).bounds
        selected = []
        for y in range(
            math.ceil((south - spacing / 2) / spacing),
            math.floor((north + spacing / 2) / spacing) + 1,
        ):
            for x in range(
                math.ceil((west - spacing / 2) / spacing),
                math.floor((east + spacing / 2) / spacing) + 1,
            ):
                lon, lat = x * spacing, y * spacing
                cell = box(
                    lon - spacing / 2, lat - spacing / 2, lon + spacing / 2, lat + spacing / 2
                ).segmentize(0.01)
                area = polygon.intersection(projected(mapping(cell))).area
                if area > 0.01:
                    selected.append(
                        Weight(
                            t.id,
                            f"ifs.{lat:.2f}.{lon:.2f}",
                            lon,
                            lat,
                            area / 1e6,
                            area / polygon.area,
                        )
                    )
        if abs(sum(w.weight for w in selected) - 1) > 0.0001:
            raise ValueError("IFS footprints do not cover the PRA")
        result.extend(selected)
    return result


def weight_fingerprint(weights: list[Weight]) -> str:
    return digest([asdict(w) for w in weights])


def humidity(temperature_k: float, dewpoint_k: float) -> float:
    """Magnus water-surface approximation; exploratory, no supersaturation clamp."""
    t, d = temperature_k - 273.15, dewpoint_k - 273.15
    value = 100 * math.exp(17.625 * d / (243.04 + d) - 17.625 * t / (243.04 + t))
    if not math.isfinite(value) or not 0 <= value <= 100.5:
        raise ValueError("Invalid RH from T/dewpoint")
    return min(100.0, value)


def read_grib(
    path: str, expected_step: int, expected_param: str, cells: set[str], run_date: int | None = None
) -> dict[str, float | None]:
    # ecCodes is dynamically typed; keep the optional decoder out of planning imports.
    import eccodes as ec  # type: ignore[import-untyped]

    with open(path, "rb") as stream:
        handle = ec.codes_grib_new_from_file(stream)
        if handle is None:
            raise ValueError("No GRIB message")
        try:
            if (
                ec.codes_get(handle, "edition") != 2
                or ec.codes_get(handle, "gridType") != "regular_ll"
                or ec.codes_get(handle, "shortName") != expected_param
                or int(ec.codes_get(handle, "endStep")) != expected_step
                or abs(float(ec.codes_get(handle, "iDirectionIncrementInDegrees")) - 0.25) > 1e-8
                or abs(float(ec.codes_get(handle, "jDirectionIncrementInDegrees")) - 0.25) > 1e-8
            ):
                raise ValueError("Unexpected IFS grid/parameter/step")
            if run_date is not None and (
                int(ec.codes_get(handle, "dataDate")) != run_date
                or int(ec.codes_get(handle, "dataTime")) != 0
            ):
                raise ValueError("GRIB run does not match its index")
            if ec.codes_get(handle, "units") != ("m" if expected_param == "tp" else "K"):
                raise ValueError("Unexpected GRIB units")
            if expected_param == "tp" and (
                ec.codes_get(handle, "stepType") != "accum"
                or int(ec.codes_get(handle, "startStep")) != 0
            ):
                raise ValueError("Expected rain accumulation since model run")
            lats, lons, values = (
                ec.codes_get_array(handle, k) for k in ["latitudes", "longitudes", "values"]
            )
            missing = ec.codes_get(handle, "missingValue")
            result: dict[str, float | None] = {}
            for lat, lon, v in zip(lats, lons, values, strict=True):
                lon = (float(lon) + 180) % 360 - 180
                if not -6.5 <= lon <= 10.5 or not 40.5 <= lat <= 52.5:
                    continue
                key = f"ifs.{float(lat):.2f}.{lon:.2f}"
                if key in cells:
                    result[key] = float(v) if v != missing and math.isfinite(v) else None
            if set(result) != cells:
                raise ValueError("Missing IFS native support")
            if ec.codes_grib_new_from_file(stream) is not None:
                raise ValueError("Expected exactly one selected GRIB field")
            return result
        finally:
            ec.codes_release(handle)
