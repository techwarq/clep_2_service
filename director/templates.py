"""Templates: pre-directed videos with editable slots + shared controls.

templates/<id>/template.json   VideoSpec skeleton with {{slot}} placeholders + slot definitions + default controls
templates/<id>/example.json    an example brand + slot values (rendered to templates/<id>/example.mp4)
templates/controls.json        shared controls: font pairings, backdrops, pace, text anim, transitions, camera, formats

fill() = slot values + brand + controls → a normal VideoSpec, so everything
downstream (validate, stills, notes, render, Studio) works unchanged.
"""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any, Dict, Optional

from .paths import ROOT, Project

TEMPLATES = ROOT / "templates"
CONTROLS = json.loads((TEMPLATES / "controls.json").read_text())
_FULL = re.compile(r"^\{\{\s*([\w.]+)\s*\}\}$")
_INLINE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


def list_templates():
    return [json.loads(p.read_text()) for p in sorted(TEMPLATES.glob("*/template.json"))]


def load(tid: str) -> dict:
    p = TEMPLATES / tid / "template.json"
    if not p.exists():
        raise SystemExit(f"unknown template '{tid}'. Available: {', '.join(t['id'] for t in list_templates())}")
    return json.loads(p.read_text())


def _lookup(values: dict, key: str):
    cur: Any = values
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _subst(node, values):
    if isinstance(node, str):
        m = _FULL.match(node)
        if m:
            return _lookup(values, m.group(1))
        return _INLINE.sub(lambda mm: str(_lookup(values, mm.group(1)) or ""), node)
    if isinstance(node, list):
        return [_subst(x, values) for x in node]
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            sv = _subst(v, values)
            if sv in (None, "") or sv == []:
                continue  # empty optional slot → let the scene default apply
            out[k] = sv
        return out
    return node


def _resolve_clip(v: Any, assets: Path) -> dict:
    """clip slot: {"src", "trace"} → src + focuses + duration from the Clep trace."""
    if isinstance(v, str):
        v = {"src": v}
    clip = {"src": v["src"], "focuses": v.get("focuses", []), "duration": v.get("duration")}
    if v.get("trace"):
        tr = json.loads((assets / v["trace"]).read_text())
        clip["focuses"] = tr.get("focuses", [])
        clip["duration"] = clip["duration"] or tr.get("duration")
    clip["duration"] = round(min(float(clip["duration"] or 8), 14.0), 2)
    return clip


def _check_limits(tpl: dict, values: dict) -> list:
    warns = []
    for k, s in tpl["slots"].items():
        v = values.get(k)
        if s.get("max") and isinstance(v, str) and len(v) > s["max"]:
            warns.append(f"{k}: {len(v)} chars > {s['max']} — may not fit the layout")
        if s.get("maxItems") and isinstance(v, list) and len(v) > s["maxItems"]:
            warns.append(f"{k}: {len(v)} items > {s['maxItems']}")
        if s.get("type") in ("clip", "image") and not v:
            warns.append(f"{k}: required {s['type']} slot is empty")
    return warns


