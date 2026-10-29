"""Local read-only HTTPS RPC transport to real disposable PostGIS (not Supabase)."""

import argparse
import http.server
import json
import os
import ssl
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--certificate", type=str, required=True)
parser.add_argument("--key", required=True)
options = parser.parse_args()
RPC = {
    "agriclimax_pra_lookup": {
        "p_version": "text",
        "p_department": "text",
        "p_region": "text",
        "p_query": "text",
        "p_after": "text",
        "p_limit": "integer",
    },
    "agriclimax_pra_read": {
        "p_reference": "text",
        "p_dataset": "text",
        "p_date": "date",
        "p_scope": "text",
        "p_id": "text",
        "p_after": "text",
        "p_limit": "integer",
    },
    "agriclimax_pra_diagnostics": {
        "p_reference": "text",
        "p_dataset": "text",
        "p_pra": "text",
        "p_start": "date",
        "p_end": "date",
        "p_parameters": "text",
    },
}
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


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args: object) -> None:
        pass

    def do_POST(self) -> None:
        name = self.path.removeprefix("/rest/v1/rpc/")
        if name not in RPC or self.headers.get("apikey") != "task19-local-only":
            self.send_error(403)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            assert 0 < size < 10000
            body = json.loads(self.rfile.read(size))
            assert not body.keys() - RPC[name].keys()
            args = []
            for k, v in body.items():
                value = "null" if v is None else "'" + str(v).replace("'", "''") + "'"
                args.append(k + "=>" + value + "::" + RPC[name][k])
            sql = (
                "begin read only; set local role service_role; select public."
                + name
                + "("
                + ",".join(args)
                + "); rollback;"
            )
            cmd = [
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
            ]
            r = subprocess.run(
                cmd,
                input=sql.encode(),
                capture_output=True,
                env=env,
                timeout=15,
                check=False,
            )
            assert r.returncode == 0
            output = json.loads(r.stdout)
            raw = json.dumps(output).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        except (
            ValueError,
            TypeError,
            KeyError,
            AssertionError,
            OSError,
            subprocess.SubprocessError,
        ):
            self.send_error(502, "Local RPC failed")


server = http.server.ThreadingHTTPServer(("127.0.0.1", 9443), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(options.certificate, options.key)
server.socket = context.wrap_socket(server.socket, server_side=True)
print("Local HTTPS bridge ready; read-only RPCs on disposable PostGIS.", flush=True)
server.serve_forever()
