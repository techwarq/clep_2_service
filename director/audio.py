"""Voice + music for a video, via fal (good-but-cheap models), mixed like an editor would.

    tts(lines)          one clip per narration line (ElevenLabs Turbo v2.5, $0.05/1k chars), each line
                        generated with its neighbours as context so the read stays continuous
    music(prompt, s)    an instrumental bed of exactly s seconds (CassetteAI, $0.02/min)
    mix(...)            places every line at its scene's time, ducks the music under the voice
                        (sidechain compression), fades the bed in/out, normalizes loudness

Needs FAL_KEY (pipeline_motion/.env).
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import urllib.request
from pathlib import Path
from typing import List, Optional, Tuple

from . import paths  # noqa: F401  (loads .env → FAL_KEY)

TTS_MODEL = os.environ.get("MOTION_TTS_MODEL", "fal-ai/elevenlabs/tts/turbo-v2.5")
MUSIC_MODEL = os.environ.get("MOTION_MUSIC_MODEL", "cassetteai/music-generator")
VOICE = os.environ.get("MOTION_VOICE", "Chris")


def _fal():
    import fal_client
    if not os.environ.get("FAL_KEY"):
        raise RuntimeError("FAL_KEY is not set (pipeline_motion/.env)")
    return fal_client


def _download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as r:
        dest.write_bytes(r.read())
    return dest


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def tts(lines: List[str], out_dir: Path, voice: str = VOICE, speed: float = 1.0) -> List[Tuple[Path, float]]:
    """Narration lines → [(mp3, seconds)]. Cached by text+voice, so re-running only pays for changed lines."""
    fal = _fal()
    out_dir.mkdir(parents=True, exist_ok=True)
    res = []
    for i, text in enumerate(lines):
        key = hashlib.sha1(json.dumps([text, voice, speed, TTS_MODEL]).encode()).hexdigest()[:10]
        dest = out_dir / f"vo_{i:02d}_{key}.mp3"
        if not dest.exists():
            args = {"text": text, "voice": voice, "speed": speed, "stability": 0.45, "similarity_boost": 0.8, "style": 0.15}
            if i > 0:
                args["previous_text"] = lines[i - 1]
            if i + 1 < len(lines):
                args["next_text"] = lines[i + 1]
            r = fal.subscribe(TTS_MODEL, arguments=args)
            _download(r["audio"]["url"], dest)
        res.append((dest, duration(dest)))
    return res


def music(prompt: str, seconds: float, out: Path) -> Path:
    fal = _fal()
    if out.exists() and out.with_suffix(".json").exists() and json.loads(out.with_suffix(".json").read_text()) == {"p": prompt, "s": round(seconds)}:
        return out
    r = fal.subscribe(MUSIC_MODEL, arguments={"prompt": prompt, "duration": int(round(seconds)) + 2})
    f = r.get("audio_file") or r.get("audio")
    _download(f["url"], out)
    out.with_suffix(".json").write_text(json.dumps({"p": prompt, "s": round(seconds)}))
    return out


def mix(voice: List[Tuple[Path, float]], music_file: Optional[Path], total: float, out: Path,
        music_level: float = 0.55, sfx: Optional[List[Tuple[Path, float, float, Optional[float]]]] = None) -> Path:
    """voice = [(clip, start_seconds)]. Music ducks ~9 dB under speech, fades in 1.2s / out 2.5s; -14 LUFS.
    sfx = [(clip, start_seconds, gain, max_seconds|None)] — UI clicks/pops laid on top, not ducked."""
    sfx = sfx or []
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for clip, _ in voice:
        cmd += ["-i", str(clip)]
    if music_file:
        cmd += ["-i", str(music_file)]
    for clip, *_ in sfx:
        cmd += ["-i", str(clip)]
    parts, labels = [], []
    for i, (_, start) in enumerate(voice):
        ms = int(max(0.0, start) * 1000)
        parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{i}]")
        labels.append(f"[v{i}]")
    parts.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,apad=whole_dur={total:.2f}[vo]")
    if music_file:
        m = len(voice)
        parts.append(f"[{m}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{total:.2f},"
                     f"afade=t=in:d=1.2,afade=t=out:st={max(0.0, total - 2.5):.2f}:d=2.5,volume={music_level}[bed]")
        parts.append("[vo]asplit=2[vo1][vo2]")
        parts.append("[bed][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=450:makeup=1[ducked]")
        parts.append("[ducked][vo2]amix=inputs=2:normalize=0[pre]")
    else:
        parts.append("[vo]anull[pre]")
    if sfx:
        base = len(voice) + (1 if music_file else 0)
        fx = []
        for j, (_, start, gain, dur) in enumerate(sfx):
            ms = int(max(0.0, start) * 1000)
            trim = f"atrim=0:{dur:.2f},afade=t=out:st={max(0.0, dur - 0.08):.2f}:d=0.08," if dur else ""
            parts.append(f"[{base + j}:a]aresample=48000,aformat=channel_layouts=stereo,{trim}volume={gain},adelay={ms}|{ms}[s{j}]")
            fx.append(f"[s{j}]")
        parts.append(f"{''.join(fx)}amix=inputs={len(fx)}:normalize=0,apad=whole_dur={total:.2f}[fx]")
        parts.append("[pre][fx]amix=inputs=2:normalize=0[pre2]")
        parts.append(f"[pre2]loudnorm=I=-14:TP=-1.2:LRA=9,atrim=0:{total:.2f}[out]")
    else:
        parts.append(f"[pre]loudnorm=I=-14:TP=-1.2:LRA=9,atrim=0:{total:.2f}[out]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[out]", "-ar", "48000", "-b:a", "192k", str(out)]
    subprocess.run(cmd, check=True)
    return out

