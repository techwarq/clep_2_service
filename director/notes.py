"""Director notes → spec revision.

"slow every zoom to 0.7x", "hard cut here", "push in on the button",
"make scene 3 punchier" — the model edits the spec (never code), the engine
validates it, and only the scenes that changed get new stills.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import List, Tuple

from . import engine, llm
from .paths import Project
from .storyboard import catalog, styles_doc

NOTE_GLOSSARY = """
Translate director language into spec fields precisely — change ONLY what the note asks for:
- "slow/speed up every zoom|camera move to 0.7x"  → camera.speed on the affected scenes (0.7 = slower); for scenes with
                                                         their own camera (site_showcase/video_showcase/code_zoom) scale the
                                                         built-in move instead: site_showcase props.zoom.duration /= 0.7
- "slow down / snappier animation in scene N"       → scenes[N].speed (animation time scale; <1 slower)
- "everything slower/faster"                          → top-level "speed"
- "hard cut here / between N and N+1"               → scenes[N].transition = {"type": "cut"}
- "whip / zoom / blur / flash transition"            → scenes[N].transition.type
- "push in on the <thing>"                           → site_showcase: props.zoom {x,y,scale,at}; other scenes:
                                                         camera.keys [{at:0,zoom:1},{at:t,zoom:1.6,focus:[x,y],ease:"expo"}]
- "punch in on the beat"                             → camera {"move": "punch_in"}
- "hold longer / trim"                               → scenes[N].duration
- "less/more energy"                                 → style preset / transitions / titleAnim via styleOverrides
- "handheld feel"                                    → camera.shake 2-4
- "motion blur"                                      → camera.motionBlur true (costly — only where asked)
- copy changes                                       → the relevant props text
Scene indices in notes are 0-based as shown on the storyboard sheet ("scene 03" = index 3).
"""


def revise(project: Project, spec_file: Path, notes: str) -> Tuple[Path, List[int]]:
    reg = engine.registry()
    current = json.loads(spec_file.read_text())
    concept = current.pop("concept", None)
    brand = current.pop("brand")
    audio = current.get("audio")
    indexed = "\n".join(f"  [{i:02d}] {s['type']} {s.get('duration')}s — {s.get('notes', '')}" for i, s in enumerate(current["scenes"]))
    messages = [
        {"role": "system", "content": "You revise motion-graphics VideoSpecs from a director's notes.\n" + NOTE_GLOSSARY +
         "\n# STYLE PRESETS\n" + styles_doc(reg) + f"\n# TRANSITIONS: {', '.join(reg['transitions'])}"
         f"\n# CAMERA MOVES: {', '.join(reg['cameraMoves'])}\n# EASES: {', '.join(reg['eases'])}\n# SCENE LIBRARY\n" + catalog(reg)},
        {"role": "user", "content": f"Current spec (brand omitted):\n{json.dumps(current)}\n\nScene index:\n{indexed}\n\n"
         f"DIRECTOR NOTES:\n{notes}\n\nReply with ONLY JSON: {{\"changes\": [\"what you changed, per note\"], \"spec\": {{...full revised spec...}}}}"},
    ]
    out = llm.chat_json(messages, temperature=0.3, max_tokens=24000)
    spec = dict(out["spec"])
    spec["brand"] = brand
    if audio and "audio" not in spec:
        spec["audio"] = audio
    ok, res = engine.validate(spec, project.dir / ".tmp")
    if not ok:
        fix = llm.chat_json(messages + [
            {"role": "assistant", "content": json.dumps(out)},
            {"role": "user", "content": "Engine rejected it:\n" + "\n".join(res["errors"][:30]) + "\nReturn corrected JSON, same shape."},
        ], temperature=0.2, max_tokens=24000)
        spec = dict(fix["spec"])
        spec["brand"] = brand
        ok, res = engine.validate(spec, project.dir / ".tmp")
        if not ok:
            raise RuntimeError("revision invalid:\n" + "\n".join(res["errors"]))
    revised = res["spec"]

    # Name: v1-foo.json → v1-foo.n1.json → v1-foo.n2.json …
    stem = spec_file.stem
    m = re.match(r"(.*)\.n(\d+)$", stem)
    base, n = (m.group(1), int(m.group(2)) + 1) if m else (stem, 1)
    path = spec_file.with_name(f"{base}.n{n}.json")
    path.write_text(json.dumps({"concept": concept, "notes_applied": notes, "changes": out.get("changes", []), **revised}, indent=2))

    old = json.loads(spec_file.read_text())["scenes"]
    changed = [i for i, s in enumerate(revised["scenes"]) if i >= len(old) or json.dumps(s, sort_keys=True) != json.dumps(old[i], sort_keys=True)]
    if revised.get("speed") != json.loads(spec_file.read_text()).get("speed") or len(old) != len(revised["scenes"]):
        changed = list(range(len(revised["scenes"])))
    for c in out.get("changes", []):
        print(f"  · {c}")
    return path, changed
