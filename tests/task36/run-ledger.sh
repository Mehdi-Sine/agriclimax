#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
name="agriclimax-t36-ledger-$$"
image='postgres:17@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f'
docker_local() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
docker_local run --detach --name "$name" -e POSTGRES_PASSWORD=local_test "$image" >/dev/null
trap 'docker_local rm --force "$name" >/dev/null' EXIT
for i in {1..40}; do
  if docker_local exec "$name" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' >/dev/null 2>&1; then break; fi
  sleep .2
done
docker_local exec "$name" psql -U postgres -v ON_ERROR_STOP=1 -c 'create role anon; create role authenticated; create role service_role bypassrls; create schema agriclimax_private;'
docker_local exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 < "$root/supabase/migrations/20261109085400_operational_ai_journal.sql"
docker_local exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 < "$root/supabase/migrations/20261109111202_editorial_personal_review.sql"
docker_local exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 < "$root/tests/task36/ledger.sql"
docker_local exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 < "$root/tests/task36/review.sql"
python "$root/tests/task36/concurrency.py" "$name"

docker_local exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 < "$root/supabase/migrations/20261109152744_editorial_operational_attempts.sql"
docker_local exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 < "$root/tests/task36/operational.sql"
python "$root/tests/task36/concurrency.py" "$name" operational
