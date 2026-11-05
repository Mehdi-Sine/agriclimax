"""Temporary GET/HEAD-only Preview gateway; default system TLS verification, no mocks."""

import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ORIGIN = os.environ["TASK26_PREVIEW_ORIGIN"].rstrip("/")
if not re.fullmatch(r"https://agriclimax-[a-z0-9-]+\.vercel\.app", ORIGIN):
    raise ValueError("Reviewed AgriclimaX HTTPS Preview origin required")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Request diagnostics must not include the bypass header.

    def do_HEAD(self):
        self.forward()

    def do_GET(self):
        self.forward()

    def forward(self):
        if not self.path.startswith("/") or self.path.startswith("//"):
            self.send_error(400)
            return
        headers = {"x-vercel-protection-bypass": os.environ["VERCEL_AUTOMATION_BYPASS_SECRET"]}
        for name in ("Accept", "User-Agent", "RSC", "Next-Router-State-Tree",
                     "Next-Router-Prefetch", "Next-Router-Segment-Prefetch", "Next-Url"):
            if self.headers.get(name):
                headers[name] = self.headers[name]
        request = Request(ORIGIN + self.path, headers=headers, method=self.command)
        try:
            response = build_opener(NoRedirect()).open(request, timeout=120)
        except HTTPError as error:
            response = error
        except OSError:
            self.send_error(502, "Preview upstream unavailable")
            return
        with response:
            self.send_response(response.status)
            for name in ("Content-Type", "Content-Encoding", "Cache-Control", "Location", "Vary"):
                value = response.headers.get(name)
                if value:
                    if name == "Location" and value.startswith(ORIGIN):
                        value = value[len(ORIGIN):] or "/"
                    if name == "Location" and urlsplit(value).netloc:
                        continue  # Never navigate an upstream credential to another origin.
                    self.send_header(name, value)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(response.read())


ThreadingHTTPServer(("127.0.0.1", 3031), Handler).serve_forever()
