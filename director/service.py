"""Internal HTTP service (Cloud Run *service*) for the fast, synchronous calls.

Only the Worker calls this (X-Internal-Secret). Heavy work — brand extraction and
renders — runs as Cloud Run Jobs (director/job.py), not here.

    GET  /health
    GET  /internal/templates                                   templates + slots + controls (the Worker caches it)
    GET  /internal/voices                                      narration voices + preview keys (motion/voices/<id>.mp3)
    POST /internal/chat     {message, brand?, draft?, history?, assets?}   → {reply, template, values, controls, fixes}
    POST /internal/preview  {project, template, values, controls}         → {storyboard, stills[]} as R2 keys
    POST /internal/run-job  {job_id}         local dev only (MOTION_LOCAL_JOBS=1): runs `motion.py job` as a subprocess
"""
from __future__ import annotations

import json
import os
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from . import chat as chat_mod
from . import engine, store
from . import templates as T

SECRET = os.environ.get("CLEP_INTERNAL_SECRET", "")
# Stills launch Chromium; cap them per instance so a burst queues instead of thrashing.
PREVIEW_SLOTS = threading.BoundedSemaphore(int(os.environ.get("MOTION_PREVIEW_SLOTS", "2")))


def templates_payload() -> dict:
    """Templates without their spec. Example media is served by the Worker from R2
    (motion/templates/<id>/…), uploaded once with `motion.py publish-examples`."""
    tpls = []
    for t in T.list_templates():
        tpl = {k: v for k, v in t.items() if k != "spec"}
        ex = T.TEMPLATES / t["id"] / "example.json"
        brand = json.loads(ex.read_text()).get("brand", {}).get("name", "") if ex.exists() else ""
        base = f"/v1/motion/files/motion/templates/{t['id']}"
        tpl["example"] = {"video": f"{base}/example.mp4", "poster": f"{base}/poster.jpg", "brand": brand}
        tpls.append(tpl)
    from . import looks
    return {"templates": tpls, "controls": {**T.CONTROLS, "looks": looks.catalog()}}


def preview(body: dict) -> dict:
    from .server import _ensure_clip
    pr = store.pull_project(body["project"])
    tid = body["template"]
    if tid == "film":
        return film_preview(pr, body)
    had = set((pr.assets / "clips").glob("*")) if (pr.assets / "clips").exists() else set()
    values = _ensure_clip(pr, tid, dict(body.get("values") or {}))
    new = [x for x in (pr.assets / "clips").glob("*") if x not in had] if (pr.assets / "clips").exists() else []
    if new:
        store.push_project(pr, new)
    pid = uuid.uuid4().hex[:10]
    spec = T.instantiate(pr, tid, values, body.get("controls") or {}, name=f"preview-{pid}")
    with PREVIEW_SLOTS:
        d = engine.stills(pr, spec)
    prefix = f"motion/previews/{pr.name}/{pid}/"
    man = json.loads((d / "stills.json").read_text())
    stills = []
    for m in man:
        p = d / os.path.basename(m["path"])
        stills.append({"type": m["type"], "key": store.put_file(p, prefix + p.name)})
    return {"storyboard": store.put_file(d / "storyboard.jpg", prefix + "storyboard.jpg"), "stills": stills,
            "spec": json.loads(spec.read_text())}


def film_preview(pr, body: dict) -> dict:
    from . import filmspec
    pid = uuid.uuid4().hex[:10]
    with PREVIEW_SLOTS:
        d = filmspec.stills(pr, body.get("values") or {}, body.get("controls") or {}, f"preview-{pid}")
    prefix = f"motion/previews/{pr.name}/{pid}/"
    man = json.loads((d / "stills.json").read_text())
    stills = [{"type": m["type"], "key": store.put_file(d / os.path.basename(m["path"]), prefix + os.path.basename(m["path"]))} for m in man]
    return {"storyboard": store.put_file(d / "storyboard.jpg", prefix + "storyboard.jpg"), "stills": stills}


def local_file(key: str):
    """Local dev only (no R2): map an R2 key to where the file sits on disk."""
    from .paths import PROJECTS
    parts = key.split("/")
    if key.startswith("motion/projects/") and len(parts) > 3:
        return PROJECTS / parts[2] / "/".join(parts[3:])
    if key.startswith("motion/previews/") and len(parts) == 5:
        return PROJECTS / parts[2] / "stills" / f"preview-{parts[3]}" / parts[4]
    if key.startswith("motion/voices/") and len(parts) == 3:
        from .voices import PREVIEWS
        return PREVIEWS / parts[2]
    if key.startswith("motion/templates/") and len(parts) == 4:
        return T.TEMPLATES / parts[2] / parts[3]
    if key.startswith("outputs/") and len(parts) == 2:
        return next(PROJECTS.glob(f"*/renders/{parts[1]}"), None)
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "ClepMotionService/1"

    def _send(self, code: int, body) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authed(self) -> bool:
        if SECRET and self.headers.get("X-Internal-Secret") == SECRET:
            return True
        self._send(401, {"error": "unauthorized"})
        return False

    def _json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def log_message(self, fmt, *args):
        print("[motion-service]", fmt % args)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._send(200, {"ok": True})
        if not self._authed():
            return
        if path.startswith("/internal/local-files/") and os.environ.get("MOTION_LOCAL_JOBS") == "1":
            import mimetypes
            f = local_file(path[len("/internal/local-files/"):])
            if not f or ".." in path or not f.is_file():
                return self._send(404, {"error": "not found"})
            data = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(str(f))[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/internal/templates":
            return self._send(200, templates_payload())
        if path == "/internal/voices":
            from . import voices
            return self._send(200, {"voices": voices.catalog(), "default": voices.DEFAULT})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if not self._authed():
            return
        t0 = time.time()
        try:
            body = self._json()
            if path == "/internal/chat":
                out = chat_mod.turn(body["message"], body.get("brand"), body.get("draft"), body.get("history"),
                                   body.get("assets"), body.get("model"))
            elif path == "/internal/preview":
                out = preview(body)
            elif path == "/internal/run-job" and os.environ.get("MOTION_LOCAL_JOBS") == "1":
                # Local dev stand-in for Cloud Run Jobs: same entrypoint, as a subprocess.
                import subprocess, sys
                from .paths import ROOT
                subprocess.Popen([sys.executable, str(ROOT / "motion.py"), "job", str(body["job_id"])])
                out = {"started": body["job_id"]}
            else:
                return self._send(404, {"error": "not found"})
            out["ms"] = int((time.time() - t0) * 1000)
            self._send(200, out)
        except (SystemExit, ValueError, KeyError) as e:
            self._send(400, {"error": str(e)})
        except Exception as e:
            traceback.print_exc()
            self._send(500, {"error": f"{type(e).__name__}: {e}"[-600:]})


def serve(port: int = None) -> None:
    port = port or int(os.environ.get("PORT", "8080"))
    engine.ensure_installed()
    engine.registry()  # warm the registry before the first request
    print(f"[motion-service] :{port}  r2={'on' if store.enabled() else 'off (local)'}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
