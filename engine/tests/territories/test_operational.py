import pytest
from shapely.geometry import box, mapping

from agriclimax.territories.operational import grid_weights, humidity
from agriclimax.territories.spatial import Territory, projected


def test_independent_grid_weights_cover_coastal_fragment_without_era5_reuse():
    geometry = mapping(box(-4.6, 48.1, -4.4, 48.2))
    t = Territory(
        "pra:29102",
        "29102",
        "synthetic geometry test only",
        "29",
        "Finistere",
        "53",
        "Bretagne",
        geometry,
        projected(geometry).area / 1e6,
    )
    ws = grid_weights([t])
    assert abs(sum(w.weight for w in ws) - 1) < 0.0001
    assert all(w.cell_id.startswith("ifs.") for w in ws)
    assert len(ws) > 1
    with pytest.raises(ValueError):
        grid_weights([t], 0.1)


def test_humidity_units_saturation_and_impossible_dewpoint():
    assert humidity(293.15, 293.15) == 100
    assert 52 < humidity(293.15, 283.15) < 54
    with pytest.raises(ValueError):
        humidity(280, 290)


@pytest.mark.parametrize("following_midnight", [263.15, 303.15])
def test_daily_extrema_exclude_following_midnight_but_mean_integrates_it(following_midnight):
    from agriclimax.territories.operational import daily_temperature

    steps = list(range(0, 25, 3))
    values = [283.15] * 8 + [following_midnight]
    mean, low, high = daily_temperature(values, steps)
    assert low == high == 10
    assert abs(mean - (10 + (following_midnight - 283.15) / 16)) < 1e-10
    values[4] = None
    assert daily_temperature(values, steps) == (None, None, None)
