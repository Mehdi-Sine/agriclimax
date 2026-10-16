# Daily normalization clock

Base: latest fetched main `6f0c563` (safe ingestion diagnostics, PR #35).
Branch: `fix/daily-normalization-clock`.
Git identity: Mehdi-Sine <mehdi.sine@acta.asso.fr>.

## Analysis and scope

The CLI captures `now` before acquisition. The provider timestamps its payload
when download completes. Passing the initial timestamp to `normalize` therefore
rejects valid provenance as `future_provenance`.

Only Daily orchestration, its synthetic integration tests and its runbook change.
`run_daily` now samples an injectable UTC clock for each normalization, after
acquisition. The initial `now` remains stable for window validation, the report,
the snapshot and wheat `computed_at`. No tolerance, scientific rule, source data,
date window, database behavior or safe diagnostic is changed.

## Validation

- Daily tests: 27 passed, including the existing diagnostic confidentiality tests.
- Regression: start at T0; download advances the clock three seconds and produces
  `retrieved_at > T0`; normalization succeeds. Both injected and default clocks
  are exercised. A timestamp one microsecond beyond validation time still fails
  with `future_provenance`, without persistence or publication.
- Restoring the old normalization timestamp temporarily makes both successful
  regression cases fail (2 failed, 2 passed); the fix was restored afterward.
- Python tests: 143 passed (23 existing dependency warnings).
- Ruff on Daily module/tests/CLI and the CI quality/climate/wheat/cattle module
  and test directories: passed. Strict mypy on Daily/CLI and the 17 source files
  in climate/wheat/cattle: passed.
- An additional Ruff scan of all engine source/tests reports four existing I001
  import errors in unchanged `engine/src/agriclimax/models.py`,
  `engine/tests/test_contracts.py` (two), and `engine/tests/test_indicators.py`.
- `make check`: passed, including quality, contracts, all Python tests, web lint,
  TypeScript, 176 web tests, production build and audit-exception scope.
- Python dependency audits: all three pinned lockfiles pass, no known vulnerabilities.
- JS audit: passes with the existing GHSA-vfj7-8cjw-p6xm development-only exception.
  Browser tooling npm audit: zero vulnerabilities.
- Gitleaks 8.24.2 history and staged changes: passed; Actionlint 1.7.7: passed.
- Production bundle guard, client secret guard and size budget: passed.

Dependencies were installed in ignored work directories from existing lockfiles;
no dependency changes. Validation used synthetic sources, with no live pipeline,
production data writes or remote migration. No merge performed.
