"""Looks: any visual style a user asks for, composed at runtime from engine building blocks.

A look is a *recipe* — data, never code — over what the engine can already draw:
base style preset, palette, Google fonts, background kind, overlays, headline text
effect, transition, camera, text animation, pace. So "anime", "vaporwave" or
"like a Wes Anderson film" all render through the same fast, validated pipeline.

    resolve(message)  → a built-in look (by alias), a saved look, or a NEW recipe the
                        model composes from the building-block menu (then validated,
                        saved and reused). Parts no block can express are returned as
                        `unsupported` and logged as gaps — never silently claimed.
    apply(spec, brand, recipe)  → rewrites a VideoSpec (template or custom) in place.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .paths import ROOT

LOOKS = ROOT / "looks"
GENERATED = LOOKS / "generated"
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

OVERLAYS = ["halftone", "scanlines", "vignette", "vhs", "sparkles", "focuslines", "paper", "grain", "letterbox"]
TEXT_EFFECTS = ["none", "outline", "offset-shadow", "outline-shadow", "glow", "gradient", "chrome"]
TEXT_ANIMS = ["mask", "words", "chars", "slam", "scramble", "blur", "stream", "pullout", "build"]
CAMERA_MOVES = ["none", "push_in", "pull_out", "drift", "pan_left", "pan_right", "tilt_up", "tilt_down", "punch_in", "dutch"]
PACE = {"calm": 0.85, "normal": 1.0, "snappy": 1.2}

# Display font width vs a normal sans — the engine sizes every headline with it so wide fonts never overflow.
FONT_WIDTH = {"Dela Gothic One": 1.35, "Monoton": 1.5, "Press Start 2P": 1.7, "Rubik Mono One": 1.45, "Archivo Black": 1.15,
              "Orbitron": 1.3, "Cinzel": 1.15, "Bangers": 0.85, "VT323": 0.8, "Caveat Brush": 0.9, "Playfair Display": 1.0,
              "Cormorant Garamond": 0.9, "Jost": 1.0}


def font_width(family: Optional[str]) -> float:
    if not family:
        return 1.0
    if family in FONT_WIDTH:
        return FONT_WIDTH[family]
    f = family.lower()
    if any(w in f for w in ("condensed", "narrow", "compressed")):
        return 0.85
    if any(w in f for w in ("mono", "wide", "extended", "expanded")):
        return 1.3
    if any(w in f for w in ("black", "gothic", "heavy", "ultra")):
        return 1.15
    return 1.05  # unknown display face: a little conservative


def _registry() -> dict:
    from . import engine
    return engine.registry()


def _fonts() -> set:
    p = LOOKS / "google-fonts.json"
    return set(json.loads(p.read_text())) if p.exists() else set()


def builtin() -> List[dict]:
    return json.loads((LOOKS / "builtin.json").read_text())


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "look"


# ---------------------------------------------------------------- storage (local + R2)

def save(recipe: dict) -> None:
    GENERATED.mkdir(parents=True, exist_ok=True)
    p = GENERATED / f"{recipe['name']}.json"
    p.write_text(json.dumps(recipe, indent=2))
    from . import store
    store.put_file(p, f"motion/looks/{p.name}")


def load(name: str) -> Optional[dict]:
    for r in builtin():
        if r["name"] == name:
            return r
    p = GENERATED / f"{name}.json"
    if not p.exists():
        from . import store
        if store.enabled():
            try:
                GENERATED.mkdir(parents=True, exist_ok=True)
                store.client().download_file(store.BUCKET, f"motion/looks/{name}.json", str(p))
            except Exception:
                return None
    return json.loads(p.read_text()) if p.exists() else None


def catalog() -> Dict[str, str]:
    """name → label for every look the dashboard can offer (built-in + generated here)."""
    out = {r["name"]: r["label"] for r in builtin()}
    for p in sorted(GENERATED.glob("*.json")) if GENERATED.exists() else []:
        try:
            out.setdefault(p.stem, json.loads(p.read_text()).get("label", p.stem))
        except Exception:
            pass
    return out


def log_gap(request: str, unsupported: List[str], look: Optional[str]) -> None:
    """What people asked for that no building block could draw — the engine's to-do list."""
    if not unsupported:
        return
    LOOKS.mkdir(exist_ok=True)
    row = {"at": time.time(), "request": request[:300], "look": look, "unsupported": unsupported}
    with (LOOKS / "gaps.jsonl").open("a") as f:
        f.write(json.dumps(row) + "\n")
    print(f"[looks] gap: {unsupported} (for {look or 'no look'})")


