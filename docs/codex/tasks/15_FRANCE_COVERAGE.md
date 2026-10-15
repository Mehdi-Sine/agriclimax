# Task 15 — France metropolitan coverage

Branch `codex/15-france-coverage`, from main `c255e22` (Tasks 11–14).

Inspect Supabase volumes, Task11/12 schemas and national costs before writes.
Expand native ERA5-Land metropolitan spatial support including Corsica. Keep large
NetCDF and historical daily archives outside Postgres; prepare compact climate
references with explicit sufficient coverage. Station and grid supports remain
separate. No interpolation, fabricated data, new crop/livestock rules or contracts.

Bounded progressive backfills, quotas, idempotence, source receipts and resume.
Verify acquisition, row/index/DB volumes, map queries, permissions and duplicates.
Run tests, audits and `make check`; retain evidence in verification/task15.
Push branch and create draft PR; never merge.

Responsibility boundaries: climate ingestion/planning/cache/persistence; station
catalogue selection and Task11 orchestration; bounded map read transport; local
SQL benchmarks and operational documentation. Scientific Wheat and Cattle rules
are unchanged.