def apply_controls(spec: dict, brand: dict, controls: dict, explicit: set) -> None:
    ov = spec.setdefault("styleOverrides", {})
    # Fonts
    fp = CONTROLS["fontPairings"].get(controls.get("fontPairing", "brand"), {})
    if "display" in fp:
        brand["fonts"] = {k: fp[k] for k in ("display", "body", "mono") if k in fp}
        brand["accentItalic"] = bool(fp.get("accentItalic"))
        if "tracking" in fp:
            ov["tracking"] = fp["tracking"]
        if fp.get("uppercase"):
            ov["uppercase"] = True
    elif brand.get("fonts", {}).get("display", {}).get("weight") in (400, "400"):
        ov.setdefault("tracking", -0.01)  # single-weight serif brand fonts want looser tracking
    # Backdrop
    bd = CONTROLS["backdrops"].get(controls.get("backdrop", ""))
    if bd:
        ov["background"] = {k: v for k, v in bd.items() if k in ("kind", "colors", "angle")}
    # Pace / text / camera / transitions
    spec["speed"] = CONTROLS["pace"].get(controls.get("pace", "normal"), 1)
    if controls.get("textAnim"):
        ov["titleAnim"] = controls["textAnim"]
    cam = CONTROLS["camera"].get(controls.get("camera", "normal"), 1)
    for sc in spec["scenes"]:
        c = sc.get("camera")
        if cam == 0:
            sc["camera"] = {"move": "none"}
            if sc["type"] == "clip_showcase":
                sc["props"]["zoom"] = 1.0
        elif c and "amount" in c:
            c["amount"] = round(c["amount"] * cam, 4)
        if sc["type"] == "clip_showcase" and cam:
            sc["props"]["zoom"] = round(1 + (sc["props"].get("zoom", 1.55) - 1) * cam, 3)
    if "transition" in explicit and controls.get("transition"):
        tt = controls["transition"]
        for sc in spec["scenes"]:
            sc["transition"] = {"type": tt, "duration": CONTROLS["transitions"].get(tt, 0.4)}
    # Format
    w, h = CONTROLS["formats"].get(controls.get("format", "16:9"), [1920, 1080])
    spec["format"] = {"width": w, "height": h, "fps": 30}
    # Direct color overrides
    for k, v in (controls.get("colors") or {}).items():
        brand.setdefault("colors", {})[k] = v


STRETCH = 1.25  # a scene may run up to 1.25x its registry max — beyond that it drags; longer asks go custom


def fit_duration(spec: dict, target: float) -> float:
    """Scale scene lengths so the video lands on `target` seconds. Fixed-length scenes (recorded
    clips) keep theirs; the rest share the difference within their natural range. Returns the result."""
    from . import engine
    reg = {s["type"]: s["duration"] for s in engine.registry()["scenes"]}
    scenes = spec.get("scenes") or []
    fixed = lambda sc: sc["type"] in ("clip_showcase", "video_showcase")
    overlap = sum(float((sc.get("transition") or {}).get("duration") or 0) for sc in scenes[:-1])
    flex = [sc for sc in scenes if not fixed(sc)]
    fixed_total = sum(float(sc.get("duration") or 0) for sc in scenes if fixed(sc))
    base = sum(float(sc.get("duration") or 0) for sc in flex) or 1.0
    f = (target + overlap - fixed_total) / base
    for sc in flex:
        lo, hi = reg.get(sc["type"], (1.5, 5))
        sc["duration"] = round(max(lo * 0.8, min(hi * STRETCH, float(sc["duration"]) * f)), 2)
    return round(sum(float(sc.get("duration") or 0) for sc in scenes) - overlap, 1)


def duration_range(tid: str, clip_seconds: float = 12.0) -> tuple:
    """(shortest, longest) seconds a template can honestly run, for telling the user up front."""
    from . import engine
    reg = {s["type"]: s["duration"] for s in engine.registry()["scenes"]}
    lo = hi = 0.0
    scenes = load(tid)["spec"]["scenes"]
    for sc in scenes:
        if sc["type"] in ("clip_showcase", "video_showcase"):
            lo += min(clip_seconds, 14.0)
            hi += min(clip_seconds, 14.0)
        else:
            a, b = reg.get(sc["type"], (1.5, 5))
            lo += a * 0.8
            hi += b * STRETCH
    overlap = sum(float((sc.get("transition") or {}).get("duration") or 0) for sc in scenes[:-1])
    return round(lo - overlap, 1), round(hi - overlap, 1)


def apply_look(spec: dict, brand: dict, ctl: dict, explicit: set) -> None:
    """controls.look (+ lookRecipe) → rewrite style/palette/fonts/transitions. See director/looks.py."""
    if not ctl.get("look"):
        return
    from . import looks
    recipe = ctl.get("lookRecipe") or looks.load(ctl["look"])
    if recipe:
        looks.apply(spec, brand, looks.validate(recipe)[0], explicit - {"look", "lookRecipe"})