# ---------------------------------------------------------------- validation

def validate(raw: dict) -> Tuple[dict, List[str]]:
    """Clamp a recipe to what the engine can draw. Returns (recipe, notes about what was dropped)."""
    reg = _registry()
    fonts = _fonts()
    notes: List[str] = []
    r: dict = {}
    r["name"] = _slug(str(raw.get("name") or raw.get("label") or "custom-look"))
    r["label"] = str(raw.get("label") or r["name"].replace("-", " ").title())[:40]
    r["aliases"] = [str(a).lower()[:40] for a in (raw.get("aliases") or []) if a][:12]
    r["description"] = str(raw.get("description") or "")[:240]
    r["base"] = raw.get("base") if raw.get("base") in reg["styles"] else "clean-saas"
    r["paletteMode"] = raw.get("paletteMode") if raw.get("paletteMode") in ("brand", "look", "tint") else "brand"
    pal = raw.get("palette") or {}
    r["palette"] = {k: pal[k] for k in ("background", "foreground", "primary", "accent") if isinstance(pal.get(k), str) and HEX.match(pal[k])}
    if r["paletteMode"] != "brand" and len(r["palette"]) < 2:
        r["paletteMode"] = "brand"
    r["mode"] = raw.get("mode") if raw.get("mode") in ("light", "dark") else None
    f = raw.get("fonts") or {}
    r["fonts"] = {}
    for role in ("display", "body"):
        fam = f.get(role)
        if isinstance(fam, str) and fam in fonts:
            r["fonts"][role] = fam
        elif fam:
            notes.append(f"font '{fam}' isn't a Google font — kept the brand font")
    bg = raw.get("background") or {}
    kind = bg.get("kind") if isinstance(bg, dict) else bg
    r["background"] = {"kind": kind if kind in reg["backgrounds"] and kind != "image" else reg["styles"][r["base"]]["background"]["kind"] if isinstance(reg["styles"][r["base"]].get("background"), dict) else "flat"}
    if isinstance(bg, dict) and bg.get("colors"):
        cols = [c for c in bg["colors"] if isinstance(c, str) and HEX.match(c)][:4]
        if cols:
            r["background"]["colors"] = cols
    r["overlays"] = [o for o in (raw.get("overlays") or []) if o in OVERLAYS][:3]
    dropped = [o for o in (raw.get("overlays") or []) if o not in OVERLAYS]
    if dropped:
        notes.append(f"overlays {dropped} don't exist yet")
    r["textEffect"] = raw.get("textEffect") if raw.get("textEffect") in TEXT_EFFECTS else "none"
    if r["textEffect"] != "none" and r["fonts"].get("display") and r["fonts"].get("display") == r["fonts"].get("body"):
        r["fonts"].pop("body")  # effect targets the display font; keep body text clean
    tr = raw.get("transition") or {}
    ttype = tr.get("type") if isinstance(tr, dict) else tr
    ttype = ttype if ttype in reg["transitions"] else "blur"
    r["transition"] = {"type": ttype,
                       "duration": 0.0 if ttype == "cut" else max(0.15, min(1.2, float((tr.get("duration") if isinstance(tr, dict) else None) or 0.4)))}
    fam = [t for t in (raw.get("transitions") or []) if t in reg["transitions"]][:5]
    r["transitions"] = fam or ([r["transition"]["type"]] + [t for t in reg["styles"][r["base"]].get("transitionSet") or [] if t != r["transition"]["type"]])[:4]
    cam = raw.get("camera") or {}
    r["camera"] = {"move": cam.get("move") if cam.get("move") in CAMERA_MOVES else "push_in"}
    if isinstance(cam.get("amount"), (int, float)):
        r["camera"]["amount"] = max(0.0, min(0.15, float(cam["amount"])))
    if isinstance(cam.get("shake"), (int, float)) and cam["shake"] > 0:
        r["camera"]["shake"] = max(0.0, min(6.0, float(cam["shake"])))
    r["textAnim"] = raw.get("textAnim") if raw.get("textAnim") in TEXT_ANIMS else "mask"
    r["uppercase"] = bool(raw.get("uppercase"))
    r["pace"] = raw.get("pace") if raw.get("pace") in PACE else "normal"
    r["unsupported"] = [str(u)[:80] for u in (raw.get("unsupported") or []) if u][:6]
    from .beats import VARIANTS
    pv = raw.get("variants") if isinstance(raw.get("variants"), dict) else {}
    r["variants"] = {k: [v for v in (pv.get(k) or []) if v in opts][:3] for k, opts in VARIANTS.items() if pv.get(k)}
    return r, notes


