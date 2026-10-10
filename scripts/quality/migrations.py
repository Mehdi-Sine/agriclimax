"""Forward-only migration inventory; SQL execution is a separate CI job."""
import argparse
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def check(root: Path, base: str | None = None) -> list[str]:
    errors = []
    paths = sorted((root / 'supabase/migrations').glob('*.sql'))
    if not paths:
        return ['No SQL migrations found']
    versions = set()
    for path in paths:
        match = re.fullmatch(r'(\d{4,14})_[a-z0-9_]+\.sql', path.name)
        if not match:
            errors.append(f'{path.name}: invalid migration filename')
            continue
        version = int(match[1])
        if version in versions:
            errors.append(f'{path.name}: duplicate migration version')
        versions.add(version)
        if not path.read_text().strip():
            errors.append(f'{path.name}: empty migration')
    if base:
        # A missing base is an error, never silently skip the forward-only check.
        subprocess.run(['git', 'rev-parse', '--verify', base + '^{commit}'], cwd=root,
                       check=True, stdout=subprocess.DEVNULL)
        changed = subprocess.check_output(
            ['git', 'diff', '--no-renames', '--name-status', base, '--', 'supabase/migrations'],
            cwd=root, text=True,
        )
        for line in changed.splitlines():
            status, path = line.split('\t', 1)
            if status != 'A':
                errors.append(f'{path}: existing migration changed ({status})')
        old = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', base,
                                       '--', 'supabase/migrations'], cwd=root, text=True)
        old_versions = [int(Path(p).name.split('_')[0]) for p in old.splitlines() if p.endswith('.sql')]
        maximum = max(old_versions, default=-1)
        for line in changed.splitlines():
            status, path = line.split('\t', 1)
            if status == 'A' and int(Path(path).name.split('_')[0]) <= maximum:
                errors.append(f'{path}: new migration must follow base version {maximum}')
    return errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base')
    args = parser.parse_args()
    errors = check(ROOT, args.base)
    if errors:
        print('\n'.join(errors))
        raise SystemExit(1)
    print('Migration inventory/forward-only guard passed.')