def fill(tid: str, values: dict, brand: dict, controls: Optional[dict] = None, assets: Optional[Path] = None) -> dict:
    tpl = load(tid)
    controls = controls or {}
    explicit = set(controls)
    ctl = {**tpl["defaults"], **controls}
    # A real brand keeps its own typography unless the user explicitly picks a pairing.
    if "fontPairing" not in controls and (brand.get("fonts") or {}).get("display"):
        ctl["fontPairing"] = "brand"
    vals = {k: copy.deepcopy(s.get("default")) for k, s in tpl["slots"].items()}
    vals.update(values)
    for k, s in tpl["slots"].items():
        if s["type"] == "clip" and vals.get(k):
            vals[k] = _resolve_clip(vals[k], assets or Path("."))
    for w in _check_limits(tpl, vals):
        print(f"  warn: {w}")
    spec = _subst(copy.deepcopy(tpl["spec"]), vals)
    spec["version"] = 1
    spec["title"] = f"{brand.get('name', 'Video')} — {tpl['name']}"
    spec["style"] = ctl.get("style", tpl["defaults"]["style"])
    brand = copy.deepcopy(brand)
    apply_controls(spec, brand, ctl, explicit)
    if "transition" not in explicit and not ctl.get("look"):
        from . import edit, engine
        reg = engine.registry()
        edit.assign(spec["scenes"], edit.family_for(spec["style"], reg))
    apply_look(spec, brand, ctl, explicit)
    if ctl.get("seconds"):  # after the look: its transitions change the overlap
        spec["seconds"] = fit_duration(spec, float(ctl["seconds"]))
    spec["brand"] = brand
    return {"template": tid, "controls": ctl, **spec}


def instantiate(project: Project, tid: str, values: dict, controls: Optional[dict] = None,
                name: Optional[str] = None) -> Path:
    from . import engine
    brand = json.loads(project.brand_path.read_text())["brand"]
    missing = [brand[k] for k in ("logo", "logoOnDark", "mark") if brand.get(k) and not (project.assets / brand[k]).exists()]
    if missing:
        raise SystemExit(f"brand assets missing from {project.assets}: {', '.join(missing)}")
    project.specs.mkdir(parents=True, exist_ok=True)
    out = project.specs / f"{name or tid}.json"
    if tid == "custom":  # beat sheet → compiler; invalid scenes are fixed in code, not by the model
        from . import beats
        site = json.loads(project.brand_path.read_text())
        if not site.get("look"):  # brands extracted before looks existed: art-direct once, then keep it
            from . import looks
            site["look"] = looks.brand_look(site, project.assets)
        if not str(name or "").startswith("preview"):  # each new video for this brand rotates to fresh shots
            site["videosMade"] = int(site.get("videosMade", 0)) + 1
        project.brand_path.write_text(json.dumps(site, indent=2))
        clip = values.get("clip")
        clip = _resolve_clip(clip, project.assets) if clip else None
        spec, fixes = beats.build(values, site, controls or {}, project.dir / ".tmp", clip=clip, assets=project.assets)
        for f in fixes:
            print(f"  fix: {f}")
        out.write_text(json.dumps(spec, indent=2))
        return out
    spec = fill(tid, values, brand, controls, project.assets)
    ok, res = engine.validate(spec, project.dir / ".tmp")
    if not ok:
        raise SystemExit("template produced an invalid spec:\n" + "\n".join(res["errors"]))
    out.write_text(json.dumps({"template": tid, "controls": spec.get("controls"), **res["spec"]}, indent=2))
    return out


def example_project(tid: str) -> Project:
    """projects/examples/<id> with the example brand written as brand.json."""
    ex = json.loads((TEMPLATES / tid / "example.json").read_text())
    pr = Project(f"examples/{tid}").ensure()
    pr.brand_path.write_text(json.dumps({"brand": ex["brand"]}, indent=2))
    return pr