# ---------------------------------------------------------------- resolve

# Checked in order — "look like X" / "style of X" before the looser "X style".
_INTENT = [
    re.compile(r"\b(?:look|looks|feel|feels|looking|feeling) like (?:a |an |the )?(?P<x>[\w\s\-&'.]{2,40})", re.I),
    re.compile(r"\bstyle of (?:a |an |the )?(?P<x>[\w\s\-&'.]{2,40})", re.I),
    re.compile(r"\bin (?:a |an |the )?(?P<x>[\w\-&'.]+(?:\s[\w\-&'.]+){0,3}) (?:style|look|aesthetic|vibe|feel)\b", re.I),
    re.compile(r"\b(?P<x>[\w\-&'.]+(?:\s[\w\-&'.]+)?) (?:style|styled|aesthetic|vibes?|themed)\b", re.I),
]
_NOT_LOOKS = {"launch", "feature", "product", "video", "clip", "my", "our", "the", "this", "that", "same", "template",
              "a", "an", "new", "different", "whole", "vertical", "tiktok", "calm", "calmer", "clean", "make", "it",
              "film", "movie", "please", "for", "with", "and", "of", "in", "video's", "ad"}


def _by_alias(text: str) -> Optional[dict]:
    t = f" {text.lower()} "
    best, best_len = None, 0
    for r in builtin() + [json.loads(p.read_text()) for p in (sorted(GENERATED.glob('*.json')) if GENERATED.exists() else [])]:
        for a in [r["name"].replace("-", " "), r.get("label", "").lower()] + r.get("aliases", []):
            if a and re.search(rf"(?<![\w-]){re.escape(a.lower())}(?![\w-])", t) and len(a) > best_len:
                best, best_len = r, len(a)
    return best


def style_request(message: str) -> Optional[str]:
    """The look words in a message ("anime", "a Wes Anderson film"), or None if it isn't asking for a look."""
    for rx in _INTENT:
        m = rx.search(message)
        if m:
            words = [w for w in m.group("x").strip().lower().rstrip(".").split() if w not in _NOT_LOOKS]
            if words:
                return " ".join(words[:5])
    return None


def resolve(message: str, model: Optional[str] = None) -> Tuple[Optional[dict], List[str]]:
    """(recipe or None, notes). Built-in/saved alias first; else compose a new one from the menu."""
    hit = _by_alias(message)
    if hit:
        return validate(hit)[0], []
    want = style_request(message)
    if not want:
        return None, []
    recipe, notes = compose(want, message, model)
    return recipe, notes


def compose(want: str, message: str, model: Optional[str] = None) -> Tuple[Optional[dict], List[str]]:
    """Ask the model for a recipe built only from the menu; validate, save, log gaps."""
    from . import draft as D
    from . import llm
    reg = _registry()
    menu = {
        "base styles": {k: v["description"][:120] for k, v in reg["styles"].items()},
        "backgrounds": [b for b in reg["backgrounds"] if b != "image"],
        "overlays": OVERLAYS,
        "textEffects": TEXT_EFFECTS,
        "transitions": reg["transitions"],
        "cameraMoves": CAMERA_MOVES,
        "textAnims": TEXT_ANIMS,
        "pace": list(PACE),
        "fonts": "any Google Fonts family name (exact spelling)",
    }
    example = builtin()[0]
    system = D.skill("looks") + "\n\nMENU:\n" + json.dumps(menu, indent=1) + "\n\nEXAMPLE RECIPE:\n" + json.dumps(example)
    try:
        raw = llm.chat_json([{"role": "system", "content": system},
                             {"role": "user", "content": f"LOOK REQUESTED: {want}\nFULL MESSAGE: {message}"}],
                            temperature=0.4, max_tokens=8000, model=model)
    except Exception as e:
        print(f"[looks] compose failed: {e}")
        return None, [f"couldn't build a '{want}' look right now"]
    if not isinstance(raw, dict) or raw.get("impossible"):
        why = (raw or {}).get("impossible") if isinstance(raw, dict) else None
        log_gap(message, [str(why or want)], None)
        return None, [f"no '{want}' look is possible with the current engine"]
    raw.setdefault("name", want)
    raw.setdefault("aliases", [want])
    recipe, notes = validate(raw)
    save(recipe)
    log_gap(message, recipe["unsupported"] + notes, recipe["name"])
    return recipe, notes


# ---------------------------------------------------------------- apply

