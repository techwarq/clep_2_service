"""Narrated videos: a beat sheet whose beats carry `vo` lines → narration, timing, music, mix, spec.

    produce(project, beat_doc, name, music_prompt, voice)

1. TTS every `vo` line (continuity-aware), measure it
2. compile the beats with each narrated scene stretched to hold its line (beats.voiced_timing)
3. place each line after its scene's incoming cut; score a music bed to the exact length
4. mix (music ducks under the voice) → assets/user/<name>-mix.mp3, wired in as the spec's audio
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from . import audio, beats as B
from .paths import Project


def produce(pr: Project, doc: dict, name: str, music_prompt: Optional[str], voice: str = audio.VOICE) -> Path:
    site = json.loads(pr.brand_path.read_text())
    work = pr.assets / "user" / f"{name}-audio"
    beats = [dict(b) for b in doc["beats"]]
    lines = [b["vo"] for b in beats if b.get("vo")]
    clips = audio.tts(lines, work, voice=voice)
    it = iter(clips)
    for b in beats:
        if b.get("vo"):
            b["vo_seconds"] = next(it)[1]
    print(f"[voiced] {len(clips)} lines · {sum(s for _, s in clips):.1f}s of narration · voice {voice}")

    look = site.get("look")
    controls = {"look": look["name"], "lookRecipe": look} if look else {}
    spec, fixes = B.build({**doc, "beats": beats}, site, controls, pr.dir / ".tmp", assets=pr.assets)
    for f in fixes:
        print(f"  fix: {f}")
    marks = spec.pop("voiceMarks", [])
    if len(marks) != len(clips):
        raise RuntimeError(f"{len(clips)} narration lines but {len(marks)} narrated scenes — a beat was dropped; see fixes above")
    total = B._total(spec)
    bed = audio.music(music_prompt, total, work / "music.mp3") if music_prompt else None
    mixed = audio.mix([(c, at) for (c, _), at in zip(clips, marks)], bed, total, pr.assets / "user" / f"{name}-mix.mp3")
    spec["audio"] = {"voiceover": f"user/{mixed.name}", "voiceVolume": 1, "duck": False}
    out = pr.specs / f"{name}.json"
    pr.specs.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(spec, indent=2))
    print(f"[voiced] {len(spec['scenes'])} scenes · {total:.1f}s · {out}")
    return out
