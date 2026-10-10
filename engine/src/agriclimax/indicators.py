def growing_degree_day(tmin: float, tmax: float, base: float) -> float:
    """Simple daily GDD. Production use must document clipping/capping policy per indicator."""
    return max(0.0, ((tmin + tmax) / 2.0) - base)

def temperature_humidity_index_celsius(t_c: float, rh_pct: float) -> float:
    """Example implementation; rule-level validity/thresholds remain versioned configuration."""
    return (1.8 * t_c + 32) - ((0.55 - 0.0055 * rh_pct) * (1.8 * t_c - 26))
