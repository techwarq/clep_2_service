"""Clep Motion API — what the Clep dashboard talks to.

    python3 motion.py serve --port 8791

GET  /health
GET  /templates                      templates + slots + defaults + example video URLs + controls
POST /brand    {url}                 extract brand kit from a website → {project, brand, palette, screenshots, fonts, needs}
POST /brand    {project, name?}      no website: empty brand kit whose `needs` asks for fonts, logo, colors, screenshots
POST /chat     {message, project?, draft?, history?}      → {reply, template, values, controls}
                 new videos default to template "film": a narrated, voice-timed launch film (director/filmspec.py)
POST /preview  {project, template, values, controls}      → {storyboard, stills[]}   (seconds)
POST /render   {project, template, values, controls}      → {job}                    (background)
GET  /jobs/<id>                      → {status, progress, video, error}
POST /upload?project=&name=&kind=&role=   raw body → stored + wired into brand.json → {path, brand, needs}
       kind: font (role=display|body|mono|accent, optional family=&weight=&italic=1) | logo | screenshot
             | voiceover | music | file (default: file → assets/user/<name>)
POST /brand/colors {project, colors: {background, foreground, primary, accent}}   hex → {brand, needs}
POST /brand/font {project, role, family}  use a Google Font by name for one role → {brand, needs}
GET  /voices                         narration voices (id, label, accent, description, tags, preview mp3 URL)
     chat replies for films also carry {voice, voices[]}: pick one by saying "use <name>" or send controls.voice
GET  /logos?q=&limit=                app/social logos a video can show (Slack, Shopify, Instagram…) + the common list
GET  /brand?project=                 fonts in use (+ where each came from), fonts seen on the site, needs
GET  /files/<path>                   serves templates/ and projects/ media
"""
from __future__ import annotations

import json
import mimetypes
import re
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from . import assets as assets_mod
from . import brand as brand_mod
from . import chat as chat_mod
from . import engine
from . import templates as T
from .paths import PROJECTS, ROOT, Project

JOBS: dict = {}
LOCK = threading.Lock()


def slug_for(url: str) -> str:
    host = urlparse(url if url.startswith("http") else "https://" + url).netloc.replace("www.", "")
    return re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-") or "project"


def file_url(p: Path) -> str:
    return "/files/" + str(p.resolve().relative_to(ROOT))


def _ensure_clip(pr: Project, tid: str, values: dict) -> dict:
    """Feature Film needs a product capture: use an uploaded clip, else auto-record a tour of the site."""
    if tid == "custom":  # product beats use screenshots unless the user supplied a clip — no recording wait
        return values
    tpl = T.load(tid)
    for k, s in tpl["slots"].items():
        if s["type"] == "clip" and not values.get(k):
            clips = pr.assets / "clips"
            trace = clips / "tour.trace.json"
            if not trace.exists():
                from .capture import auto_tour
                url = json.loads(pr.brand_path.read_text())["brand"].get("url")
                auto_tour(url, clips, "tour")
            values[k] = {"src": "clips/tour.mp4", "trace": "clips/tour.trace.json"}
        if s["type"] == "image" and not values.get(k):
            shots = json.loads(pr.brand_path.read_text())["brand"].get("screenshots") or []
            if shots:
                values[k] = shots[0]
    return values


def _project(name: str) -> Project:
    pr = Project(name)
    if not pr.brand_path.exists():
        raise ValueError(f"unknown project '{name}' — POST /brand with the site URL first")
    return pr


def _render_job(jid: str, pr: Project, tid: str, values: dict, controls: dict):
    def st(**kw):
        with LOCK:
            JOBS[jid].update(kw)
    try:
        st(status="preparing", progress=0.05)
        if tid == "film":
            from . import filmspec
            out = filmspec.render(pr, values, controls, f"film-{jid}", progress=lambda s, x: st(status=s, progress=x))
            return st(status="done", progress=1.0, video=file_url(out), finished=time.time())
        values = _ensure_clip(pr, tid, dict(values))
        st(status="rendering", progress=0.2)
        name = f"{tid}-{jid}"
        spec = T.instantiate(pr, tid, values, controls, name=name)
        out = engine.render(pr, spec, out=pr.dir / "renders" / f"{name}.mp4")
        st(status="done", progress=1.0, video=file_url(out), finished=time.time())
    except Exception as e:  # surface the reason to the dashboard
        traceback.print_exc()
        st(status="error", error=str(e)[-600:])