def _vivid(hex_color: Optional[str]) -> bool:
    """Saturated and mid-luminance enough to show as an accent on light or dark surfaces."""
    if not isinstance(hex_color, str) or not HEX.match(hex_color):
        return False
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    mx, mn = max(r, g, b), min(r, g, b)
    lum = (mx + mn) / 2
    sat = 0 if mx == mn else (mx - mn) / (1 - abs(2 * lum - 1))
    return sat > 0.35 and 0.2 < lum < 0.85


def apply(spec: dict, brand: dict, recipe: dict, explicit: Optional[set] = None) -> None:
    """Rewrite a VideoSpec + its brand for this look. `explicit` = controls the user set by hand (they win)."""
    explicit = explicit or set()
    spec["style"] = recipe["base"]
    ov = spec.setdefault("styleOverrides", {})
    ov["background"] = dict(recipe["background"])
    ov["overlays"] = list(recipe["overlays"])
    ov["textEffect"] = recipe["textEffect"]
    ov["camera"] = dict(recipe["camera"])
    ov["transition"] = dict(recipe["transition"])
    ov["uppercase"] = recipe["uppercase"]
    if "textAnim" not in explicit:
        ov["titleAnim"] = recipe["textAnim"]
    if recipe.get("mode"):
        ov["mode"] = recipe["mode"]
    ov["fontWidth"] = font_width((recipe.get("fonts") or {}).get("display")) if "fontPairing" not in explicit else 1.0
    # Palette: "look" = the look's colors; "tint" = look surfaces + the brand's own primary/accent.
    cols = brand.setdefault("colors", {})
    pal = recipe.get("palette") or {}
    if recipe["paletteMode"] == "look":
        cols.update(pal)
    elif recipe["paletteMode"] == "tint":
        cols.update({k: v for k, v in pal.items() if k in ("background", "foreground")})
        # Keep the brand's primary only if it reads as a color on the look's surfaces; a near-black
        # or grey primary would vanish into outlines/shadows, so the look's own accent takes over.
        if not _vivid(cols.get("primary")) and pal.get("primary"):
            cols["primary"] = pal["primary"]
        if not _vivid(cols.get("accent")) and pal.get("accent"):
            cols["accent"] = pal["accent"]
    if recipe.get("mode"):
        brand["mode"] = recipe["mode"]
    if recipe.get("fonts") and "fontPairing" not in explicit:
        fonts = brand.setdefault("fonts", {})
        for role, fam in recipe["fonts"].items():
            fonts[role] = {"family": fam, "google": True, **({"weight": 400} if role == "display" else {})}
    if "pace" not in explicit:
        spec["speed"] = PACE[recipe["pace"]]
    # Cuts: the look's transition family, chosen per cut by the editor (templates hard-code theirs).
    if "transition" not in explicit:
        from . import edit
        edit.assign(spec.get("scenes", []), recipe.get("transitions") or [recipe["transition"]["type"]])
    for sc in spec.get("scenes", []):
        if sc.get("background") and sc["background"].get("kind") not in ("image",):
            sc.pop("background")  # let the look's backdrop show through
        if recipe["camera"].get("shake") and isinstance(sc.get("camera"), dict) and sc["camera"].get("move") not in (None, "none"):
            sc["camera"].setdefault("shake", recipe["camera"]["shake"])


# ---------------------------------------------------------------- the brand's own look

def _sat_lum(hex_color: Optional[str]) -> Tuple[float, float]:
    if not isinstance(hex_color, str) or not HEX.match(hex_color):
        return 0.0, 0.5
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    mx, mn = max(r, g, b), min(r, g, b)
    return (0.0 if mx == 0 else (mx - mn) / mx), 0.2126 * r + 0.7152 * g + 0.0722 * b


