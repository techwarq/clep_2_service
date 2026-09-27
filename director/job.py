"""One Cloud Run Job execution = one job. Started by the Worker's queue consumer.

    CLEP_JOB_ID=mj-abc123 python3 motion.py job

Reads the job from the Worker (GET /v1/internal/motion/jobs/:id), does the heavy work,
writes files to R2, and reports status back (POST same path). Kinds:

    brand   {url}                                       → extract brand kit (Playwright), push project to R2
    render  {template, values, controls, formats?}      → spec → MP4 per format → outputs/<id>[-9x16].mp4
            template "film": values is a film script → voiced, scored film (director/filmspec.py), 16:9
"""
from __future__ import annotations

import json
import os
import sys
import time
import traceback
import urllib.request
from pathlib import Path

from . import store
from .paths import Project

WORKER = os.environ.get("CLEP_WORKER_URL", "http://127.0.0.1:8787").rstrip("/")
SECRET = os.environ.get("CLEP_INTERNAL_SECRET", "")


def _call(method: str, path: str, body: dict = None) -> dict:
    req = urllib.request.Request(f"{WORKER}{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-Internal-Secret": SECRET, "Content-Type": "application/json",
                                          "User-Agent": "clep-motion-job/1"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"{}")


def report(jid: str, **kw) -> None:
    try:
        _call("POST", f"/v1/internal/motion/jobs/{jid}", kw)
    except Exception as e:  # never let a status ping kill the render
        print(f"[job] status report failed: {e}", file=sys.stderr)


def _brand(jid: str, project: str, p: dict) -> dict:
    from . import brand
    pr = Project(project).ensure()
    doc = brand.extract(p["url"], pr)
    report(jid, status="uploading", progress=0.8)
    n = store.push_project(pr)
    print(f"[job] brand kit pushed ({n} files)")
    return {"brand": doc["brand"], "palette": doc.get("palette"), "copy": doc.get("copy")}


def _prerecord_tour(project: str, url: str) -> None:
    """After the brand kit is live, record the site tour in the same execution so the
    user's first preview/render doesn't wait ~40s for it. Best effort: preview/render
    still record on demand if this fails or hasn't landed yet."""
    from .capture import auto_tour
    pr = Project(project)
    clips = pr.assets / "clips"
    if (clips / "tour.trace.json").exists():
        return
    try:
        auto_tour(url, clips, "tour")
        n = store.push_project(pr, [f for f in clips.glob("tour*") if f.is_file()])
        print(f"[job] tour pre-recorded ({n} files)")
    except Exception as e:
        print(f"[job] tour pre-record skipped: {e}", file=sys.stderr)


def _duration(mp4: Path):
    import subprocess
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
                           capture_output=True, text=True, check=True)
        return round(float(r.stdout.strip()), 2)
    except Exception:
        return None


def _render(jid: str, project: str, p: dict) -> dict:
    from . import engine
    from . import templates as T
    from .server import _ensure_clip

    t0 = time.time()
    pr = store.pull_project(project)
    report(jid, status="preparing", progress=0.1)
    if p["template"] == "film":
        from . import filmspec
        mp4 = filmspec.render(pr, p.get("values") or {}, p.get("controls") or {}, jid,
                              progress=lambda s, x: report(jid, status=s if s != "done" else "uploading", progress=x))
        key = store.put_file(mp4, f"outputs/{jid}.mp4")
        out = {"format": "16:9", "out": f"/outputs/{jid}.mp4", "key": key, "bytes": mp4.stat().st_size, "duration": _duration(mp4)}
        return {"outputs": [out], "out": out["out"], "seconds": round(time.time() - t0, 1)}
    had = {x for x in (pr.assets / "clips").glob("*")} if (pr.assets / "clips").exists() else set()
    values = _ensure_clip(pr, p["template"], dict(p.get("values") or {}))
    new_clips = [x for x in (pr.assets / "clips").glob("*") if x not in had] if (pr.assets / "clips").exists() else []
    if new_clips:  # auto-recorded tour — keep it so the next render/preview skips recording
        store.push_project(pr, new_clips)

    formats = p.get("formats") or [(p.get("controls") or {}).get("format") or "16:9"]
    outputs = []
    for i, fmt in enumerate(formats):
        report(jid, status="rendering", progress=round(0.2 + 0.75 * i / len(formats), 2))
        suffix = "" if i == 0 else "-" + fmt.replace(":", "x")
        name = f"{jid}{suffix}"
        spec = T.instantiate(pr, p["template"], values, {**(p.get("controls") or {}), "format": fmt}, name=name)
        mp4 = engine.render(pr, spec, out=pr.dir / "renders" / f"{name}.mp4")
        key = store.put_file(mp4, f"outputs/{name}.mp4")
        outputs.append({"format": fmt, "out": f"/outputs/{name}.mp4", "key": key, "bytes": mp4.stat().st_size,
                        "duration": _duration(mp4)})
    return {"outputs": outputs, "out": outputs[0]["out"], "seconds": round(time.time() - t0, 1)}


def main(jid: str = None) -> int:
    jid = jid or os.environ.get("CLEP_JOB_ID")
    if not jid:
        print("CLEP_JOB_ID not set", file=sys.stderr)
        return 2
    job = _call("GET", f"/v1/internal/motion/jobs/{jid}")
    kind, project, payload = job["kind"], job["project"], json.loads(job.get("payload") or "{}")
    print(f"[job] {jid} {kind} {project}")
    report(jid, status="running", progress=0.05)
    try:
        result = {"brand": _brand, "render": _render}[kind](jid, project, payload)
        report(jid, status="done", progress=1.0, out=result.get("out"), result=result)
        if kind == "brand":  # the kit is already live for the user; this runs behind it
            _prerecord_tour(project, payload["url"])
        return 0
    except Exception as e:
        traceback.print_exc()
        report(jid, status="error", error=f"{type(e).__name__}: {e}"[-600:])
        return 0  # reported to the Worker; don't let Cloud Run retry a deterministic failure
