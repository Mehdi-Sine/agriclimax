"""A truncated or misrouted HTTP range must never enter the official archive cache."""
import runpy
from pathlib import Path

import pytest


def loader(monkeypatch):
    scripts = Path(__file__).resolve().parents[2] / 'scripts'
    monkeypatch.syspath_prepend(str(scripts))
    return runpy.run_path(str(scripts / 'agriculture_rpg.py'))


def test_download_resumes_only_verified_exact_range(tmp_path, monkeypatch):
    module = loader(monkeypatch)
    archive = tmp_path / 'R11.7z'
    archive.with_suffix('.7z.part').write_bytes(b'ab')

    def curl(args, check):
        assert check and args[args.index('--range')+1] == '2-5'
        Path(args[args.index('--output')+1]).write_bytes(b'cdef')
        Path(args[args.index('--dump-header')+1]).write_text('HTTP/2 206\nContent-Range: bytes 2-5/6\n')
    monkeypatch.setattr(module['subprocess'], 'run', curl)
    module['download']('https://example.test/source', archive, 6)
    assert archive.read_bytes() == b'abcdef'
    assert not archive.with_suffix('.7z.part').exists()


@pytest.mark.parametrize('header,payload', [
    ('Content-Range: bytes 0-5/6\n', b'cdef'),
    ('Content-Range: bytes 2-5/6\n', b'cd'),
    ('HTTP/2 200\n', b'cdef'),
])
def test_wrong_or_truncated_range_cannot_modify_prefix(tmp_path, monkeypatch, header, payload):
    module = loader(monkeypatch)
    archive = tmp_path / 'R11.7z'
    prefix = archive.with_suffix('.7z.part')
    prefix.write_bytes(b'ab')

    def curl(args, check):
        Path(args[args.index('--output')+1]).write_bytes(payload)
        Path(args[args.index('--dump-header')+1]).write_text(header)
    monkeypatch.setattr(module['subprocess'], 'run', curl)
    with pytest.raises(ValueError, match='Invalid bounded'):
        module['download']('https://example.test/source', archive, 6)
    assert not archive.exists()
    assert prefix.read_bytes() == b'ab'
