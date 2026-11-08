"""No-data versus failure, gap repair, Paris DST, and durable pointer recovery."""
import copy
import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]/'scripts'))
from data01_daily import inspect, next_day, publication_deadline
from pra_weather_store import ArchiveStore


def test_repair_hole_before_latest_and_no_provider_assumption():
    known = {date(2026, 10, 31), date(2026, 11, 2)}
    assert next_day({date(2026, 11, 2)}, date(2026, 10, 30), date(2026, 11, 8))[0] == date(2026, 10, 31)
    assert next_day(known, date(2026, 10, 30), date(2026, 11, 8)) == (date(2026, 11, 1), 'missing_archive')
    assert next_day({date(2026, 11, 2)}, date(2026, 11, 1), date(2026, 11, 8)) == (None, 'waiting_for_provider_window')
    report = inspect({'era5':[{'dates':['2026-11-02']}]}, datetime(2026,11,8,tzinfo=UTC))
    assert report['status'] == 'within_conservative_reanalysis_window'
    assert report['provider_delivery_verified'] is False
    assert inspect({'era5':[]}, datetime(2026,11,8,tzinfo=UTC))['status']=='error'


@pytest.mark.parametrize('day,hour', [('2026-03-28',5),('2026-03-29',4),('2026-10-24',4),('2026-10-25',5)])
def test_paris_deadline_survives_dst(day, hour):
    assert publication_deadline(date.fromisoformat(day)).hour == hour
    assert publication_deadline(date.fromisoformat(day)).minute == 30


def test_failed_snapshot_does_not_touch_current_and_replay_is_idempotent():
    objects = {'current.json': b'previous verified cycle'}
    calls=[]
    def request(path, method='GET', body=None, upsert=False):
        key=path.split('pra-climate-archives/')[-1]
        calls.append((key,method))
        if method=='GET':return objects.get(key,b'')
        if key=='current.json' and fail[0]:raise RuntimeError('interrupted before pointer')
        objects[key]=body
        return b'{}'
    with patch.dict('os.environ',{'NEXT_PUBLIC_SUPABASE_URL':'https://yyfbpecxvxglzxopsmel.supabase.co','SUPABASE_SECRET_KEY':'test'}):
        store=ArchiveStore()
        catalogue={'version':'pra-archive-catalogue-1','weather':[],'era5':[{'dates':['2026-11-01']} ]}
        old=copy.deepcopy(catalogue)
        fail=[True]
        with patch.object(store,'request',side_effect=request):
            with pytest.raises(RuntimeError):store.publish_current(catalogue)
            assert objects['current.json']==b'previous verified cycle'
            assert any(k.startswith('catalogues/') for k in objects)
            fail[0]=False
            store.publish_current(catalogue)
            writes=len([c for c in calls if c[1]!='GET'])
            store.publish_current(catalogue)
            assert len([c for c in calls if c[1]!='GET'])==writes
            assert json.loads(objects['current.json'])['catalogue_revision'].startswith('catalogues/')
        assert catalogue==old
