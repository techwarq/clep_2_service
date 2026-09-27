"""Films: hand-built Remotion compositions (engine/src/videos/<dir>/) driven by a timeline.json.

This is the core way videos are made. The UI is recreated as motion graphics from the
engine/src/kit/ui/promo.tsx primitives, not screen-recorded, and every shot is timed to the voice.

timeline.json
    id        Remotion composition id (registered in Root.tsx)
    project   projects/<project>, where audio/ and renders/ are written
    fps, voice, music: {prompt, level}
    script    [{id, text, at?, gap?}]. A line starts at `at`, or else `gap` seconds (default 0.45)
              after the previous line ends.
    tail      seconds held after the last line (default 3)
    sfx       [{kind, t | line (+ word) + offset, gain?, dur?}], using the kit sounds in sfx/kit/<kind>.mp3.
              `line` anchors a cue to a voice line's start (`at: "end"` for its end, `word: i` for
              phrase i), so re-voicing keeps the sound effects in sync.
  written by `voice`:
    vo        [{id, file, start, end, text, words: [onset seconds of each phrase]}]
    duration  total seconds

Scenes read line timings through vo.ts (`L("hook").start`), so a rewritten script re-times the
visuals by itself.

    python3 motion.py film <dir> voice     TTS the script and lay out the timeline
    python3 motion.py film <dir> music     score a bed of exactly `duration` seconds
    python3 motion.py film <dir> mix       VO + ducked music + SFX → audio/<dir>/mix.m4a
    python3 motion.py film <dir> render    render the composition and mux → renders/<dir>.mp4
    python3 motion.py film <dir> preview   half-res, every 2nd frame, silent → engine/out/<dir>_preview.mp4
    python3 motion.py film <dir> all       voice → music → mix → render
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import List

from . import audio

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
KIT = ROOT / "sfx" / "kit"


def _dir(name: str) -> Path:
    d = ENGINE / "src" / "videos" / name
    if not (d / "timeline.json").exists():
        raise SystemExit(f"no timeline.json in {d}")
    return d


def _load(name: str) -> dict:
    return json.loads((_dir(name) / "timeline.json").read_text())


def _save(name: str, tl: dict) -> None:
    (_dir(name) / "timeline.json").write_text(json.dumps(tl, indent=2) + "\n")


def _audio_dir(tl: dict, name: str) -> Path:
    return ROOT / "projects" / tl["project"] / "audio" / name


def phrase_onsets(clip: Path, floor_db: int = -32, min_gap: float = 0.07) -> List[float]:
    """Start of each spoken phrase (after each pause), so a scene can land a word on the beat."""
    err = subprocess.run(["ffmpeg", "-i", str(clip), "-af", f"silencedetect=n={floor_db}dB:d={min_gap}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    dur = audio.duration(clip)
    onsets = [0.0] if not starts or starts[0] > 0.02 else []
    onsets += [e for e in ends if e < dur - 0.1]
    return [round(o, 2) for o in onsets]


def voice(name: str) -> dict:
    tl = _load(name)
    script = tl["script"]
    clips = audio.tts([s["text"] for s in script], _audio_dir(tl, name), voice=tl.get("voice", audio.VOICE),
                      speed=tl.get("speed", 1.0))
    vo, cursor = [], tl.get("lead", 0.6)
    for s, (clip, dur) in zip(script, clips):
        start = s["at"] if "at" in s else cursor + (s.get("gap", 0.45) if vo else 0)
        vo.append({"id": s["id"], "file": clip.name, "start": round(start, 2), "end": round(start + dur, 2),
                   "text": s["text"], "words": [round(start + o, 2) for o in phrase_onsets(clip)]})
        cursor = start + dur
    tl["vo"] = vo
    tl["duration"] = round(cursor + tl.get("tail", 3.0), 2)
    _save(name, tl)
    for v in vo:
        print(f"  {v['start']:6.2f}–{v['end']:6.2f}  {v['id']:<12} {v['text']}")
    print(f"[film] {len(vo)} lines · {tl['duration']}s")
    return tl


def music(name: str) -> Path:
    tl = _load(name)
    m = tl.get("music") or {}
    if not m.get("prompt"):
        raise SystemExit("timeline has no music.prompt")
    return audio.music(m["prompt"], tl["duration"] + 1, _audio_dir(tl, name) / "music.mp3")


def cue_time(tl: dict, c: dict) -> float:
    if "t" in c:
        return c["t"]
    v = next((x for x in tl["vo"] if x["id"] == c["line"]), None)
    if v is None:
        raise SystemExit(f"sfx cue references unknown line {c['line']!r}")
    if "word" in c:
        w = v["words"]
        base = w[min(c["word"], len(w) - 1)]
    else:
        base = v["end"] if c.get("at") == "end" else v["start"]
    return round(base + c.get("offset", 0.0), 3)


def mix(name: str) -> Path:
    tl = _load(name)
    adir = _audio_dir(tl, name)
    voice_ = [(adir / v["file"], v["start"]) for v in tl["vo"]]
    bed = adir / "music.mp3"
    sfx = [(KIT / f"{c['kind']}.mp3", cue_time(tl, c), c.get("gain", 0.7), c.get("dur")) for c in tl.get("sfx", [])]
    return audio.mix(voice_, bed if bed.exists() else None, tl["duration"], adir / "mix.m4a",
                     music_level=(tl.get("music") or {}).get("level", 0.5), sfx=sfx)


def render(name: str, preview: bool = False) -> Path:
    tl = _load(name)
    out = ENGINE / "out" / (f"{name}_preview.mp4" if preview else f"{name}_silent.mp4")
    cmd = ["npx", "remotion", "render", tl["id"], str(out), "--concurrency=8", "--log=error"]
    cmd += ["--scale=0.5", "--every-nth-frame=2"] if preview else ["--crf=16"]
    subprocess.run(cmd, cwd=ENGINE, check=True)
    if preview:
        return out
    final = ROOT / "projects" / tl["project"] / "renders" / f"{name}.mp4"
    final.parent.mkdir(parents=True, exist_ok=True)
    mixed = _audio_dir(tl, name) / "mix.m4a"
    if not mixed.exists():
        mixed = mix(name)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-i", str(mixed), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(final)], check=True)
    return final


def run(name: str, step: str) -> None:
    if step in ("voice", "all"):
        voice(name)
    if step in ("music", "all"):
        print(music(name))
    if step in ("mix", "all"):
        print(mix(name))
    if step in ("render", "all"):
        print(render(name))
    if step == "preview":
        print(render(name, preview=True))
