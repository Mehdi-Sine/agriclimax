"""Annual storage/acquisition contracts; no new geographic pilot or scientific audit."""

import calendar
import runpy
from datetime import date, timedelta
from pathlib import Path


def test_plan_acquires_exactly_remaining_gregorian_days(monkeypatch):
    scripts = Path(__file__).resolve().parents[3] / "scripts"
    monkeypatch.syspath_prepend(str(scripts))
    functions = runpy.run_path(str(scripts / "pra_climatology_compact.py"))
    actual = set()
    for request in functions["requests"]():
        for year in request["year"]:
            for day in request["day"]:
                d = date(int(year), int(request["month"]), int(day))
                if request["variable"] == ["total_precipitation"]:
                    d -= timedelta(days=1)
                    codes = [3]
                    assert request["time"] == ["00:00"]
                else:
                    codes = [0, 1, 2]
                    assert len(request["time"]) == 24
                if not 1991 <= d.year <= 2020:
                    continue
                for code in codes:
                    assert (d, code) not in actual
                    actual.add((d, code))
    expected = set()
    for year in range(1991, 2021):
        for month in range(1, 13):
            for day in range(1, calendar.monthrange(year, month)[1] + 1):
                d = date(year, month, day)
                if date(2000, month, day).timetuple().tm_yday not in functions["reused_days"]():
                    expected.update((d, code) for code in range(4))
    assert actual == expected
    assert sum(d.month == 2 and d.day == 29 and v == 0 for d, v in actual) == 8
    assert (date(2020, 12, 31), 3) in actual
