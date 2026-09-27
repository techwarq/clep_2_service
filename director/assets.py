"""User brand assets: uploads and named fonts that override what brand.py pulled from the site.

Every call writes the file where the engine expects it, updates brand.json, and clears the matching
entry from doc["needs"] — so the dashboard/CLI can keep asking until nothing is missing.

    kind      where it lands                  what it changes in brand.json
    font      assets/fonts/<role>-<name>      brand.fonts[role]  (role: display | body | mono | accent)
    logo      assets/brand/logo_user.<ext>    brand.logo / brand.logoOnDark
    screenshot assets/shots/user_<name>       brand.screenshots (first, so product beats use it)
    voiceover assets/user/voiceover.<ext>     auto-wired as the video's narration
    music     assets/user/music.<ext>         auto-wired as the music bed
    file      assets/user/<name>              nothing (referenced by path)
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

from . import brand as brand_mod
from .paths import Project

KINDS = ("font", "logo", "screenshot", "voiceover", "music", "file")
FONT_ROLES = ("display", "body", "mono", "accent")
FONT_EXT = {".woff2", ".woff", ".ttf", ".otf"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}


def _safe(name: str) -> str:
    return re.sub(r"[^\w.\-]", "_", name).strip("._") or "upload"


def _load(pr: Project) -> dict:
    if pr.brand_path.exists():
        return json.loads(pr.brand_path.read_text())
    return {"brand": {"name": pr.name, "colors": {"background": "#ffffff", "foreground": "#0b0b0c", "primary": "#0b0b0c"},
                      "fonts": {}, "screenshots": []}, "needs": []}


def blank(pr: Project, name: Optional[str] = None) -> dict:
    """A brand kit for an account with no website: everything the video needs is asked for up front."""
    doc = _load(pr)
    doc["brand"]["name"] = name or doc["brand"].get("name") or pr.name
    doc["needs"] = [
        {"kind": "font", "role": "display", "message": "Headline font: upload your font files, or name a Google Font."},
        {"kind": "font", "role": "body", "message": "Body font: upload your font files, or name a Google Font (or reuse the headline font)."},
        {"kind": "logo", "message": "Logo: upload an SVG or a transparent PNG."},
        {"kind": "colors", "message": "Colors: send your background, text and accent colors (hex)."},
        {"kind": "screenshot", "message": "Product: upload 1–3 screenshots or a screen recording of the product working."},
    ]
    _save(pr, doc)
    return doc


def set_colors(pr: Project, colors: dict) -> dict:
    doc = _load(pr)
    for k in ("background", "foreground", "primary", "accent"):
        v = colors.get(k)
        if isinstance(v, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", v):
            doc["brand"].setdefault("colors", {})[k] = v.lower()
    _clear_need(doc, "colors")
    _save(pr, doc)
    return {"brand": doc["brand"], "needs": doc.get("needs") or []}


def _save(pr: Project, doc: dict) -> None:
    pr.brand_path.write_text(json.dumps(doc, indent=2))


def _clear_need(doc: dict, kind: str, role: Optional[str] = None) -> None:
    doc["needs"] = [n for n in doc.get("needs") or [] if not (n.get("kind") == kind and (role is None or n.get("role") == role))]


def _family_from_file(name: str) -> str:
    """'GeistSans-Bold.woff2' → 'Geist Sans'. Only a display name; the engine loads by file."""
    stem = Path(name).stem
    stem = re.sub(r"[-_ ]?(thin|extralight|light|regular|book|medium|semibold|bold|extrabold|black|heavy|italic|variable|vf|web)+$",
                  "", stem, flags=re.I)
    stem = re.sub(r"([a-z])([A-Z])", r"\1 \2", stem).replace("-", " ").replace("_", " ")
    return stem.strip() or "Brand"


def save_upload(pr: Project, kind: str, name: str, data: bytes, role: Optional[str] = None,
                family: Optional[str] = None, weight: Optional[str] = None, italic: bool = False) -> dict:
    """Store one uploaded file and wire it into the brand. Returns {path, brand, needs}."""
    if kind not in KINDS:
        raise ValueError(f"kind must be one of {', '.join(KINDS)}")
    pr.ensure()
    name = _safe(name)
    ext = Path(name).suffix.lower()
    doc = _load(pr)
    b = doc["brand"]

    if kind == "font":
        if role not in FONT_ROLES:
            raise ValueError(f"font uploads need role= one of {', '.join(FONT_ROLES)}")
        if ext not in FONT_EXT:
            raise ValueError(f"font files must be {', '.join(sorted(FONT_EXT))}")
        dest = pr.assets / "fonts" / f"{role}-{name}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        fam = family or _family_from_file(name)
        ref = {"family": f"{fam} Brand {role.title()}", "src": f"fonts/{dest.name}", "weight": weight or ("100 900" if "variable" in name.lower() else "400"),
               "uploaded": True}
        if italic or "italic" in name.lower():
            ref["italic"] = True
        b.setdefault("fonts", {})[role] = ref
        if role == "display" and "body" not in b["fonts"]:
            b["fonts"]["body"] = {**ref, "family": f"{fam} Brand Body"}  # one uploaded family covers both until told otherwise
            _clear_need(doc, "font", "body")
        _clear_need(doc, "font", role)
        rel = f"fonts/{dest.name}"

    elif kind == "logo":
        if ext not in IMAGE_EXT:
            raise ValueError("logos must be SVG, PNG, JPG or WebP (transparent PNG or SVG works best)")
        dest = pr.assets / "brand" / f"logo_user{ext}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        rel = f"brand/{dest.name}"
        if ext == ".png":
            light, dark = brand_mod._logo_variants(dest)
            # _logo_variants names its outputs after brand/logo.png; keep the user's file as the source of truth.
            b["logo"], b["logoOnDark"] = (light if light != "brand/logo.png" else rel), (dark if dark != "brand/logo.png" else rel)
        else:
            b["logo"] = b["logoOnDark"] = rel
        _clear_need(doc, "logo")

    elif kind == "screenshot":
        if ext not in IMAGE_EXT - {".svg"}:
            raise ValueError("screenshots must be PNG, JPG or WebP")
        dest = pr.assets / "shots" / f"user_{name}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        rel = f"shots/{dest.name}"
        b["screenshots"] = [rel] + [s for s in b.get("screenshots") or [] if s != rel]
        _clear_need(doc, "screenshot")

    elif kind in ("voiceover", "music"):
        if ext not in AUDIO_EXT:
            raise ValueError(f"audio must be {', '.join(sorted(AUDIO_EXT))}")
        user = pr.assets / "user"
        user.mkdir(parents=True, exist_ok=True)
        for old in user.glob(f"{kind}.*"):
            old.unlink()
        dest = user / f"{kind}{ext}"
        dest.write_bytes(data)
        rel = f"user/{dest.name}"

    else:
        dest = pr.assets / "user" / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        rel = f"user/{name}"

    _save(pr, doc)
    return {"path": rel, "brand": b, "needs": doc.get("needs") or []}


def set_font(pr: Project, role: str, family: str, weight: Optional[str] = None, italic: bool = False) -> dict:
    """Use a Google Font by name for one role ("use Geist for headlines")."""
    if role not in FONT_ROLES:
        raise ValueError(f"role must be one of {', '.join(FONT_ROLES)}")
    family = " ".join(family.split())
    if not brand_mod._is_google_font(family):
        raise ValueError(f"'{family}' isn't a Google Font we can load by name. Upload its font files instead "
                         f"(kind=font, role={role}), or pick a Google Font (e.g. Inter, Geist, Instrument Serif, DM Sans).")
    doc = _load(pr)
    ref = {"family": family, "google": True, "chosen": True}
    if weight:
        ref["weight"] = weight
    if italic:
        ref["italic"] = True
    doc["brand"].setdefault("fonts", {})[role] = ref
    _clear_need(doc, "font", role)
    _save(pr, doc)
    return {"brand": doc["brand"], "needs": doc.get("needs") or []}


def fonts_report(doc: dict) -> dict:
    """What the video will use per role, where it came from, and what's still needed. For UIs and the CLI."""
    b = doc.get("brand") or {}
    out = {}
    for role in FONT_ROLES:
        f = (b.get("fonts") or {}).get(role)
        if not f:
            continue
        src = ("uploaded" if f.get("uploaded") else "chosen" if f.get("chosen") else
               "substitute" if f.get("substitute") else "from site (file)" if f.get("src") else "from site (Google Fonts)")
        out[role] = {"family": re.sub(r" Brand \w+$", "", f["family"]), "source": src, **({"italic": True} if f.get("italic") else {})}
    return {"fonts": out, "seenOnSite": doc.get("fontsSeen") or [], "needs": doc.get("needs") or []}
