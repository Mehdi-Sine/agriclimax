#!/usr/bin/env bash
set -euo pipefail
pra_local_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$pra_local_root"
d() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
d run --detach --name agriclimax-task19-official --mount "type=bind,src=$pra_local_root,dst=/repo,readonly" -e POSTGRES_PASSWORD=agriclimax_local_test postgis/postgis:17-3.5@sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6
for attempt in {1..50}; do if d exec agriclimax-task19-official sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' >/dev/null 2>&1; then break; fi; sleep .2; done
d exec agriclimax-task19-official psql -U postgres -v ON_ERROR_STOP=1 -c 'create database agriclimax_task19'
d exec agriclimax-task19-official psql -U postgres -d agriclimax_task19 -v ON_ERROR_STOP=1 -f /repo/supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do d exec agriclimax-task19-official psql -U postgres -d agriclimax_task19 -v ON_ERROR_STOP=1 -f "/repo/$migration"; done
d exec agriclimax-task19-official psql -U postgres -d agriclimax_task19 -At -c 'select pg_database_size(current_database())'
