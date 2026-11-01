"""Acquisition invariant: every hourly temperature and next-midnight rain exists in the plan."""

import runpy
from datetime import datetime, timedelta
from pathlib import Path


def test_exact_homologous_daily_inputs_including_september_boundary():
    module = runpy.run_path(str(Path(__file__).resolve().parents[3] / "scripts/pra_climatology.py"))
    queries = module["requests"]()
    fields: dict[str, set[datetime]] = {"2m_temperature": set(), "total_precipitation": set()}
    for query in queries:
        for variable in query["variable"]:
            for year in query["year"]:
                for day in query["day"]:
                    for hour in query["time"]:
                        fields[variable].add(
                            datetime.fromisoformat(f"{year}-{query['month']}-{day}T{hour}:00")
                        )
    for year in range(1991, 2021):
        first = datetime(year, 9, 19)
        for index in range(30):
            day = first + timedelta(days=index)
            assert all(day + timedelta(hours=h) in fields["2m_temperature"] for h in range(24))
            assert day + timedelta(days=1) in fields["total_precipitation"]
    rain_only = [q for q in queries if q["variable"] == ["total_precipitation"]]
    assert rain_only and all(q["time"] == ["00:00"] for q in rain_only)
    assert all(q["area"] == [52, -6, 41, 10] for q in queries)
    assert all(q["data_format"] == "netcdf" for q in queries)


def test_annual_plan_preserves_gregorian_leap_days_and_last_rain_carry():
    import calendar

    module = runpy.run_path(str(Path(__file__).resolve().parents[3] / "scripts/pra_climatology.py"))
    queries = module["annual_requests"]()
    counts: dict[str, dict[int, int]] = {"2m_temperature": {}, "total_precipitation": {}}
    rain_midnights = set()
    for query in queries:
        for year in query["year"]:
            for day in query["day"]:
                for hour in query["time"]:
                    stamp = datetime.fromisoformat(f"{year}-{query['month']}-{day}T{hour}:00")
                    variable = query["variable"][0]
                    counts[variable][stamp.year] = counts[variable].get(stamp.year, 0) + 1
                    if variable == "total_precipitation":
                        assert stamp.hour == 0
                        assert stamp not in rain_midnights
                        rain_midnights.add(stamp)
    for year in range(1991, 2021):
        days = 366 if calendar.isleap(year) else 365
        assert counts["2m_temperature"][year] == days * 24
        assert counts["total_precipitation"][year] == days
        for i in range(days):
            assert datetime(year, 1, 1) + timedelta(days=i + 1) in rain_midnights
    assert counts["total_precipitation"][2021] == 1
    assert len(queries) == 92
