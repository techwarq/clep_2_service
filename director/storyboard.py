"""Script + brand + reference → N storyboard variants (VideoSpecs).

The LLM never writes render code. It composes scenes from the engine
registry (registry.json, exported from TypeScript), in the brand's real
colors/fonts/screenshots, in a named reference style. Each variant is
validated by the engine itself; errors go back to the model to fix.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

from . import draft as D
from . import engine, llm
from .paths import Project

# ---------------------------------------------------------------- catalog

def _sig(schema: dict, depth: int = 0) -> str:
    """JSON Schema → compact TS-ish signature the model reads easily."""
    t = schema.get("type")
    if "enum" in schema:
        return " | ".join(json.dumps(v) for v in schema["enum"])
    if "anyOf" in schema:
        return " | ".join(_sig(s, depth) for s in schema["anyOf"])
    if t == "array":
        items = schema.get("items", {})
        if isinstance(items, list):  # tuple
            return "[" + ", ".join(_sig(i, depth) for i in items) + "]"
        rng = ""
        if "minItems" in schema or "maxItems" in schema:
            rng = f" /*{schema.get('minItems', 0)}-{schema.get('maxItems', '∞')}*/"
        return f"Array<{_sig(items, depth)}>{rng}"
    if t == "object" or "properties" in schema:
        req = set(schema.get("required", []))
        parts = []
        for k, v in schema.get("properties", {}).items():
            opt = "" if k in req and "default" not in v else "?"
            s = f"{k}{opt}: {_sig(v, depth + 1)}"
            if "default" in v:
                s += f" = {json.dumps(v['default'])}"
            if v.get("description") and depth == 0:
                s += f"  // {v['description']}"
            parts.append(s)
        if depth == 0:
            return "{\n      " + "\n      ".join(parts) + "\n    }"
        return "{ " + "; ".join(parts) + " }"
    if t == "integer":
        return "int"
    return t or "any"


def catalog(reg: dict) -> str:
    lines = []
    cat = None
    for s in sorted(reg["scenes"], key=lambda s: s["category"]):
        if s["category"] != cat:
            cat = s["category"]
            lines.append(f"\n## {cat.upper()}")
        lo, hi = s["duration"]
        extra = []
        if s.get("defaultTone", "base") != "base":
            extra.append(f"default tone {s['defaultTone']}")
        if s.get("ownCamera"):
            extra.append("has its own camera — leave camera unset")
        lines.append(f"### {s['type']}  ({lo}-{hi}s{'; ' + '; '.join(extra) if extra else ''})")
        lines.append(s["description"])
        lines.append("    props: " + _sig(s["props"]))
        lines.append("    example: " + json.dumps(s["example"]))
    return "\n".join(lines)


def styles_doc(reg: dict) -> str:
    out = []
    for name, st in reg["styles"].items():
        out.append(f"- **{name}** — {st['description']} (refs: {', '.join(st['references'])}; "
                   f"scenes {st['sceneSeconds'][0]}-{st['sceneSeconds'][1]}s; default transition {st['transition']['type']}; "
                   f"title anim {st['titleAnim']})")
    return "\n".join(out)


# ---------------------------------------------------------------- prompt

DIRECTOR_RULES = """
You are the creative director + motion designer for a product launch video. You compose videos from a
fixed, pre-built scene library (below) — you never write code. Your output is VideoSpec JSON.

WHAT MAKES IT LOOK PRO (non-negotiable):
1. Direct from a reference. Commit to ONE named style preset that best matches the reference/brief;
   use styleOverrides only for small, deliberate deviations. Never the default "centered text, gradient, everything fades".
2. Real product, not invented UI. If the brand has screenshots, the product-proof beats MUST use
   site_showcase / phone_showcase with those exact asset paths (use zoom/click/callouts to direct the eye
   to the part that matters). Built mocks (ui_click, chat_demo, search_results…) are for beats a screenshot can't show.
3. It could only be this brand. Use the brand's own copy, product nouns and claims from the site. No
   generic "Supercharge your workflow" filler. Headlines ≤ 8 words. Every scene earns its seconds.
