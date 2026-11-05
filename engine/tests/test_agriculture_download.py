"""A truncated or misrouted HTTP range must never enter the official archive cache."""
import runpy
from pathlib import Path
from threading import Event

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


def test_slow_source_range_is_bisected_without_accepting_truncated_body(tmp_path, monkeypatch):
    module = loader(monkeypatch)
    size = 1024 * 1024
    source = bytes(range(256)) * (size // 256)
    archive = tmp_path / 'R11.7z'
    calls = []

    def curl(args, check):
        start, end = map(int, args[args.index('--range')+1].split('-'))
        calls.append((start, end))
        output = Path(args[args.index('--output')+1])
        if start == 0 and end == size-1:
            output.write_bytes(b'unverified truncated response')
            raise module['subprocess'].CalledProcessError(28, args)
        output.write_bytes(source[start:end+1])
        Path(args[args.index('--dump-header')+1]).write_text(f'HTTP/2 206\nContent-Range: bytes {start}-{end}/{size}\n')
    monkeypatch.setattr(module['subprocess'], 'run', curl)
    module['download']('https://example.test/source', archive, size)
    assert archive.read_bytes() == source
    assert (0, size//2-1) in calls and (size//2, size-1) in calls


def test_verified_later_chunk_survives_an_earlier_failure_and_is_reused(tmp_path, monkeypatch):
    module = loader(monkeypatch)
    block = 4 * 1024 * 1024
    source = b'a' * block + b'z'
    archive = tmp_path / 'R11.7z'
    failing = True
    calls = []
    later_response = Event()

    def curl(args, check):
        start, end = map(int, args[args.index('--range')+1].split('-'))
        calls.append(start)
        if failing and start < block:
            if start == 0:
                assert later_response.wait(timeout=5)
            raise module['subprocess'].CalledProcessError(28, args)
        Path(args[args.index('--output')+1]).write_bytes(source[start:end+1])
        Path(args[args.index('--dump-header')+1]).write_text(f'HTTP/2 206\nContent-Range: bytes {start}-{end}/{len(source)}\n')
        if start == block:
            later_response.set()
    monkeypatch.setattr(module['subprocess'], 'run', curl)
    with pytest.raises(module['subprocess'].CalledProcessError):
        module['download']('https://example.test/source', archive, len(source))
    assert not archive.exists()
    assert archive.with_suffix(f'.chunk-{block}').read_bytes() == b'z'
    failing = False
    calls.clear()
    module['download']('https://example.test/source', archive, len(source))
    assert archive.read_bytes() == source
    assert block not in calls
