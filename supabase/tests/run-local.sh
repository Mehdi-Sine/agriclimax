#!/usr/bin/env bash
# LOCAL ONLY. Disposable containers; no remote URLs or credentials are consumed.
set -euo pipefail
task04_root="$(cd "$(dirname "$0")/../.." && pwd)"
task04_mode="${1:-public}"
case "$task04_mode" in public|extensions) ;; *) echo 'Usage: run-local.sh [public|extensions]' >&2; exit 2 ;; esac
task04_container="agriclimax-task04-test-${task04_mode}-$$"
task04_results="$task04_root/work/task04-${task04_mode}"
task04_image='postgis/postgis:17-3.5@sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6'
task04_docker() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
    docker --host=unix:///var/run/docker.sock "$@"
}
task04_psql() {
  task04_docker exec -e PGOPTIONS='-csearch_path=public,extensions' "$task04_container" \
    psql -U postgres -d agriclimax_task04 -v ON_ERROR_STOP=1 "$@"
}
task04_docker info --format '{{.ServerVersion}}' >/dev/null
mkdir -p "$task04_results"
task04_docker run --detach --name "$task04_container" \
  --mount "type=bind,src=$task04_root,dst=/repo,readonly" \
  -e POSTGRES_PASSWORD=agriclimax_local_test "$task04_image" >/dev/null
trap 'task04_docker rm --force "$task04_container" >/dev/null' EXIT
task04_ready=false
for task04_attempt in {1..50}; do
  # The image starts a temporary server during init; wait for the final PID 1
  # postgres process, otherwise initialization can stop it during the tests.
  if task04_docker exec "$task04_container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' >/dev/null 2>&1; then
    task04_ready=true; break
  fi
  sleep .2
done
if [ "$task04_ready" != true ]; then echo 'Local PostgreSQL did not become ready' >&2; exit 1; fi
task04_docker exec "$task04_container" psql -U postgres -v ON_ERROR_STOP=1 \
  -c 'create database agriclimax_task04' >/dev/null
task04_psql -f /repo/supabase/tests/bootstrap.sql >"$task04_results/migrations.log" 2>&1
if [ "$task04_mode" = extensions ]; then
  task04_psql -c 'create schema extensions' -c 'create extension postgis with schema extensions' \
    -c 'create extension pgcrypto with schema extensions' \
    -c 'grant usage on schema extensions to anon, authenticated, service_role' \
    >>"$task04_results/migrations.log" 2>&1
fi
for task04_migration in "$task04_root"/supabase/migrations/*.sql; do
  task04_psql -f "/repo/supabase/migrations/$(basename "$task04_migration")" \
    >>"$task04_results/migrations.log" 2>&1
done
PYTHONPATH="$task04_root/engine/src" "${PYTHON:-python}" "$task04_root/supabase/tests/prepare_pra_import.py" "$task04_results/pra-import.sql"
task04_psql -f "/repo/work/task04-${task04_mode}/pra-import.sql" >"$task04_results/pra-import.log" 2>&1
task04_psql -f "/repo/work/task04-${task04_mode}/pra-import.sql" >>"$task04_results/pra-import.log" 2>&1
task04_psql -f /repo/supabase/tests/station_weather.sql >"$task04_results/station-weather.log" 2>&1
task04_psql -f /repo/supabase/tests/climate.sql >"$task04_results/climate.log" 2>&1
task04_psql -f /repo/supabase/tests/france.sql >"$task04_results/france.log" 2>&1
task04_psql -f /repo/supabase/tests/wheat.sql >"$task04_results/wheat.log" 2>&1
task04_psql -f /repo/supabase/tests/daily.sql >"$task04_results/daily.log" 2>&1
task04_psql -f /repo/supabase/tests/pra.sql >"$task04_results/pra.log" 2>&1
task04_psql -f /repo/supabase/tests/pra_storage.sql >"$task04_results/pra-storage.log" 2>&1
task04_psql -f /repo/supabase/tests/security.sql >"$task04_results/security.log" 2>&1
task04_psql -f /repo/supabase/tests/benchmark.sql >"$task04_results/explain.log" 2>&1
task04_psql -qAt -f /repo/supabase/tests/contracts.sql >"$task04_results/contracts.json"
"${PYTHON:-python}" "$task04_root/supabase/tests/check_sql_contracts.py" "$task04_results/contracts.json"
task04_psql -f /repo/supabase/scripts/preflight.sql >"$task04_results/schema.log"
echo "PASS: migrations, SQL permissions, publication, zoom, idempotence and contracts ($task04_mode). Logs: $task04_results"
