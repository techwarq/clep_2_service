"""UI sound design: crisp clicks, ticks, pops and swishes synced to what's moving on screen.

A small kit is generated once (fal ElevenLabs sound effects, $0.002/s → ~1¢ for the whole kit), cached in
sfx/kit/, copied into each project, and placed per scene by mirroring each scene's own animation timing:
    agent_trace        keys while the request types · send · a tick as each finding lands
    notification_stack a pop per notification (per variant's schedule)
    transitions        a soft swish on morphs / pushes / zooms
    end_card           a click when the CTA lands
"""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import List, Optional

from . import paths  # noqa: F401  (loads FAL_KEY)
from .paths import ROOT

KIT_DIR = ROOT / "sfx" / "kit"
SFX_MODEL = os.environ.get("MOTION_SFX_MODEL", "fal-ai/elevenlabs/sound-effects/v2")
KIT = {
    "click": ("a single soft UI mouse click, crisp and minimal, dry, no reverb", 0.5),
    "send": ("a soft UI message-send swoosh with a tiny pop at the end, clean, modern app", 0.6),
    "tick": ("one subtle digital confirmation tick, soft blip, clean UI sound, dry", 0.5),
    "pop": ("a soft notification pop, round and bubbly, clean modern phone UI", 0.5),
    "swish": ("a soft airy whoosh for a smooth screen transition, short, gentle, no bass", 0.8),
    "keys": ("fast soft typing on a quiet laptop keyboard, even rhythm, dry", 2.0),
}
VOL = {"click": 0.45, "send": 0.4, "tick": 0.3, "pop": 0.4, "swish": 0.28, "keys": 0.22}


def _normalize(f: Path, peak_db: float = -6.0) -> None:
    """Generated sounds arrive anywhere from -1 to -21 dB peak; level them so VOL means the same for all."""
    import re
    import subprocess
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.search(r"max_volume: (-?[\d.]+) dB", out)
    if not m:
        return
    tmp = f.with_name("tmp_" + f.name)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af", f"volume={peak_db - float(m.group(1)):.2f}dB",
                    "-b:a", "128k", str(tmp)], check=True)
    tmp.replace(f)


def ensure_kit() -> dict:
    """Generate any missing kit sounds (once, shared by every project). Returns name → file."""
    import urllib.request
    KIT_DIR.mkdir(parents=True, exist_ok=True)
    out = {}
    for name, (prompt, secs) in KIT.items():
        f = KIT_DIR / f"{name}.mp3"
        if not f.exists():
            import fal_client
            r = fal_client.subscribe(SFX_MODEL, arguments={"text": prompt, "duration_seconds": max(0.5, secs), "prompt_influence": 0.6})
            with urllib.request.urlopen(r["audio"]["url"], timeout=60) as resp:
                f.write_bytes(resp.read())
            _normalize(f)
        out[name] = f
    return out


# ---------------------------------------------------------------- per-scene cue times (seconds from scene start)

def _trace_rows(p: dict, dur: float) -> List[tuple]:
    type_end = 0.25 + len(p.get("prompt", "")) / 34
    sent = type_end + 0.3
    n = max(1, len(p.get("steps") or []))
    start = sent + 0.55
    hold = 2.0 if p.get("result") else 0.0
    per = max(0.85, min(1.6, (dur - start - hold - 0.4) / n))
    cues = [("keys", 0.3), ("send", sent)]
    cues += [("tick", start + i * per + 0.35) for i in range(n)]
    return cues


def _trace_variant(p: dict, dur: float) -> List[tuple]:
    cps = {"terminal": 40, "document": 60}.get(p.get("variant"), 34)
    type_end = 0.2 + len(p.get("prompt", "")) / cps
    start = type_end + 0.45
    n = max(1, len(p.get("steps") or []))
    hold = 1.9 if p.get("result") else 0.3
    per = max(0.7, min(1.6, (dur - start - hold) / n))
    cues = [("keys", 0.25), ("send", type_end + 0.2)]
    cues += [("tick", start + i * per + 0.3) for i in range(n)]
    return cues


def _pings(p: dict, dur: float) -> List[tuple]:
    n = len(p.get("notifications") or [])
    v = p.get("variant") or "cards"
    if v == "thread":
        every = max(0.45, dur * 0.7 / max(1, n))
        return [("pop", 0.35 + i * every) for i in range(n)]
    if v == "lockscreen":
        every = max(0.35, dur * 0.6 / max(1, n))
        return [("pop", 0.6 + i * every) for i in range(n)]
    if v == "ticker":
        span = (dur * 0.72 if p.get("caption") else dur) / max(1, n)
        return [("pop", i * span) for i in range(n)]
    if v == "scatter":
        return [("pop", 0.1 + i * 0.3) for i in range(min(6, n * 2))]
    return [("pop", 0.15 + i * 0.22) for i in range(n)]


def cues_for(scene: dict) -> List[tuple]:
    t, p, dur = scene["type"], scene.get("props") or {}, float(scene["duration"])
    if t == "agent_trace":
        return _trace_rows(p, dur) if p.get("variant") in (None, "rows") else _trace_variant(p, dur)
    if t == "notification_stack":
        return _pings(p, dur)
    if t == "end_card" and p.get("cta"):
        return [("click", 0.95)]
    if t in ("ui_click",):
        return [("click", 1.4)]
    return []


def apply(spec: dict, assets: Path, enabled: bool = True) -> int:
    """Write scene.sfx cues into the spec (kit copied into the project). Returns how many were placed."""
    if not enabled:
        return 0
    try:
        kit = ensure_kit()
    except Exception as e:
        print(f"[sfx] kit unavailable ({e}) — video renders without sound effects")
        return 0
    dest = Path(assets) / "sfx"
    dest.mkdir(parents=True, exist_ok=True)
    for name, f in kit.items():
        if not (dest / f.name).exists():
            shutil.copyfile(f, dest / f.name)
    placed = 0
    scenes = spec["scenes"]
    for i, sc in enumerate(scenes):
        prev_tr = float((scenes[i - 1].get("transition") or {}).get("duration") or 0) if i else 0.0
        preroll = prev_tr * 0.5  # scenes start their clocks half a transition early (SpecVideo preroll)
        cues = [(n, at - preroll) for n, at in cues_for(sc)]
        tr = sc.get("transition") or {}
        if tr.get("type") in ("morph", "push", "zoom", "whip", "slide") and i < len(scenes) - 1:
            cues.append(("swish", float(sc["duration"]) - float(tr.get("duration") or 0) - 0.05))
        out = [{"src": f"sfx/{n}.mp3", "at": round(max(0.0, at), 3), "volume": VOL[n]}
               for n, at in cues if 0 <= at < float(sc["duration"])]
        if out:
            sc["sfx"] = (sc.get("sfx") or []) + out
            placed += len(out)
    return placed