class Handler(BaseHTTPRequestHandler):
    server_version = "ClepMotion/1"

    def _send(self, code: int, body, ctype="application/json"):
        data = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204, b"")

    def _json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def log_message(self, fmt, *args):
        print("[motion-api]", fmt % args)

    # ---------------------------------------------------------------- GET
    def do_GET(self):
        u = urlparse(self.path)
        try:
            if u.path == "/health":
                return self._send(200, {"ok": True})
            if u.path == "/templates":
                items = []
                for t in T.list_templates():
                    d = ROOT / "templates" / t["id"]
                    ex = json.loads((d / "example.json").read_text())
                    items.append({**t, "example": {"video": file_url(d / "example.mp4") if (d / "example.mp4").exists() else None,
                                                   "poster": file_url(d / "poster.jpg") if (d / "poster.jpg").exists() else None,
                                                   "brand": ex["brand"].get("name"), "values": ex["values"]}})
                return self._send(200, {"templates": items, "controls": T.CONTROLS})
            if u.path == "/voices":
                from . import voices
                return self._send(200, {"voices": voices.catalog(local=True), "default": voices.DEFAULT})
            if u.path == "/logos":
                from . import app_logos
                q = {k: v[0] for k, v in parse_qs(u.query).items()}
                rows = app_logos.catalog(q.get("q", ""))
                return self._send(200, {"count": len(rows), "logos": rows[: int(q.get("limit", 200))], "common": app_logos.COMMON})
            if u.path == "/brand":
                q = {k: v[0] for k, v in parse_qs(u.query).items()}
                doc = json.loads(_project(q["project"]).brand_path.read_text())
                return self._send(200, {"project": q["project"], **assets_mod.fonts_report(doc)})
            m = re.match(r"^/jobs/([\w-]+)$", u.path)
            if m:
                job = JOBS.get(m.group(1))
                return self._send(200, job) if job else self._send(404, {"error": "no such job"})
            if u.path.startswith("/files/"):
                rel = unquote(u.path[len("/files/"):])
                p = (ROOT / rel).resolve()
                if not (str(p).startswith(str((ROOT / "templates").resolve())) or str(p).startswith(str(PROJECTS.resolve()))) or not p.is_file():
                    return self._send(404, {"error": "not found"})
                return self._send_file(p, download="dl=1" in (u.query or ""))
            return self._send(404, {"error": "not found"})
        except Exception as e:
            traceback.print_exc()
            return self._send(500, {"error": str(e)})

    def _send_file(self, p: Path, download: bool = False):
        size = p.stat().st_size
        ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng:  # video scrubbing in <video> needs byte ranges
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                if m.group(2):
                    end = int(m.group(2))
        length = end - start + 1
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        if download:
            self.send_header("Content-Disposition", f'attachment; filename="{p.name}"')
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        with open(p, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(1 << 20, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    # ---------------------------------------------------------------- POST
    def do_POST(self):
        u = urlparse(self.path)
        try:
            if u.path == "/brand":
                body = self._json()
                url = (body.get("url") or "").strip()
                if not url:  # no website: start an empty brand and ask for everything
                    if not body.get("project"):
                        return self._send(400, {"error": "send a website url, or a project name to start without one"})
                    pr = Project(body["project"]).ensure()
                    doc = assets_mod.blank(pr, body.get("name"))
                else:
                    pr = Project(body.get("project") or slug_for(url)).ensure()
                    doc = brand_mod.extract(url, pr)
                return self._send(200, {"project": pr.name, "brand": doc["brand"], "palette": doc.get("palette"),
                                        "copy": doc.get("copy"), **assets_mod.fonts_report(doc),
                                        "screenshots": [file_url(pr.assets / s) for s in doc["brand"].get("screenshots", [])]})
            if u.path == "/chat":
                body = self._json()
                doc = None
                if body.get("project"):
                    doc = json.loads(_project(body["project"]).brand_path.read_text())
                return self._send(200, chat_mod.turn(body["message"], doc, body.get("draft"), body.get("history")))
            if u.path == "/preview":
                body = self._json()
                pr = _project(body["project"])
                if body["template"] == "film":
                    from . import filmspec
                    d = filmspec.stills(pr, body.get("values") or {}, body.get("controls") or {}, "film-preview")
                    man = json.loads((d / "stills.json").read_text())
                    return self._send(200, {"storyboard": file_url(d / "storyboard.jpg"),
                                            "stills": [{"type": m["type"], "url": file_url(Path(m["path"]))} for m in man]})
                values = _ensure_clip(pr, body["template"], dict(body.get("values") or {}))
                spec = T.instantiate(pr, body["template"], values, body.get("controls") or {}, name=f"{body['template']}-preview")
                d = engine.stills(pr, spec)
                man = json.loads((d / "stills.json").read_text())
                return self._send(200, {"storyboard": file_url(d / "storyboard.jpg"),
                                        "stills": [{"type": m["type"], "url": file_url(Path(m["path"]))} for m in man]})
            if u.path == "/render":
                body = self._json()
                pr = _project(body["project"])
                jid = uuid.uuid4().hex[:10]
                with LOCK:
                    JOBS[jid] = {"id": jid, "status": "queued", "progress": 0, "template": body["template"],
                                 "project": pr.name, "created": time.time()}
                threading.Thread(target=_render_job, args=(jid, pr, body["template"], body.get("values") or {},
                                                             body.get("controls") or {}), daemon=True).start()
                return self._send(200, JOBS[jid])
            if u.path == "/upload":
                q = {k: v[0] for k, v in parse_qs(u.query).items()}
                pr = _project(q["project"])
                n = int(self.headers.get("Content-Length") or 0)
                try:
                    res = assets_mod.save_upload(pr, q.get("kind") or "file", q["name"], self.rfile.read(n), role=q.get("role"),
                                                 family=q.get("family"), weight=q.get("weight"), italic=q.get("italic") in ("1", "true"))
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
                return self._send(200, {**res, "url": file_url(pr.assets / res["path"])})
            if u.path == "/brand/colors":
                body = self._json()
                return self._send(200, assets_mod.set_colors(_project(body["project"]), body.get("colors") or {}))
            if u.path == "/brand/font":
                body = self._json()
                try:
                    res = assets_mod.set_font(_project(body["project"]), body["role"], body["family"],
                                              body.get("weight"), bool(body.get("italic")))
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
                return self._send(200, res)
            return self._send(404, {"error": "not found"})
        except SystemExit as e:
            return self._send(400, {"error": str(e)})
        except Exception as e:
            traceback.print_exc()
            return self._send(500, {"error": str(e)})


def serve(port: int = 8791):
    engine.ensure_installed()
    print(f"[motion-api] http://localhost:{port}  (templates: {', '.join(t['id'] for t in T.list_templates())})")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
