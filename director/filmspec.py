"""Chat-made films: a script of narrated beats → a voiced, scored, v2-style launch film.

A *script* is what the chat model writes (and the user edits by talking):

    {"title": str, "mood": "calm|normal|energetic", "music"?: str,
     "beats": [{"kind": "headline", "vo": "You shipped the feature.", "text": "You shipped *the feature.*"}, ...]}

Code does everything else:
    sanitize(script, brand)   drop unknown kinds, clip words, fill defaults, guarantee a reveal + close
    plan(script, clips)       voice timings → absolute times for every beat, every on-screen event
                              and every sound cue (TS reads these times; nothing is timed twice)
    render(project, script, controls, name)   TTS → plan → music → mix → Remotion "Film" → mux

Beat kinds (engine/src/film/beats.tsx): headline, shipped, checklist, grind, loop, code, reveal,
prompt, app, screenshot, result, carousel, close. The model is told what each shows in skills/film.md.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from . import audio, voices
from .paths import Project

FPS = 60
KINDS = ["headline", "shipped", "checklist", "grind", "loop", "code", "reveal", "prompt", "app", "screenshot",
         "result", "carousel", "close"]
DARK_DEFAULT = {"grind", "loop"}
# minimum on-screen seconds per kind (the UI needs time to act), and seconds held after the line ends
MIN = {"headline": 2.4, "shipped": 3.2, "checklist": 3.8, "grind": 4.5, "loop": 3.6, "code": 4.2, "reveal": 4.0,
       "prompt": 10.5, "app": 6.5, "screenshot": 4.2, "result": 5.2, "carousel": 3.8, "close": 6.0}
POST = {"reveal": 0.9, "close": 2.8, "prompt": 0.8, "app": 0.8}
CHARS_PER_SEC = 14.5  # preview estimate before the voice exists

MUSIC = {
    "calm": "cinematic tech launch film score, soft felt piano, warm analog pads, gentle pulse slowly building, hopeful, minimal, 80 bpm, no vocals",
    "normal": "modern minimal tech product launch, warm analog synth pulses, crisp tight drums, punchy kick, snappy hi-hats, 112 bpm, confident, optimistic, clean mix, no vocals",
    "energetic": "energetic modern tech launch, driving synth bass, punchy drums, bright plucks, rising builds, 124 bpm, bold and exciting, no vocals",
}

DEFAULT_APP = {"name": "Atlas", "title": "Research", "subtitle": "Ask a question — get a sourced brief.",
               "placeholder": "What do you want to research?", "query": "EV charging market in Europe", "button": "Start Research",
               "results": [{"tag": "Market brief", "title": "Europe's EV charging market to reach €41B by 2030"},
                           {"tag": "Industry report", "title": "Fast-charging points grew 48% year over year"},
                           {"tag": "Competitor scan", "title": "Top operators: Ionity, Allego, Fastned"}]}


# ── sanitize ─────────────────────────────────────────────────────────────
def _s(x, n: int, default: str = "") -> str:
    s = re.sub(r"\s+", " ", str(x if x is not None else default)).strip()
    return s[:n].rstrip()


def _list(x, n: int, item_len: int) -> List[str]:
    return [_s(i, item_len) for i in (x if isinstance(x, list) else []) if _s(i, item_len)][:n]


def _app(a) -> dict:
    a = a if isinstance(a, dict) else {}
    res = a.get("results") if isinstance(a.get("results"), list) else DEFAULT_APP["results"]
    return {
        "name": _s(a.get("name"), 18, DEFAULT_APP["name"]),
        "title": _s(a.get("title"), 26, DEFAULT_APP["title"]),
        "subtitle": _s(a.get("subtitle"), 60, DEFAULT_APP["subtitle"]),
        "placeholder": _s(a.get("placeholder"), 44, DEFAULT_APP["placeholder"]),
        "query": _s(a.get("query"), 40, DEFAULT_APP["query"]),
        "button": _s(a.get("button"), 20, DEFAULT_APP["button"]),
        "results": [{"tag": _s(r.get("tag"), 22, "Result"), "title": _s(r.get("title"), 60)}
                    for r in res if isinstance(r, dict) and r.get("title")][:3] or DEFAULT_APP["results"],
    }


def sanitize(script: dict, brand_doc: Optional[dict]) -> Tuple[dict, List[str]]:
    b = (brand_doc or {}).get("brand") or {}
    name = b.get("name") or "your product"
    url = re.sub(r"^https?://(www\.)?", "", b.get("url") or "").rstrip("/")
    fixes: List[str] = []
    beats = []
    app_seen = None
    for raw in script.get("beats") or []:
        if not isinstance(raw, dict) or raw.get("kind") not in KINDS:
            fixes.append(f"dropped a beat of unknown kind {raw.get('kind') if isinstance(raw, dict) else raw!r}")
            continue
        k = raw["kind"]
        x = {"kind": k, "vo": _s(raw.get("vo"), 170)}
        if "dark" in raw:
            x["dark"] = bool(raw["dark"])
        if k == "headline":
            x["text"] = _s(raw.get("text") or raw.get("vo"), 90)
        elif k == "shipped":
            x.update(title=_s(raw.get("title"), 40, "feat: new feature"), sub=_s(raw.get("sub"), 50, "wants to merge 14 commits into main"),
                     button=_s(raw.get("button"), 22, "Merge pull request"), done=_s(raw.get("done"), 14, "Merged"),
                     text=_s(raw.get("text"), 60, "You shipped *the feature.*"))
        elif k == "checklist":
            items = [{"text": _s(i.get("text"), 34), "done": bool(i.get("done"))} for i in (raw.get("items") or []) if isinstance(i, dict) and i.get("text")][:4]
            if not items or all(i["done"] for i in items):
                items = (items or [{"text": "Ship the feature", "done": True}])[:3] + [{"text": "Record the demo", "done": False}]
            x.update(text=_s(raw.get("text"), 70, "Still on your *to-do list.*"), items=items, tag=_s(raw.get("tag"), 28, "overdue"))
        elif k == "grind":
            x.update(text=_s(raw.get("text"), 50), words=_list(raw.get("words"), 6, 12) or ["Record.", "Retake.", "Zoom.", "Crop.", "Export."])
        elif k == "loop":
            x.update(text=_s(raw.get("text"), 40, "You do it *all again.*"), ring=_list(raw.get("ring"), 6, 12) or ["Record", "Retake", "Zoom", "Crop", "Export"])
        elif k == "code":
            lines = [str(l)[:60] for l in (raw.get("lines") or []) if isinstance(l, str)][:9]
            if not lines:
                lines = ["export function Feature() {", "  return (", "    <button", '      data-clep="feature"', "      onClick={run}>", "      Try it", "    </button>", "  )", "}"]
            hl = raw.get("highlight")
            x.update(text=_s(raw.get("text"), 60, "Your code *already knows.*"), file=_s(raw.get("file"), 30, "feature.tsx"), lines=lines,
                     highlight=hl if isinstance(hl, int) and 0 <= hl < len(lines) else min(3, len(lines) - 1))
        elif k == "reveal":
            x.update(tagline=_s(raw.get("tagline") or b.get("tagline"), 60, ""), pill=_s(raw.get("pill"), 36))
        elif k in ("prompt", "app"):
            app = _app(raw.get("app") or app_seen)
            app_seen = app
            x["app"] = app
            if k == "prompt":
                steps = [{"title": _s(s.get("title"), 34), "sub": _s(s.get("sub"), 44)} for s in (raw.get("steps") or []) if isinstance(s, dict) and s.get("title")][:4]
                x.update(agent=_s(raw.get("agent"), 20, "Claude Code"), prompt=_s(raw.get("prompt"), 60, f"make a demo of {name}"),
                         steps=steps or [{"title": "Reading your code", "sub": "src/"}, {"title": "Found the feature", "sub": ""},
                                         {"title": "Running it in a real browser", "sub": "1920×1080 · 60fps"}, {"title": "Directing the take", "sub": "clicks · keystrokes · zooms"}])
            else:
                x["text"] = _s(raw.get("text"), 60)
        elif k == "screenshot":
            shots = b.get("screenshots") or []
            src = raw.get("src") if raw.get("src") in shots else (shots[0] if shots else None)
            if not src:
                fixes.append("no screenshot to show, so that beat became a headline")
                x = {"kind": "headline", "vo": x["vo"], "text": _s(raw.get("text") or x["vo"], 90)}
            else:
                x.update(src=src, text=_s(raw.get("text"), 60), callout=_s(raw.get("callout"), 30))
        elif k == "result":
            x.update(text=_s(raw.get("text"), 50, "A *finished* film."), file=_s(raw.get("file"), 30, "demo.mp4"),
                     chips=_list(raw.get("chips"), 3, 14) or ["Edited", "Graded", "1080p60"])
            if app_seen:
                x["app"] = app_seen
        elif k == "carousel":
            x.update(text=_s(raw.get("text"), 50, "Every feature. *One command.*"), items=_list(raw.get("items"), 4, 22) or ["onboarding", "dashboard", "checkout"])
        elif k == "close":
            x.update(phrases=_list(raw.get("phrases"), 3, 18) or [f"{name}."], cta=_s(raw.get("cta"), 24, "Try it free"),
                     url=_s(raw.get("url"), 40, url))
        beats.append(x)
    if not any(x["kind"] == "reveal" for x in beats):
        beats.insert(max(0, min(len(beats), len(beats) // 2)), {"kind": "reveal", "vo": f"Meet {name}.", "tagline": _s(b.get("tagline"), 60), "pill": ""})
        fixes.append("added the product reveal")
    if not beats or beats[-1]["kind"] != "close":
        beats = [x for x in beats if x["kind"] != "close"] + [{"kind": "close", "vo": "", "phrases": [f"{name}."], "cta": "Try it free", "url": url}]
        fixes.append("ended on the sign-off")
    beats = beats[:16]
    mood = script.get("mood") if script.get("mood") in MUSIC else "normal"
    return {"title": _s(script.get("title"), 60, f"{name} launch"), "mood": mood, "music": _s(script.get("music"), 300),
            "beats": beats}, fixes


def seed(brand_doc: Optional[dict]) -> dict:
    """A complete film from the site alone — ships when the model fails."""
    b = (brand_doc or {}).get("brand") or {}
    c = (brand_doc or {}).get("copy") or {}
    name = b.get("name") or "It"
    tag = b.get("tagline") or c.get("description") or ""
    h1 = (c.get("h1") or [tag])[0] if isinstance(c.get("h1"), list) else c.get("h1") or tag
    shots = b.get("screenshots") or []
    beats = [
        {"kind": "headline", "vo": "Every product has a moment where it has to show itself.", "text": "Every product has a *moment.*"},
        {"kind": "checklist", "vo": "The feature works. The launch is tomorrow. The demo still doesn't exist.",
         "text": "Still on your *to-do list.*", "items": [{"text": "Ship the feature", "done": True}, {"text": "Write the changelog", "done": True}, {"text": "Record the demo", "done": False}]},
        {"kind": "reveal", "vo": f"Meet {name}. {tag}".strip(), "tagline": tag},
    ]
    if shots:
        beats.append({"kind": "screenshot", "vo": _s(h1, 120) or f"This is {name}.", "src": shots[0], "text": _s(h1, 60)})
    beats.append({"kind": "close", "vo": f"{name}. Try it today.", "phrases": [f"{name}."], "cta": "Try it free"})
    return {"title": f"{name} launch", "mood": "normal", "beats": beats}


# ── plan ─────────────────────────────────────────────────────────────────
def _spread(a: float, b: float, n: int) -> List[float]:
    if n <= 0:
        return []
    if n == 1:
        return [a]
    return [a + (b - a) * i / (n - 1) for i in range(n)]


def _last_onsets(words: List[float], n: int, lo: float, hi: float) -> List[float]:
    """The last n phrase onsets if the read has them (a list said as a list), else evenly spread."""
    tail = [w for w in words if w >= lo - 1.5][-n:]
    return [round(x, 3) for x in (tail if len(tail) == n else _spread(lo, hi, n))]


def plan(script: dict, clips: List[Optional[Tuple[str, float, List[float]]]]) -> Tuple[List[dict], List[dict], float]:
    """clips[i] = (file, seconds, phrase onsets relative to the clip) for beat i's line, or None if silent.
    → (beats with start/end/vo/ev, sfx cues, total seconds)."""
    out, sfx = [], []
    cur = 0.5
    prev_dark = False

    def cue(kind, t, gain=0.6, dur=None):
        sfx.append({"kind": kind, "t": round(t, 3), "gain": gain, **({"dur": dur} if dur else {})})

    for b, clip in zip(script["beats"], clips):
        k = b["kind"]
        x = copy.deepcopy(b)
        dark = b.get("dark", k in DARK_DEFAULT)
        x["dark"] = dark
        s = cur
        lead = 0.25 if k != "reveal" else 0.2
        if clip:
            _, dur, on = clip
            vs = s + lead
            x["vo"] = {"text": b["vo"], "start": round(vs, 3), "end": round(vs + dur, 3), "words": [round(vs + o, 3) for o in on] or [round(vs, 3)]}
            ve = vs + dur
        else:
            vs, ve, dur = s + lead, s + lead + 1.2, 1.2
            x["vo"] = {"text": "", "start": round(vs, 3), "end": round(ve, 3), "words": [round(vs, 3)]}
        e = max(ve + POST.get(k, 0.55), s + MIN[k])
        W = x["vo"]["words"]
        ev: dict = {}
        if k == "shipped":
            ev["click"] = vs + max(0.7, 0.5 * dur)
            cue("pop", s + 0.15, 0.45); cue("click", ev["click"], 0.9); cue("tick", ev["click"] + 0.05, 0.45)
        elif k == "checklist":
            done = [i for i, it in enumerate(b["items"]) if it["done"]]
            ev["checks"] = [s + 0.7 + j * 0.28 for j in range(len(done))]
            ev["circle"] = max(vs + 0.55 * dur, s + 1.6)
            cue("pop", s + 0.2, 0.45)
            for c in ev["checks"]:
                cue("tick", c, 0.55)
        elif k == "grind":
            n = len(b["words"])
            first = vs + (0.35 * dur if b.get("text") else 0.1)
            ev["words"] = _last_onsets(W, n, first, max(first + 0.5 * n, ve - 0.35))
            ev["intro"] = s + 0.1
            for t in ev["words"]:
                cue("pop", t, 0.8)
        elif k == "loop":
            ev["ring"] = s + 0.15
            cue("swish", s + 0.1, 0.55)
        elif k == "code":
            ev["hl"] = vs + 0.45 * dur
            cue("tick", ev["hl"], 0.55)
        elif k == "reveal":
            ev["logo"] = vs + 0.05
            ev["tag"] = W[1] if len(W) > 1 else vs + 0.9
            cue("pop", ev["logo"], 0.9)
        elif k == "prompt":
            D = e - s
            send = s + min(max(0.26 * D, 2.4), 3.4)
            ev.update(typeAt=s + 0.45, typeDur=min(1.6, send - s - 0.9), send=send, morph=send + 0.2)
            n = len(b["steps"])
            first, last = send + 0.9, e - 1.2
            gap = (last - first) / max(1, n)
            ev["steps"] = [[round(first + i * gap, 3), round(first + i * gap + gap * 0.8, 3)] for i in range(n)]
            enter = send + 1.5
            ev["app"] = _app_times(enter, e)
            cue("keys", ev["typeAt"], 0.5, round(ev["typeDur"], 2)); cue("send", send, 0.7); cue("swish", enter, 0.35)
            for _, d in ev["steps"]:
                cue("tick", d, 0.5)
            _app_cues(ev["app"], cue)
        elif k == "app":
            ev["enter"] = s + 0.1
            ev["app"] = _app_times(s + 0.4, e)
            _app_cues(ev["app"], cue)
        elif k == "screenshot":
            ev["callout"] = vs + 0.5 * dur
            cue("pop", ev["callout"], 0.45)
        elif k == "result":
            n = len(b["chips"])
            ev["chips"] = _last_onsets(W, n, vs + 0.4 * dur, max(vs + 0.4 * dur + 0.4 * n, ve - 0.2))
            for t in ev["chips"]:
                cue("pop", t, 0.7)
        elif k == "carousel":
            ev["enter"] = s + 0.2
            cue("swish", s + 0.2, 0.6)
        elif k == "close":
            n = len(b["phrases"])
            ev["phrases"] = _last_onsets(W, n, vs, max(vs + 0.8 * n, ve - 0.5))
            ev["lockup"] = max(ev["phrases"][-1] + 0.7, ve + 0.1)
            ev["cta"] = ev["lockup"] + 0.45
            ev["click"] = ev["cta"] + 1.3
            e = max(e, ev["click"] + 2.2)
            for t in ev["phrases"][1:]:
                cue("pop", t, 0.55)
            cue("pop", ev["lockup"], 0.55); cue("click", ev["click"], 0.9)
        if out and dark != prev_dark:
            cue("swish", s - 0.15, 0.75)
        x["ev"] = {kk: (round(v, 3) if isinstance(v, float) else v) for kk, v in ev.items()}
        x["start"], x["end"] = round(s, 3), round(e, 3)
        out.append(x)
        prev_dark = dark
        cur = e
    return out, sfx, round(cur, 3)


def _app_times(enter: float, end: float) -> dict:
    click_input = enter + 1.0
    type_at = click_input + 0.15
    click_btn = type_at + 1.2
    return {"enter": round(enter, 3), "clickInput": round(click_input, 3), "typeAt": round(type_at, 3), "typeDur": 0.85,
            "clickBtn": round(click_btn, 3), "results": round(click_btn + 0.6, 3),
            "zoom": [round(click_btn - 0.25, 3), round(min(end - 0.4, click_btn + 1.1), 3)]}


def _app_cues(a: dict, cue) -> None:
    cue("click", a["clickInput"], 0.8); cue("keys", a["typeAt"], 0.45, a["typeDur"]); cue("click", a["clickBtn"], 0.9)
    for i in range(3):
        cue("pop", a["results"] + 0.2 * i, 0.35)


# ── build + render ───────────────────────────────────────────────────────
def _voice_clips(pr: Project, script: dict, voice: str, estimate: bool) -> List[Optional[Tuple[str, float, List[float]]]]:
    from .film import phrase_onsets
    lines = [b["vo"] for b in script["beats"] if b.get("vo")]
    if estimate:
        it = iter([(None, max(0.8, len(l) / CHARS_PER_SEC), _estimate_onsets(l)) for l in lines])
    else:
        clips = audio.tts(lines, pr.assets / "user" / "film-voice", voice=voice)
        it = iter([(str(p), d, phrase_onsets(p)) for p, d in clips])
    return [next(it) if b.get("vo") else None for b in script["beats"]]


def _estimate_onsets(line: str) -> List[float]:
    """Phrase starts from punctuation, at the average speaking rate."""
    out, pos = [0.0], 0
    for m in re.finditer(r"[.,;:?!—]\s+", line):
        pos = m.end()
        out.append(pos / CHARS_PER_SEC + 0.25)
    return out


def build_props(pr: Project, script: dict, controls: dict, estimate: bool = False) -> Tuple[dict, List[dict], list]:
    brand_doc = json.loads(pr.brand_path.read_text())
    script, _ = sanitize(script, brand_doc)  # drafts can be edited by hand; never trust them raw
    voice = (voices.get(controls.get("voice")) or voices.get(voices.DEFAULT))["id"]
    clips = _voice_clips(pr, script, voice, estimate)
    beats, sfx, total = plan(script, clips)
    props = {"brand": brand_doc["brand"], "fps": int(controls.get("fps") or FPS), "width": 1920, "height": 1080,
             "duration": total, "beats": beats}
    voice_track = [(Path(c[0]), b["vo"]["start"]) for c, b in zip(clips, beats) if c and c[0]]
    return props, sfx, voice_track


def render(pr: Project, script: dict, controls: dict, name: str, progress=None) -> Path:
    from . import engine
    from .film import KIT
    say = progress or (lambda *_: None)
    say("voicing", 0.15)
    props, sfx, voice_track = build_props(pr, script, controls)
    tmp = pr.dir / ".tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    pfile = tmp / f"{name}.film.json"
    pfile.write_text(json.dumps(props))
    from .sfx import ensure_kit
    ensure_kit()
    say("scoring", 0.3)
    mood = script.get("mood") or "normal"
    prompt = controls.get("music") or script.get("music") or MUSIC.get(mood, MUSIC["normal"])
    bed = None
    try:
        bed = audio.music(prompt, props["duration"] + 1, pr.assets / "user" / "film-music" / f"{hashlib.sha1(prompt.encode()).hexdigest()[:10]}-{int(props['duration'])}.mp3")
    except Exception as e:  # a film without music still ships
        print(f"[film] music failed: {e}")
    mixed = audio.mix(voice_track, bed, props["duration"], tmp / f"{name}.mix.m4a", music_level=0.5,
                      sfx=[(KIT / f"{c['kind']}.mp3", c["t"], c.get("gain", 0.6), c.get("dur")) for c in sfx if (KIT / f"{c['kind']}.mp3").exists()])
    say("rendering", 0.4)
    engine.ensure_installed()
    serve = engine.bundle(pr)
    silent = tmp / f"{name}.silent.mp4"
    engine._npx(["remotion", "render", str(serve), "Film", str(silent), f"--props={pfile}", "--codec=h264", "--crf=17",
                 "--pixel-format=yuv420p", f"--concurrency={controls.get('concurrency') or __import__('os').cpu_count() or 2}", "--log=error"])
    out = pr.dir / "renders" / f"{name}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(mixed), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
    say("done", 0.95)
    return out


def stills(pr: Project, script: dict, controls: dict, name: str) -> Path:
    """Storyboard: one still per beat, timed from estimated reads (no TTS cost)."""
    from . import engine
    props, _, _ = build_props(pr, script, controls, estimate=True)
    tmp = pr.dir / ".tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    pfile = tmp / f"{name}.film.json"
    pfile.write_text(json.dumps(props))
    out = pr.dir / "stills" / name
    engine.ensure_installed()
    serve = engine.bundle(pr)
    engine._npx(["tsx", "scripts/film-stills.mts", "--serve", str(serve), "--props", str(pfile), "--out", str(out)])
    engine.contact_sheet(out)
    return out
