"""Conservative compressed asset budget; not a Core Web Vitals measurement."""
import gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 2 * 1024 * 1024


def check(directory: Path, limit: int = LIMIT) -> int:
    files = [p for p in directory.rglob('*') if p.suffix in {'.js', '.css'}]
    if not files:
        raise ValueError('Missing client JS/CSS build')
    size = sum(len(gzip.compress(p.read_bytes(), mtime=0)) for p in files)
    if size > limit:
        raise ValueError(f'Client assets gzip {size} bytes exceed {limit} bytes')
    return size


if __name__ == '__main__':
    print(f'Total client JS/CSS gzip: {check(ROOT / "apps/web/.next/static")} bytes (budget {LIMIT}).')
