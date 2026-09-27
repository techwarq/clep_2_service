"""Chat → film script. New videos default to a narrated film; film drafts are edited here too.

    wants(message, draft)   should this turn make/edit a film?
    turn(...)               same response shape as chat.turn, with template "film" plus `voice` and `voices`

Voice is handled in code: "use Lily" or "a British woman's voice" switches the narrator without touching
the script, and "which voices…" lists suggestions. The reply always says who narrates and offers a few
alternatives that fit.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

import random

from . import brief as BR
from . import draft as D
from . import filmspec as FS
from . import llm, stories, voices
from . import templates as T

FILM = "film"
CHAT_MODEL = os.environ.get("MOTION_CHAT_MODEL") or llm.MODEL

NEW = "This is a new film. Write the whole script."
EDIT = """The SEED is the user's CURRENT FILM. Change ONLY what the message asks and copy every other beat exactly
(same kinds, same words, same order). Return the full script."""


def wants(message: str, draft: Optional[dict]) -> bool:
    if draft and draft.get("template") == FILM:
        return True
    low = message.lower()
    if re.search(r"\b(film|narrat|voice ?over|story|launch video|promo)\b", low):
        return True
    if draft and draft.get("template"):
        return False  # keep editing the template/custom draft the user already has
    if os.environ.get("MOTION_FILM_DEFAULT", "1") == "0":
        return False
    named = any(t["id"] in low or t["name"].lower() in low for t in T.list_templates())
    return not named


def _voice_line(vid: str, brand_doc: Optional[dict], mood: str, changed: bool) -> str:
    v = voices.get(vid)
    alts = [a["id"] for a in voices.suggest(brand_doc, mood, 3, exclude=vid)][:2]
    head = f"Now narrated by {v['label']}" if changed else f"Narrated by {v['label']}"
    return f"{head} ({v['description'].split('.')[0].lower()}). Other voices that fit: {', '.join(alts)}. Say \"use {alts[0]}\" to switch."


def _voices_payload(brand_doc: Optional[dict], mood: str, current: str) -> list:
    cat = {v["id"]: v for v in voices.catalog()}
    picks = [current] + [v["id"] for v in voices.suggest(brand_doc, mood, 4, exclude=current)]
    return [{**cat[p], "selected": p == current} for p in picks if p in cat]


OPTIONAL = ["shipped", "checklist", "grind", "loop", "code", "screenshot", "result", "carousel"]
ALWAYS = ["headline", "reveal", "app", "close"]
LOOKS = {  # engine/src/film: one look per film, never the previous film's
    "ground": ["glow", "flat", "grid"],
    "headline": ["center", "left", "mask", "type"],
    "reveal": ["flare", "grid", "split"],
    "result": ["player", "cards"],
    "close": ["row", "stack"],
}


def _palette(rng: random.Random, brief: dict, story: dict, prev_kinds: set, has_shots: bool) -> list:
    """Which optional components this film may use: the story's needs + a random few, fresh ones first."""
    optional = [k for k in OPTIONAL if not (k == "screenshot" and not has_shots)]
    if not re.search(r"\b(code|developer|api|sdk|repo|github|deploy|engineer)", json.dumps(brief).lower()):
        optional = [k for k in optional if k != "code"]
    pick = []
    for grp in re.findall(r"\(([a-z]+(?: or [a-z]+)*)\)", story["shape"]):  # "(checklist or grind)" → one of them
        opts = [k for k in grp.split(" or ") if k in optional]
        if opts and not any(k in pick for k in opts):
            fresh = [k for k in opts if k not in prev_kinds] or opts
            pick.append(rng.choice(fresh))
    rest = [k for k in optional if k not in pick]
    rng.shuffle(rest)
    rest.sort(key=lambda k: k in prev_kinds)  # unused-last-time first
    pick += rest[: rng.randint(1, 3)]
    if brief.get("is_agent") and story["id"] == "agent":
        pick.append("prompt")
    return ALWAYS + pick


def _look(rng: random.Random, prev: dict) -> dict:
    return {k: rng.choice([v for v in opts if v != prev.get(k)] or opts) for k, opts in LOOKS.items()}


def _avoid_lines(prev: Optional[dict]) -> str:
    beats = (prev or {}).get("beats") or []
    lines = [b.get("vo") for b in beats if b.get("vo")][:6] + [b.get("text") for b in beats if b.get("text")][:4]
    return ("\n\nTHE PREVIOUS FILM (do NOT reuse its hook, lines, structure or on-screen words):\n- " + "\n- ".join(lines)) if lines else ""


