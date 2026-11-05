"""Equal national ID counts do not prove correct regional ownership."""
import hashlib
import sqlite3

from agriclimax.agriculture.identity import ownership_digests


def test_region_transfer_is_detected_even_when_no_id_is_lost():
    with sqlite3.connect(':memory:') as db:
        db.execute('create table parcel_identity_v2 (id text primary key, region text)')
        db.executemany('insert into parcel_identity_v2 values (?,?)', [('a','11'),('b','24'),('c','24')])
        expected = {'11': hashlib.sha256(b'a\nb').hexdigest(), '24': hashlib.sha256(b'c').hexdigest()}
        wrong = ownership_digests(db, expected)
        assert not wrong['11']['matches_checkpoint'] and not wrong['24']['matches_checkpoint']
        assert sum(value['owned_ids'] for value in wrong.values()) == 3
        db.execute("update parcel_identity_v2 set region='11' where id='b'")
        corrected = ownership_digests(db, expected)
        assert all(value['matches_checkpoint'] for value in corrected.values())
