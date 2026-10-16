# Daily wheat station slicing

Branch: `fix/daily-wheat-station-slicing`, based on main `4f4da36`.

## Integration boundary

`run_daily()` now supplies wheat with a shallow copy of each DayBatch filtered
by station. Only the observations tuple changes; date, source, status,
freshness, provenance, schema version and issues remain identical. Observation
objects and their values are reused unchanged. Persistence and cattle still
receive the original multistation batches. Wheat validation, Task 13 science,
Task 14 science and safe diagnostics are unchanged. No contracts, migrations,
remote data or UI changes.

## Regression

The synthetic source contains two stations and three days with distinct daily
temperatures, humidity, precipitation, source checksums and quality flags.
The real daily normalization and calculations complete through publication.
The test checks preserved batch metadata and observation identity, station-specific
wheat precipitation/heat results, no foreign quality flags, and cattle outputs
matching direct calculations on the original batches. Direct wheat calls with
those mixed batches still raise ValueError for each station.

The new test fails against the original main integration (persisted checkpoint,
ValueError), and passes with the fix. These are offline synthetic fixtures,
not evidence of live provider availability.

## Verification (2026-10-16)

- `python -m pytest engine/tests`: 144 passed (23 existing climate warnings).
- `python -m pytest engine/tests/wheat engine/tests/cattle engine/tests/test_daily.py -q`:
  57 passed, including 28 Daily tests.
- Ruff on daily, wheat, cattle source and tests: passed.
- `mypy --strict` on daily, wheat and cattle: passed (9 source files).
- `make check`: passed, including quality/security/migration checks, contracts,
  Python tests, web lint/typecheck, 176 web tests and production build.
- Dependency audits: all three Python lockfiles and browser tooling passed;
  pnpm audit passed with the existing documented GHSA-vfj7-8cjw-p6xm exception.
  Exception audit confirms zero production paths and checks 16 server traces.
- Gitleaks 8.24.2 (verified release checksum): 52 commits scanned, no leaks.
- Client bundle guard, client secret scan (32 artifacts), bundle budget: passed.
- `git diff --check`: passed.

Tooling installed only under ignored `work/`; pnpm 10.0.0 and locked Python
dependencies were used. No live Daily execution or remote DB mutation performed.
No UI change, so responsive/browser interaction checks are not applicable.
Rollback is a revert of this integration change; no schema/data rollback needed.