4. Tell one story, not a feature list (STORY PLAYBOOK below): the moment (the viewer's specific pain, no logo)
   → the turn (the product is *used*: a typed prompt, a click, a command) → watch it work (3-5 visible steps
   with concrete values, the longest stretch) → the payoff (one answer) → the name (logo_reveal / end_card, quiet).
   No feature_grid / list_reveal unless the brief asks for a rundown. Text is the narrator: 1-4 words on
   screen at a time. Never the same scene type twice in a row.
5. Pace it like a film, not an ad. Fewer, longer shots that move inside themselves (keyed camera
   keys: [{at, zoom, focus:[x,y]}] pushing toward the element that's changing) beat many short cuts. Prefer
   continuous transitions (zoom into the product, push, blur); glitch/slash/impact/flash at most once per
   video. Tones: use "inverse"/"primary" for 1-2 contrast beats.
6. Timing: each scene's duration within its range; total should hit the target duration (±10%).
   If a voiceover is given, scene boundaries follow the script's sentences.

SPEC SHAPE (per variant):
{
  "title": str,
  "style": <style name>,
  "styleOverrides"?: { ...partial style fields },
  "format": {"width": W, "height": H, "fps": 30},
  "scenes": [ { "id": str, "type": <scene type>, "duration": seconds, "props": {...},
               "transition"?: {"type": <transition>, "duration": s, "direction"?: "left|right|up|down"},
               "camera"?: {"move": <move>, "amount"?: n, "speed"?: n, "focus"?: [x,y],
                           "keys"?: [{"at": s, "zoom": n, "focus": [x,y], "ease"?: <ease>}] , "shake"?: px},
               "tone"?: "base|inverse|primary", "speed"?: n, "background"?: {"kind": <bg>},
               "notes": "one line: why this shot" } ]
}
"brand" is injected by the system — do not output it. Optionally output "brandColors": {"primary": hex,
"accent": hex} ONLY to correct an obviously wrong extracted color (pick from the palette/screenshots).
"""


def _brand_block(doc: dict) -> str:
    b = doc["brand"]
    copy = doc.get("copy", {})
    lines = [
        f"Name: {b['name']}   URL: {b.get('url', '')}",
        f"Extracted colors: {json.dumps(b['colors'])}   mode: {b.get('mode')}",
        f"Site palette (ranked): {', '.join(doc.get('palette', []))}",
        f"Fonts: {json.dumps(b.get('fonts', {}))}",
        f"Logo: {'yes (' + b['logo'] + ')' if b.get('logo') else 'no — logo scenes render a generated mark + wordmark'}",
        "Screenshot assets (use these exact paths): " + ", ".join(b.get("screenshots", [])),
        "Site copy:",
        f"  title: {copy.get('title')}",
        f"  description: {copy.get('description')}",
        f"  h1: {copy.get('h1')}",
        f"  h2: {copy.get('h2')}",
        f"  h3: {(copy.get('h3') or [])[:8]}",
        f"  buttons: {copy.get('buttons')}",
        f"  paragraphs: {(copy.get('paragraphs') or [])[:6]}",
    ]
    return "\n".join(lines)


def _user_assets(project: Project) -> List[str]:
    user = project.assets / "user"
    return [f"user/{p.name}" for p in sorted(user.glob("*")) if p.is_file()] if user.exists() else []


def _duration_of(path: Path) -> Optional[float]:
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                           capture_output=True, text=True, check=True)
        return float(r.stdout.strip())
    except Exception:
        return None


def build_messages(project: Project, reg: dict, doc: dict, script: str, reference: str, variants: int,
                   target: float, fmt: Dict[str, int], voiceover: Optional[str]) -> List[dict]:
    b = doc["brand"]
    user_assets = _user_assets(project)
    brief = [
        f"# BRAND\n{_brand_block(doc)}",
        f"# USER ASSETS (logo/footage/screenshots you can reference by path)\n{', '.join(user_assets) or 'none'}",
        f"# REFERENCE / DIRECTION\n{reference or 'None given — pick the preset that fits the brand best and say why in notes.'}",
        f"# SCRIPT / BRAINDUMP\n{script.strip()}",
        f"# FORMAT\n{fmt['width']}x{fmt['height']} @30fps, target {target:.0f}s total."
        + (f" A voiceover ({voiceover}) is laid over the video — pace scenes to the script's sentences." if voiceover else ""),
        f"# TASK\nWrite {variants} storyboard variants that are genuinely different DIRECTIONS on the same story spine "
        f"(different style preset, a different 'moment' to open on, or a different way to show the product working). "
        f"Reply with ONLY JSON: {{\"variants\": [{{\"name\": \"short-kebab-name\", \"concept\": \"one sentence\", "
        f"\"spec\": {{...}}, \"brandColors\"?: {{...}}}}]}}",
    ]
    content: List[dict] = [{"type": "text", "text": "\n\n".join(brief)}]
    shots = [project.assets / s for s in b.get("screenshots", [])[:4]] + \
            [project.assets / a for a in user_assets if a.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))][:3]
    for s in shots:
        if s.exists():
            content.append({"type": "text", "text": f"Screenshot asset: {s.relative_to(project.assets)}"})
            content.append(llm.image_part(s))
    system = DIRECTOR_RULES + "\n# STORY PLAYBOOK\n" + D.skill("story") + "\n\n# STYLE PRESETS\n" + styles_doc(reg) + \
        f"\n\n# TRANSITIONS: {', '.join(reg['transitions'])}\n# CAMERA MOVES: {', '.join(reg['cameraMoves'])}" \
        f"\n# EASES: {', '.join(reg['eases'])}\n# BACKGROUNDS: {', '.join(reg['backgrounds'])}\n\n# SCENE LIBRARY\n" + catalog(reg)
    return [{"role": "system", "content": system}, {"role": "user", "content": content}]


# ---------------------------------------------------------------- assemble + validate

def assemble(raw: dict, doc: dict, fmt: Dict[str, int], audio: Optional[dict]) -> dict:
    spec = dict(raw.get("spec") or raw)
    brand = json.loads(json.dumps(doc["brand"]))
    for k, v in (raw.get("brandColors") or {}).items():
        if isinstance(v, str) and v.startswith("#"):
            brand["colors"][k] = v
    spec["brand"] = brand
    spec["version"] = 1
    spec["format"] = {**fmt, "fps": 30, **(spec.get("format") or {}), "width": fmt["width"], "height": fmt["height"]}
    if audio:
        spec["audio"] = audio
    return spec


def fix_loop(spec: dict, messages: List[dict], project: Project, max_rounds: int = 3) -> dict:
    for rnd in range(max_rounds + 1):
        ok, res = engine.validate(spec, project.dir / ".tmp")
        if ok:
            for w in res.get("warnings", []):
                print(f"    warn: {w}")
            return res["spec"]
        if rnd == max_rounds:
            raise RuntimeError("spec still invalid:\n" + "\n".join(res["errors"]))
        print(f"    fixing {len(res['errors'])} validation error(s)…")
        brand = spec.pop("brand")
        audio = spec.get("audio")
        fixed = llm.chat_json(messages + [
            {"role": "assistant", "content": json.dumps({"spec": spec})},
            {"role": "user", "content": "The engine rejected this spec:\n" + "\n".join(res["errors"][:40]) +
             "\nReturn the corrected spec as JSON {\"spec\": {...}} — same creative intent, only fix the errors."},
        ], temperature=0.3)
        spec = dict(fixed.get("spec") or fixed)
        spec["brand"] = brand
        if audio:
            spec["audio"] = audio
    return spec


def board(project: Project, variants: int = 3, target: float = 30, portrait: bool = False,
          reference: Optional[str] = None, script: Optional[str] = None) -> List[Path]:
    from . import brand as brand_mod
    reg = engine.registry()
    doc = brand_mod.load(project)
    script = script or project.read("script.txt")
    if not script.strip():
        raise SystemExit(f"No script: write projects/{project.name}/script.txt (a braindump is fine) or pass --script.")
    reference = reference if reference is not None else project.read("reference.txt")
    fmt = {"width": 1080, "height": 1920} if portrait else {"width": 1920, "height": 1080}

    audio = None
    vo = next((a for a in _user_assets(project) if Path(a).stem.lower() in ("voiceover", "vo", "narration")), None)
    music = next((a for a in _user_assets(project) if Path(a).stem.lower() in ("music", "bed", "track")), None)
    if vo:
        d = _duration_of(project.assets / vo)
        if d:
            target = d + 0.8
        audio = {"voiceover": vo}
    if music:
        audio = {**(audio or {}), "music": music}

    print(f"[board] {variants} variant(s) · {llm.MODEL} · target {target:.0f}s · {fmt['width']}x{fmt['height']}")
    messages = build_messages(project, reg, doc, script, reference, variants, target, fmt, vo)
    out = llm.chat_json(messages, max_tokens=24000)
    raw_variants = out.get("variants") or [out]
    written = []
    for i, rv in enumerate(raw_variants[:variants], 1):
        name = f"v{i}-" + "".join(c if c.isalnum() or c == "-" else "-" for c in (rv.get("name") or "variant").lower())[:32]
        print(f"[board] {name}: {rv.get('concept', '')}")
        spec = assemble(rv, doc, fmt, audio)
        spec = fix_loop(spec, messages, project)
        spec["title"] = spec.get("title") or name
        path = project.specs / f"{name}.json"
        path.write_text(json.dumps({"concept": rv.get("concept"), **spec}, indent=2))
        written.append(path)
    return written