def heuristic_brand_look(doc: dict) -> dict:
    """No model available: read the obvious signals off brand.json (mode, fonts, color energy)."""
    b = doc.get("brand") or {}
    fonts = b.get("fonts") or {}
    fams = " ".join(str((fonts.get(r) or {}).get("family", "")) for r in ("display", "body")).lower()
    dark = b.get("mode") == "dark"
    sat, _ = _sat_lum((b.get("colors") or {}).get("primary"))
    serif = bool(fonts.get("accent")) or any(w in fams for w in ("serif", "garamond", "playfair", "newsreader", "fraunces", "instrument"))
    mono = any(w in fams for w in ("mono", "code", "courier"))
    if mono and dark:
        base, anim, tr, pace = "neon-tech", "scramble", ["cut", "whip", "zoom"], "normal"
    elif dark:
        base, anim, tr, pace = "dark-keynote", "blur", ["cut", "blur", "push"], "calm"
    elif serif:
        base, anim, tr, pace = "editorial-paper", "mask", ["cut", "push", "blur"], "calm"
    elif sat > 0.75:
        base, anim, tr, pace = "kinetic-bold", "slam", ["cut", "whip", "zoom"], "snappy"
    else:
        base, anim, tr, pace = "story-film", "stream", ["cut", "push", "zoom", "wipe"], "normal"
    raw = {"name": f"brand-{_slug(b.get('name') or 'site')}", "label": f"{b.get('name') or 'Site'} look",
           "description": f"From the site: {'dark' if dark else 'light'} {base.replace('-', ' ')}", "base": base,
           "paletteMode": "brand", "fonts": {}, "background": {"kind": "flat"}, "transition": {"type": tr[0]},
           "transitions": tr, "camera": {"move": "push_in", "amount": 0.035}, "textAnim": anim, "pace": pace}
    recipe = validate(raw)[0]
    recipe["source"] = "heuristic"
    return recipe


def brand_look(doc: dict, assets_dir: Path, model: Optional[str] = None) -> dict:
    """The film's look, art-directed from the brand's own site (vision on its screenshots). Colors and
    fonts always stay the brand's; only ground, texture, type motion, cuts, camera and pace are chosen."""
    from . import draft as D
    from . import llm
    b = doc.get("brand") or {}
    reg = _registry()
    menu = {
        "base styles": {k: v["description"][:140] for k, v in reg["styles"].items() if k != "anime"},
        "backgrounds": [x for x in reg["backgrounds"] if x != "image"],
        "overlays": OVERLAYS, "textEffects": TEXT_EFFECTS, "transitions": reg["transitions"],
        "cameraMoves": CAMERA_MOVES, "textAnims": TEXT_ANIMS, "pace": list(PACE),
        "variants (shots per beat — pick 2-3 per beat that fit THIS site; different sites should prefer different shots)": {
            "problem": {"cards": "stacked notification cards", "scatter": "toasts pile up everywhere, camera pulls back (chaotic, energetic)",
                        "thread": "a team channel scrolling with avatars (B2B, team tools)", "ticker": "one message at a time, huge type (bold, editorial)",
                        "lockscreen": "a phone with a big clock (consumer, personal, late-night)"},
            "trace": {"rows": "input bar + streaming rows (clean)", "terminal": "mono log with timestamps (dev tools, technical)",
                      "sheet": "spreadsheet filling, camera pushes into cells (finance, data, ops)", "nodes": "source logos wired to the agent (integrations, many tools)",
                      "document": "a memo writing itself (research, reports, editorial)", "cards": "big finding cards, carousel (consumer, bold)"}},
    }
    facts = {"name": b.get("name"), "mode": b.get("mode"), "colors": b.get("colors"), "palette": doc.get("palette"),
             "fonts": {r: (f or {}).get("family") for r, f in (b.get("fonts") or {}).items()},
             "accentItalic": b.get("accentItalic"), "radius": b.get("radius"),
             "headlines": ((doc.get("copy") or {}).get("h1") or [])[:2] + ((doc.get("copy") or {}).get("h2") or [])[:4]}
    content: List[dict] = [{"type": "text", "text": "BRAND FACTS (extracted from the site):\n" + json.dumps(facts, ensure_ascii=False)}]
    shots = [s for s in (b.get("screenshots") or []) if "full" not in s][:3]
    for s in shots:
        p = Path(assets_dir) / s
        if p.exists():
            content += [{"type": "text", "text": f"SCREENSHOT {s}"}, llm.image_part(p)]
    system = D.skill("brand-look") + "\n\nMENU:\n" + json.dumps(menu, indent=1)
    try:
        raw = llm.chat_json([{"role": "system", "content": system}, {"role": "user", "content": content}],
                            temperature=0.3, max_tokens=4000, model=model)
        if not isinstance(raw, dict) or not raw.get("base"):
            raise ValueError("no recipe")
    except Exception as e:
        print(f"[looks] brand look via model failed ({e}); using site signals")
        return heuristic_brand_look(doc)
    # The site's own colors, fonts and light/dark mode are facts, not choices.
    raw.update(name=f"brand-{_slug(b.get('name') or 'site')}", paletteMode="brand", fonts={}, mode=b.get("mode"))
    recipe, _ = validate(raw)
    recipe["observations"] = str(raw.get("observations") or "")[:400]
    recipe["source"] = "site"
    return recipe