def turn(message: str, brand_doc: Optional[dict], draft: Optional[dict], history: Optional[list] = None,
         assets: Optional[list] = None, model: Optional[str] = None) -> dict:
    had_film = bool(draft and draft.get("template") == FILM and (draft.get("values") or {}).get("beats"))
    prev = draft["values"] if had_film else None
    asked_voice = voices.from_message(message)
    only_voice = had_film and asked_voice and len(re.findall(r"\w+", message)) <= 10
    list_voices = re.search(r"\b(which|what|list|show|suggest|options?)\b.*\bvoices?\b|\bvoices?\b.*\b(available|options?)\b", message.lower())
    # "make another / a different one" on an existing film → a brand-new film that avoids the last one
    fresh = had_film and not only_voice and not list_voices and bool(stories.FRESH.search(message))
    editing = had_film and not fresh
    controls = dict((draft or {}).get("controls") or {}) if had_film else {}
    base = prev if editing else FS.seed(brand_doc)
    mood = (prev or base).get("mood") or "normal"

    # voice: named or described → switch; a fresh film also gets a fresh voice among those that fit
    fits = [v["id"] for v in voices.suggest(brand_doc, mood, 4)]
    if asked_voice:
        current = asked_voice
    elif editing and controls.get("voice"):
        current = controls["voice"]
    else:
        pool = [v for v in fits if v != controls.get("voice")] or fits
        current = voices.DEFAULT if (not had_film and voices.DEFAULT in fits[:3]) else random.choice(pool[:3])
    voice_changed = bool(had_film and current != controls.get("voice"))
    controls["voice"] = current

    out: dict = {}
    fixes: list = []
    if editing and (only_voice or list_voices):
        values = base
        reply = "Here are voices that fit this film." if list_voices and not asked_voice else ""
    else:
        brief = (prev or {}).get("brief") or BR.make(brand_doc, model)
        ctx = _context(brand_doc) + "\n\n" + BR.describe(brief)
        if editing:
            story = stories.BY_ID.get(prev.get("story")) or stories.STORIES[0]
            palette = sorted({b["kind"] for b in prev["beats"]} | set(ALWAYS))
            look = prev.get("look") or _look(random.Random(), {})
        else:
            rng = random.Random()
            story = stories.pick(brief, [(prev or {}).get("story") or ""], stories.from_message(message), rng)
            has_shots = bool(((brand_doc or {}).get("brand") or {}).get("screenshots"))
            palette = _palette(rng, brief, story, {b["kind"] for b in (prev or {}).get("beats") or []}, has_shots)
            look = _look(rng, (prev or {}).get("look") or {})
            ctx += "\n\n" + stories.describe(story)
            ctx += "\n\nCOMPONENTS FOR THIS FILM (use ONLY these kinds; if the shape names another, use the closest one here): " + ", ".join(palette)
            ctx += _avoid_lines(prev)
        req = D.requirements(message)
        if req["seconds"]:
            ctx += f"\n\nTARGET LENGTH: about {req['seconds']:.0f} seconds (~{max(4, round(req['seconds'] / 4.5))} beats). Don't pad lines."
        if req["quotes"]:
            ctx += "\n\nMUST APPEAR WORD FOR WORD: " + "; ".join(f'"{q}"' for q in req["quotes"])
        system = "\n\n".join([D.skill("story"), D.skill("film"), EDIT if editing else NEW])
        seed = base if editing else {"note": "no seed: write this film from the brief and the story shape"}
        try:
            out = llm.chat_json([{"role": "system", "content": system},
                                 *[{"role": h["role"], "content": str(h["content"])[:1500]} for h in (history or [])[-6:]
                                   if h.get("role") in ("user", "assistant") and h.get("content")],
                                 {"role": "user", "content": f"{ctx}\n\nSEED: {json.dumps(seed, ensure_ascii=False)}\n\nUSER: {message}"}],
                                temperature=0.6 if editing else 0.95, max_tokens=8000, model=model or CHAT_MODEL) or {}
        except Exception as e:
            print(f"[film-chat] model failed, using seed: {e}")
            out = {}
        proposed = {k: out[k] for k in ("title", "mood", "music", "beats") if k in out} if isinstance(out, dict) else {}
        if not editing and proposed.get("beats"):  # hold the model to this film's palette
            kept = [b for b in proposed["beats"] if isinstance(b, dict) and (b.get("kind") in palette or b.get("kind") == "prompt" and "prompt" in palette)]
            if len(kept) < len(proposed["beats"]):
                fixes.append(f"removed {len(proposed['beats']) - len(kept)} beat(s) outside this film's components")
            proposed["beats"] = kept
        values, more = FS.sanitize({**base, **proposed} if proposed.get("beats") else FS.seed(brand_doc) if not editing else base, brand_doc)
        fixes += more
        if len(values["beats"]) < 3:
            values, more = FS.sanitize(base, brand_doc)
            fixes += more + ["kept the previous script"]
        values.update(brief=brief, story=story["id"], look=look)
        reply = D.clean(out.get("reply")) if isinstance(out, dict) else None
        reply = reply or ("Updated the film." if editing else f"Here's a new cut: {story['name'].lower()}.")
        mood = values.get("mood") or mood
    if values.get("music"):
        controls["music"] = values["music"]
    controls.setdefault("format", "16:9")

    if not editing or voice_changed or list_voices:
        reply = (reply + " " + _voice_line(current, brand_doc, mood, voice_changed)).strip()
    needs = (brand_doc or {}).get("needs") or []
    if needs and not had_film:
        reply += " To match your brand exactly: " + " ".join(n["message"] for n in needs[:3])
    return {"reply": reply, "template": FILM, "values": values, "controls": controls, "fixes": fixes, "needs": needs,
            "changed": [], "look": None, "voice": current, "voices": _voices_payload(brand_doc, mood, current)}


def _context(doc: Optional[dict]) -> str:
    if not doc:
        return "BRAND: unknown (no site yet). Write a strong generic script from the message."
    b, c = doc["brand"], doc.get("copy", {})
    return "\n".join([
        f"BRAND: {b.get('name')} ({b.get('url', '')}) tagline={b.get('tagline')!r}",
        f"SITE COPY: title={c.get('title')!r} description={c.get('description')!r}",
        f"  h1={c.get('h1')} h2={(c.get('h2') or [])[:8]} h3={(c.get('h3') or [])[:10]}",
        f"  buttons={(c.get('buttons') or [])[:6]} paragraphs={(c.get('paragraphs') or [])[:8]}",
        f"SCREENSHOTS: {b.get('screenshots', [])}",
    ])
