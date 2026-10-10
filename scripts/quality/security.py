"""Offline guards. Findings expose paths/rules only, never matched credentials."""
import argparse
import base64
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATTERNS = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "supabase-secret": re.compile(r"sb_secret_[A-Za-z0-9_-]{20,}"),
    "github-token": re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})"),
    "aws-key": re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}"),
    "credential-assignment": re.compile(
        r"(?:SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)|DATABASE_URL|API_SECRET)"
        r"\s*[=:]\s*[\"']?(?!\$|process\.|os\.|<|example|placeholder)([A-Za-z0-9:/_.+-]{24,})"
    ),
}
JWT = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
SERVER_NAMES = re.compile(r"SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)|sb_secret_|service_role")


def findings(text: str) -> set[str]:
    result = {name for name, pattern in PATTERNS.items() if pattern.search(text)}
    for token in JWT.findall(text):
        try:
            part = token.split('.')[1]
            payload = json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
            if payload.get('role') == 'service_role':
                result.add('supabase-service-role-jwt')
        except (ValueError, UnicodeError):
            continue
    return result


def tracked_files(root: Path) -> list[Path]:
    paths = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others',
                                     '--exclude-standard'], cwd=root).decode().split('\0')
    return [root / p for p in paths if p and (root / p).is_file()]


def scan_sources(root: Path) -> list[str]:
    errors = []
    for path in tracked_files(root):
        text = path.read_bytes().decode('utf-8', errors='replace')
        errors.extend(f'{path.relative_to(root)}: {rule}' for rule in sorted(findings(text)))
        if path.name.startswith('.env') and path.name != '.env.example':
            errors.append(f'{path.relative_to(root)}: tracked environment file')
        if path.suffix in {'.ts', '.tsx', '.js', '.jsx', '.mjs'} and 'apps/web' in str(path):
            if re.search(r'NEXT_PUBLIC_[A-Z_]*(?:SECRET|SERVICE_ROLE|PRIVATE)', text):
                errors.append(f'{path.relative_to(root)}: privileged public environment variable')
            if re.search(r'^[\s;]*[\"\']use client[\"\']', text, re.MULTILINE) and SERVER_NAMES.search(text):
                errors.append(f'{path.relative_to(root)}: privileged reference in client module')
    return errors


def scan_bundle(directory: Path, sentinel: str | None = None) -> list[str]:
    if not directory.is_dir():
        return [f'{directory}: missing client build (run build first)']
    files = sorted(p for p in directory.rglob('*') if p.is_file())
    if not any(p.suffix == '.js' for p in files):
        return ['Client bundle contains no JavaScript']
    errors = []
    for path in files:
        text = path.read_bytes().decode('utf-8', errors='replace')
        rules = findings(text)
        if SERVER_NAMES.search(text):
            rules.add('privileged-reference')
        if sentinel and sentinel in text:
            rules.add('server-sentinel-leak')
        errors.extend(f'{path.relative_to(directory)}: {rule}' for rule in sorted(rules))
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--bundle', type=Path)
    args = parser.parse_args()
    errors = scan_bundle(args.bundle, os.getenv('QUALITY_SERVER_SENTINEL')) if args.bundle else scan_sources(ROOT)
    if errors:
        print('\n'.join(errors))
        raise SystemExit(1)
    print('Client bundle guard passed.' if args.bundle else 'Source secret guard passed.')


if __name__ == '__main__':
    main()
