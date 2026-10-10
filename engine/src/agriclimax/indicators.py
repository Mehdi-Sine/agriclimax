"""Daily GDD without capping; Celsius THI formula inherited from the starter."""

from agriclimax.science import finite


def growing_degree_day(tmin: float, tmax: float, base: float) -> float:
    finite(tmin, tmax, base)
    if tmin > tmax:
        raise ValueError("Tmin exceeds Tmax")
    return max(0.0, ((tmin + tmax) / 2.0) - base)


def temperature_humidity_index_celsius(t_c: float, rh_pct: float) -> float:
    finite(t_c, rh_pct)
    if not 0 <= rh_pct <= 100:
        raise ValueError("Humidity outside [0, 100]")
    return (1.8 * t_c + 32) - ((0.55 - 0.0055 * rh_pct) * (1.8 * t_c - 26))
