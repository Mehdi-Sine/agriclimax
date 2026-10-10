"""Scan built browser artifacts without printing keys or matching file contents."""
import os
from pathlib import Path

root = Path(__file__).resolve().parents[2]
static = root / "apps/web/.next/static"
if not static.is_dir():
    raise SystemExit("Build browser artifacts first")
needles = [b"SUPABASE_SECRET_KEY", b"sb_secret_", b"test-secret-sentinel"]
secret = os.environ.get("SUPABASE_SECRET_KEY")
if secret:
    needles.append(secret.encode())
files = [p for p in static.rglob("*") if p.is_file()]
for path in files:
    contents = path.read_bytes()
    if any(needle in contents for needle in needles):
        raise SystemExit("FAIL: forbidden secret reference in browser artifacts (content suppressed)")
print(f"PASS: {len(files)} browser artifacts checked; no secret value or forbidden secret reference.")
