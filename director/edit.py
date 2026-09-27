"""The editor's cut decisions: which transition goes on each cut, in a video's own family.

An AE editor doesn't put the same dissolve on every cut. They keep one family per video
(its look) and pick within it by what's coming: fly *into* the product, hit the punchy
beats hard, land the ending with a reveal, alternate whip directions so motion flows.
Templates, custom beat sheets and looks all go through `assign`.
"""
from __future__ import annotations

from typing import Iterable, List, Optional

# Default length (s) per transition — mirrors DEFAULTS in engine/src/kit/motion/transitions.tsx.
SECONDS = {
    "cut": 0.0, "whip": 0.5, "push": 0.6, "slide": 0.6, "zoom": 0.6, "blur": 0.6, "strips": 0.85,
    "slash": 0.6, "glitch": 0.35, "flash": 0.55, "leak": 0.6, "dip": 0.55, "circle": 0.7, "impact": 0.4,
    "fade": 0.5, "wipe": 0.5, "flip": 0.6, "iris": 0.6, "clock": 0.6, "morph": 0.75,
}
DIRECTIONAL = {"whip", "push", "slide", "wipe", "strips"}

PRODUCT = {"site_showcase", "clip_showcase", "phone_showcase", "video_showcase"}
ENDING = {"end_card", "logo_reveal"}
PUNCHY = {"word_flash", "stat_counter", "kinetic_title", "statement"}

PREFER = {
    "product": ["zoom", "push", "whip", "circle"],
    "ending": ["circle", "strips", "dip", "impact", "zoom"],
    "punchy": ["impact", "slash", "whip", "glitch", "strips"],
}


LOUD = {"strips", "impact", "glitch", "leak", "circle", "dip"}  # graphic moments: accents, not every cut
LOUD_GAP = 3


def anchored(sc: dict, side: str) -> bool:
    """Does this scene have a container the morph can carry, at its start ("in") or end ("out")?
    Mirrors the `anchor` functions in engine/src/scenes (film.tsx, product.tsx, brand.tsx)."""
    t, p = sc.get("type"), sc.get("props") or {}
    v = p.get("variant")
    if t == "agent_trace":
        return v in (None, "rows", "terminal", "document") if side == "in" else (v in ("terminal", "document") and not p.get("result"))
    if t == "notification_stack":
        if v == "thread":
            return True
        if v == "lockscreen":
            return not p.get("caption")
        return side == "in" and v in (None, "cards") and not p.get("caption") and p.get("device") != "phone"
    if t == "video_showcase":
        return p.get("frame") != "full"
    if t == "end_card":
        return side == "in" and bool(p.get("cta"))
    return False


def _first(pref: Iterable[str], allowed: List[str], avoid: Optional[str], ok=lambda t: True) -> Optional[str]:
    for t in pref:
        if t in allowed and t != avoid and ok(t):
            return t
    return None


def assign(scenes: List[dict], family: List[str], keep_explicit: bool = False, max_loud: Optional[int] = None) -> None:
    """Set `transition` on every scene but the last, from `family` (signature first).
    max_loud caps graphic transitions per video (a story film uses one at most; a sizzle reel more)."""
    family = [t for t in family if t in SECONDS] or ["blur"]
    prev: Optional[str] = None
    rot = 0
    lr = ["left", "right"]
    last_used: dict = {}
    ok = lambda t, i: t not in LOUD or (i - last_used.get(t, -99) > LOUD_GAP and
                                        (max_loud is None or sum(x in LOUD for x in last_used) < max_loud))
    for i, sc in enumerate(scenes):
        if i == len(scenes) - 1:
            sc.pop("transition", None)
            break
        if keep_explicit and sc.get("transition", {}).get("_locked"):
            prev = sc["transition"]["type"]
            continue
        # One container carrying across the cut beats any wipe: take it whenever either side has one.
        if "morph" in family and (anchored(sc, "out") or anchored(scenes[i + 1], "in")) and prev != "morph":
            sc["transition"] = {"type": "morph", "duration": SECONDS["morph"]}
            prev = "morph"
            continue
        nxt = scenes[i + 1]["type"]
        role = "product" if nxt in PRODUCT else "ending" if nxt in ENDING else "punchy" if nxt in PUNCHY and i > 0 else None
        t = _first(PREFER[role], family, prev, lambda x: ok(x, i)) if role else None
        if not t:
            options = [x for x in family if x != prev and ok(x, i)] or [x for x in family if x not in LOUD] or family
            t = options[rot % len(options)]
            rot += 1
        last_used[t] = i
        tr = {"type": t}
        if t != "cut":
            tr["duration"] = SECONDS[t]
        if t in DIRECTIONAL:
            tr["direction"] = lr[i % 2]
        sc["transition"] = tr
        prev = t


def family_for(style: str, reg: dict, recipe: Optional[dict] = None) -> List[str]:
    """A look's own list wins, then the base style's set, then its single default."""
    if recipe and recipe.get("transitions"):
        return list(recipe["transitions"])
    st = reg["styles"].get(style, {})
    return list(st.get("transitionSet") or [st.get("transition", {}).get("type", "blur")])
