"""Stage genuine pilot envelopes in the fixed disposable local PostGIS container only.

No remote database URL or service credential is read. Run after the local import.
"""

import json
import os
import subprocess
from pathlib import Path

from agriclimax.territories.reference_sql import literal

p = Path("work/task19/official")
rows = []
for f in sorted((p / "pilot/batches").glob("*/output.json")):
    d = json.loads(f.read_text())
    sql = (
        "begin; set local role service_role; select public.agriclimax_persist_pra("
        + literal("ofb-masa-pra-2017-snapshot-20261017")
        + ","
        + literal("task19-ofb-pilot-cds-20261017")
        + ","
        + literal(json.dumps(d))
        + "::jsonb); commit;"
    )
    env = {
        k: v
        for k, v in os.environ.items()
        if k
        not in [
            "DOCKER_HOST",
            "DOCKER_CONTEXT",
            "DOCKER_TLS",
            "DOCKER_TLS_VERIFY",
            "DOCKER_CERT_PATH",
        ]
    }
    r = subprocess.run(
        [
            "docker",
            "--host=unix:///var/run/docker.sock",
            "exec",
            "-i",
            "agriclimax-task19-official",
            "psql",
            "-U",
            "postgres",
            "-d",
            "agriclimax_task19",
            "-qAt",
            "-v",
            "ON_ERROR_STOP=1",
        ],
        input=sql.encode(),
        capture_output=True,
        env=env,
        check=False,
    )
    if r.returncode:
        raise RuntimeError(r.stderr.decode())
    rows.append(
        {
            "pra": d["identity"]["pra"],
            "batch_key": d["batch_key"],
            "result": r.stdout.decode().strip(),
        }
    )
(p / "local-pilot-stage.json").write_text(json.dumps(rows, indent=2))
print(json.dumps(rows, indent=2))
