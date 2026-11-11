"""Manual source acquisition must never persist production weather, in any mode."""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

from manual_sources import source_commands


def test_all_acquisitions_are_isolated_and_no_publish_flag_exists(tmp_path):
    commands = source_commands(date(2026, 11, 11), tmp_path)
    assert set(commands) == {'forecast', 'era5', 'stations', 'observations', 'news'}
    for command in commands.values():
        assert '--publish-dev' not in command
        assert 'scripts/daily_live.py' not in command
        assert any(str(tmp_path) in token for token in command)
    for source in ('stations', 'observations'):
        assert '--dry-run' in commands[source]
    assert '--latest-available' in commands['forecast'] or '--run-date' in commands['forecast']


def test_historical_observations_and_station_dates_never_use_today(tmp_path):
    commands = source_commands(date(2026, 10, 10), tmp_path)
    stations = commands['stations']
    assert stations[stations.index('--from')+1] == '2026-10-03'
    assert stations[stations.index('--to')+1] == '2026-10-09'
    forecast = commands['forecast']
    assert forecast[forecast.index('--run-date')+1] == '2026-10-10'
    assert '--latest-available' not in forecast


def test_failed_supplier_does_not_stop_the_other_isolated_acquisitions(tmp_path, monkeypatch):
    import json
    from unittest.mock import Mock

    import manual_sources
    monkeypatch.setattr('sys.argv', ['manual_sources.py', '--edition-date', '2026-11-11', '--root', str(tmp_path)])
    adapter = Mock(return_value=Mock(returncode=1))
    monkeypatch.setattr(manual_sources.subprocess, 'run', adapter)
    manual_sources.main()
    results = json.loads((tmp_path/'results.json').read_text())
    assert len(results) == 5
    assert all(r['status'] in ('failed', 'not_available') for r in results)
    assert adapter.call_count >= 4


def test_national_recipe_over_ten_minutes_and_shared_deadline(tmp_path, monkeypatch):
    import json
    from unittest.mock import Mock

    import manual_sources

    clock = [0.0]
    monkeypatch.setattr(manual_sources.time, 'monotonic', lambda: clock[0])
    monkeypatch.setattr('sys.argv', ['manual_sources.py', '--edition-date', str(manual_sources.datetime.now(manual_sources.UTC).date()), '--root', str(tmp_path)])

    def acquire(*args, **kwargs):
        assert kwargs['timeout'] > 669
        clock[0] = 1251  # No later supplier may exceed the shared bounded owner.
        return Mock(returncode=0)

    adapter = Mock(side_effect=acquire)
    monkeypatch.setattr(manual_sources.subprocess, 'run', adapter)
    manual_sources.main()
    results = json.loads((tmp_path/'results.json').read_text())
    assert adapter.call_count == 1
    assert results[0]['status'] == 'completed'
    assert all(r['status'] == 'not_attempted' for r in results[1:])
