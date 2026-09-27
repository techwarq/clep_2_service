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

from . import draft as D
from . import filmspec as FS
from . import llm, voices
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


def turn(message: str, brand_doc: Optional[dict], draft: Optional[dict], history: Optional[list] = None,
         assets: Optional[list] = None, model: Optional[str] = None) -> dict:
    editing = bool(draft and draft.get("template") == FILM and (draft.get("values") or {}).get("beats"))
    base = draft["values"] if editing else FS.seed(brand_doc)
    controls = dict((draft or {}).get("controls") or {}) if editing else {}
    mood = base.get("mood") or "normal"

    # voice: named or described → switch; asked about → list
    asked_voice = voices.from_message(message)
    fits = [v["id"] for v in voices.suggest(brand_doc, mood, 3)]
    current = controls.get("voice") or (voices.DEFAULT if voices.DEFAULT in fits or editing else fits[0])
    voice_changed = bool(asked_voice and asked_voice != current)
    if asked_voice:
        current = asked_voice
    controls["voice"] = current
    only_voice = editing and asked_voice and len(re.findall(r"\w+", message)) <= 10
    list_voices = re.search(r"\b(which|what|list|show|suggest|options?)\b.*\bvoices?\b|\bvoices?\b.*\b(available|options?)\b", message.lower())

    out: dict = {}
    fixes: list = []
    if editing and (only_voice or list_voices):
        values = base
        reply = "Here are voices that fit this film." if list_voices and not asked_voice else ""
    else:
        ctx = _context(brand_doc)
        req = D.requirements(message)
        if req["seconds"]:
            ctx += f"\n\nTARGET LENGTH: about {req['seconds']:.0f} seconds. Add or remove beats; don't pad lines."
        if req["quotes"]:
            ctx += "\n\nMUST APPEAR WORD FOR WORD: " + "; ".join(f'"{q}"' for q in req["quotes"])
        system = "\n\n".join([D.skill("story"), D.skill("film"), EDIT if editing else NEW])
        try:
            out = llm.chat_json([{"role": "system", "content": system},
                                 *[{"role": h["role"], "content": str(h["content"])[:1500]} for h in (history or [])[-6:]
                                   if h.get("role") in ("user", "assistant") and h.get("content")],
                                 {"role": "user", "content": f"{ctx}\n\nSEED: {json.dumps(base, ensure_ascii=False)}\n\nUSER: {message}"}],
                                temperature=0.6, max_tokens=8000, model=model or CHAT_MODEL) or {}
        except Exception as e:
            print(f"[film-chat] model failed, using seed: {e}")
            out = {}
        proposed = {k: out[k] for k in ("title", "mood", "music", "beats") if k in out} if isinstance(out, dict) else {}
        values, fixes = FS.sanitize({**base, **proposed} if proposed.get("beats") else base, brand_doc)
        if len(values["beats"]) < 3:
            values, more = FS.sanitize(base, brand_doc)
            fixes += more + ["kept the previous script"]
        reply = D.clean(out.get("reply")) if isinstance(out, dict) else None
        reply = reply or ("Updated the film." if editing else "Here's a first cut of your launch film.")
        mood = values.get("mood") or mood
    if values.get("music"):
        controls["music"] = values["music"]
    controls.setdefault("format", "16:9")

    if not editing or voice_changed or list_voices:
        reply = (reply + " " + _voice_line(current, brand_doc, mood, voice_changed)).strip()
    needs = (brand_doc or {}).get("needs") or []
    if needs and not editing:
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
