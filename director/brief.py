"""Understand the product before writing about it.

    make(brand_doc, model) → brief: what it does, for whom, today's pain, the hero workflow,
                             what its main screen looks like, provable facts, domain words.

The film writer works from this brief, not from raw site copy, so the story and the recreated
UI are about *this* product. The brief is cached in memory per site and travels inside the
film draft (values.brief), so edits never pay for it twice.
"""
from __future__ import annotations

import json
import os
from typing import Optional

from . import llm

MODEL = os.environ.get("MOTION_CHAT_MODEL") or llm.MODEL
_CACHE: dict = {}

TASK = """You are a product marketer studying a product before a launch film is made about it.
Read the SITE COPY and describe the product precisely: be concrete, use its real vocabulary, and invent nothing.

Reply with ONLY JSON:
{
 "what": "one sentence: what it does, in plain words",
 "who": "the specific person who uses it (role and context)",
 "pain": "the concrete friction they feel today, a scene, not an abstraction",
 "today": "how they cope without it (the tools and the manual steps)",
 "after": "what their day looks like with it",
 "hero_flow": ["3–5 short steps of the ONE workflow that best shows the product working"],
 "screen": {
   "layout": "search | list | dashboard | chat",
   "name": "the app's name as shown in its sidebar (short)",
   "title": "the screen's title, e.g. 'Work orders', 'Leads', 'Portfolio'",
   "subtitle": "one short line under the title",
   "placeholder": "the input's placeholder",
   "query": "what the user types in the hero flow (specific and realistic)",
   "button": "the action button label",
   "insight": "the one-sentence result or confirmation the product gives back",
   "results": [{"tag": "status or label", "title": "a realistic row, value or card"}, x3]
 },
 "proof": ["facts from SITE COPY only: numbers, customers, certifications; [] if none"],
 "words": ["8–12 words this product's users actually say"],
 "is_agent": true or false (is it an AI agent or assistant that takes actions from a request?),
 "tone": "calm | confident | playful | urgent | premium"
}
Layout guide: search = ask or look up, then get results; list = a queue of items you act on (tickets, orders, leads);
dashboard = metrics you monitor and ask about; chat = an assistant you talk to."""


def _key(doc: Optional[dict]) -> str:
    b = (doc or {}).get("brand") or {}
    return f"{b.get('url') or ''}|{b.get('name') or ''}"


def make(brand_doc: Optional[dict], model: Optional[str] = None) -> dict:
    if not brand_doc:
        return {}
    k = _key(brand_doc)
    if k in _CACHE:
        return _CACHE[k]
    b, c = brand_doc.get("brand") or {}, brand_doc.get("copy") or {}
    ctx = "\n".join([
        f"PRODUCT: {b.get('name')} ({b.get('url', '')}) tagline={b.get('tagline')!r}",
        f"SITE COPY: title={c.get('title')!r} description={c.get('description')!r}",
        f"  h1={c.get('h1')} h2={(c.get('h2') or [])[:12]} h3={(c.get('h3') or [])[:16]}",
        f"  buttons={(c.get('buttons') or [])[:8]} paragraphs={(c.get('paragraphs') or [])[:14]}",
    ])
    try:
        out = llm.chat_json([{"role": "system", "content": TASK}, {"role": "user", "content": ctx}],
                            temperature=0.3, max_tokens=2500, model=model or MODEL)
    except Exception as e:
        print(f"[brief] failed: {e}")
        out = None
    brief = out if isinstance(out, dict) and out.get("what") else {}
    if brief:
        _CACHE[k] = brief
    return brief


def describe(brief: dict) -> str:
    if not brief:
        return "PRODUCT BRIEF: unavailable. Work from SITE COPY only."
    return "PRODUCT BRIEF (use this: the film is about exactly this):\n" + json.dumps(brief, ensure_ascii=False, indent=1)
