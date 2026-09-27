"""Chat → draft. Works the same on a cheap model as on Opus.

One conversational turn: the user's message (+ brand copy, + current draft) → a draft
the dashboard shows and renders. Code does the directing:

  1. route()     picks the template — or "custom" for a video no template covers
  2. seed        a complete draft from the site's own copy (or the current draft)
  3. the model   only rewrites words, reading just the skill files for this route
  4. guard       fixes limits, accents, invented numbers/quotes, assets, controls
  5. fallback    if the model fails or returns junk, the seed ships as-is

Template drafts: {"template": id, "values": {slot: value}, "controls": {...}}
Custom drafts:   {"template": "custom", "values": {"title", "mood", "style"?, "seconds", "beats": [...]}, "controls"}
"""
from __future__ import annotations

import json
import os
from typing import Optional

from . import beats as B
from . import draft as D
from . import llm
from . import looks as L
from . import templates as T

CHAT_MODEL = os.environ.get("MOTION_CHAT_MODEL") or llm.MODEL

TEMPLATE_TASK = """You are Clep's copywriter for a launch video. The template is fixed: {tid}.
Start from SEED (already valid) and improve the words using SITE COPY and the user's message.
{mode}
Reply with ONLY JSON: {{"reply": "one short friendly sentence, no markdown", "values": {{slot: value}}, "controls": {{}}}}
Only include controls the user asked to change ({controls})."""

CUSTOM_TASK = """You are Clep's director for a custom launch video. Write the beat sheet the user asked for.
Start from SEED (already valid) and change the structure and words to match the request, using SITE COPY.
{mode}
Reply with ONLY JSON: {{"reply": "one short friendly sentence, no markdown", "title": str, "mood": "calm|normal|energetic",
"style"?: str, "seconds"?: number, "beats": [...], "controls": {{}}}}"""

NEW_MODE = "This is a new video — write the whole draft."
EDIT_MODE = "The SEED is the user's CURRENT DRAFT. Change ONLY what the message asks; copy everything else unchanged."

# Edits are patches: the model says what changes, code applies it on top of the current draft, so
# nothing the user didn't mention can drift. The model first reads what's on screen now.
CUSTOM_EDIT_TASK = """You are Clep's director, editing a video the user already has. CURRENT VIDEO below is what was
generated and what the viewer sees, beat by beat (# = beat number). Read it first, then make ONLY the change the
user asks for. Everything you don't touch stays exactly as it is.
Reply with ONLY JSON:
{"reply": "one short sentence saying what you changed, no markdown",
 "ops": [ ... in order ... ],
 "title"?: str, "mood"?: "calm|normal|energetic", "style"?: str, "seconds"?: number, "controls"?: {}}
ops (beat numbers always refer to CURRENT VIDEO as shown, not after earlier ops):
  {"op": "edit", "beat": n, "set": {field: value}}      change some fields of one beat (only the fields that change)
  {"op": "replace", "beat": n, "with": {beat}}           swap one beat for a different kind of beat
  {"op": "insert", "after": n, "beat": {beat}}           add a beat (after: -1 = at the very start)
  {"op": "delete", "beat": n}
  {"op": "move", "beat": n, "after": m}                 reorder
Use "ops": [] when the ask is only a look/length/control change. If the ask is unclear, make no ops and ask in "reply"."""

TEMPLATE_EDIT_TASK = """You are Clep's copywriter, editing a video the user already has (template {tid}). CURRENT VALUES below
is what was generated. Read it first, then change ONLY what the user asks for.
Reply with ONLY JSON: {{"reply": "one short sentence saying what you changed, no markdown", "set": {{slot: new value}}, "controls": {{}}}}
"set" holds ONLY the slots that change; every other slot stays exactly as it is. Only include controls the user asked to change ({controls})."""


def _describe(values: dict, brand_doc: Optional[dict]) -> str:
    """The current custom video as the viewer sees it: beat → scene, seconds, on-screen words."""
    lines = [f"title: {values.get('title')!r} · mood: {values.get('mood')} · style: {values.get('style') or 'auto'} · "
             f"length: {values.get('seconds')}s"]
    scenes = []
    try:
        spec = B.compile_spec(values, brand_doc or {"brand": {"name": "", "colors": {}}}, {"width": 1920, "height": 1080})
        scenes = spec["scenes"]
        lines[0] += f" · look: {spec['style']}"
    except Exception:
        pass
    for i, b in enumerate(values.get("beats") or []):
        sc = next((s for s in scenes if s.get("id", "").startswith(f"{i:02d}-")), None)
        shown = f" → {sc['type']}, {sc['duration']}s" if sc else ""
        body = {k: v for k, v in b.items() if k != "kind" and v not in ("", None, [])}
        lines.append(f"#{i} {b['kind']}{shown}: {json.dumps(body, ensure_ascii=False)}")
    return "\n".join(lines)


def apply_ops(beats: list, ops: list) -> tuple:
    """Apply edit ops (indices into the ORIGINAL list) → (new beats, human summary of what changed)."""
    slots = [[dict(b)] for b in beats]   # slot i holds original beat i (or its replacement) + beats inserted after it
    head: list = []                      # beats inserted at the very start
    gone, done = set(), []
    n = len(beats)
    ok = lambda i: isinstance(i, int) and 0 <= i < n
    for op in ops if isinstance(ops, list) else []:
        if not isinstance(op, dict):
            continue
        kind, i = op.get("op"), op.get("beat")
        if kind == "edit" and ok(i) and isinstance(op.get("set"), dict):
            slots[i][0].update({k: v for k, v in op["set"].items() if k != "kind"})
            done.append(f"edited #{i} ({beats[i]['kind']})")
        elif kind == "replace" and ok(i) and isinstance(op.get("with"), dict) and op["with"].get("kind"):
            slots[i][0] = dict(op["with"])
            done.append(f"replaced #{i} with a {op['with']['kind']} beat")
        elif kind == "insert" and isinstance(op.get("beat"), dict) and op["beat"].get("kind"):
            after = op.get("after")
            (head if after == -1 else slots[after] if ok(after) else slots[-1]).append(dict(op["beat"]))
            done.append(f"added a {op['beat']['kind']} beat" + (f" after #{after}" if ok(after) else " at the start" if after == -1 else " at the end"))
        elif kind == "delete" and ok(i):
            gone.add(i)
            done.append(f"removed #{i} ({beats[i]['kind']})")
        elif kind == "move" and ok(i) and (ok(op.get("after")) or op.get("after") == -1) and op.get("after") != i:
            moved = slots[i][0]
            slots[i][0] = None  # leave the slot's inserted beats where they were
            (head if op["after"] == -1 else slots[op["after"]]).insert(0 if op["after"] == -1 else 1, moved)
            done.append(f"moved #{i} ({beats[i]['kind']})")
    out = list(head)
    for i, s in enumerate(slots):
        out += [b for j, b in enumerate(s) if b is not None and not (j == 0 and i in gone)]
    return out, done


def _slot_spec(tid: str) -> str:
    out = []
    for k, s in T.load(tid)["slots"].items():
        if s["type"] == "clip":
            continue
        lim = [f"≤{s['max']} chars"] if s.get("max") else []
        if s.get("maxItems"):
            lim.append(f"≤{s['maxItems']} items")
        if s.get("fields"):
            lim.append(f"fields {s['fields']}")
        out.append(f"- {k} ({s['type']}{', ' + ', '.join(lim) if lim else ''}): {s['label']}")
    return "\n".join(out)


def _controls_doc() -> str:
    c = T.CONTROLS
    return "; ".join(f"{k} ∈ {', '.join(c[src])}" for k, src in
                     (("fontPairing", "fontPairings"), ("backdrop", "backdrops"), ("pace", "pace"), ("textAnim", "textAnims"),
                      ("transition", "transitions"), ("camera", "camera"), ("format", "formats"))) + "; colors {primary, accent, background, foreground} hex"


def _context(doc: Optional[dict]) -> str:
    if not doc:
        return "BRAND: unknown (no site yet) — write good generic copy from the message."
    b, c = doc["brand"], doc.get("copy", {})
    return "\n".join([
        f"BRAND: {b.get('name')} ({b.get('url', '')})",
        f"SITE COPY: title={c.get('title')!r} description={c.get('description')!r}",
        f"  h1={c.get('h1')} h2={(c.get('h2') or [])[:8]} h3={(c.get('h3') or [])[:10]}",
        f"  buttons={(c.get('buttons') or [])[:6]} paragraphs={(c.get('paragraphs') or [])[:8]}",
        f"SCREENSHOTS: {b.get('screenshots', [])}",
    ])


def _history(history: Optional[list]) -> list:
    return [{"role": h["role"], "content": str(h["content"])[:1500]} for h in (history or [])[-6:]
            if h.get("role") in ("user", "assistant") and h.get("content")]


def _ask(system: str, user: str, history: Optional[list], model: Optional[str] = None) -> Optional[dict]:
    try:
        out = llm.chat_json([{"role": "system", "content": system}, *_history(history), {"role": "user", "content": user}],
                            temperature=0.5, max_tokens=8000, model=model or CHAT_MODEL)
        return out if isinstance(out, dict) else None
    except Exception as e:  # model down / junk → the seed still ships
        print(f"[chat] model failed, using seed: {e}")
        return None


def turn(message: str, brand_doc: Optional[dict], draft: Optional[dict], history: Optional[list] = None,
         assets: Optional[list] = None, model: Optional[str] = None) -> dict:
    """model: per-plan override from the Worker (free → cheap, studio → best); guards make any of them safe."""
    from . import filmchat
    if filmchat.wants(message, draft):
        return filmchat.turn(message, brand_doc, draft, history, assets, model)
    req = D.requirements(message)
    tid = D.route(message, draft)
    # A length a template can't fill without dragging → a custom video with enough beats,
    # unless the user named the template (then keep it and say so below).
    named = any(t["id"] in message.lower() or t["name"].lower() in message.lower() for t in T.list_templates())
    switched = False
    if req["seconds"] and tid != D.CUSTOM and not named and req["seconds"] > T.duration_range(tid)[1]:
        tid, switched = D.CUSTOM, True
    editing = bool(draft and draft.get("template") == tid)
    ctx = _context(brand_doc)

    # Visual look ("anime", "vaporwave", "like a Wes Anderson film"): resolved in code — a built-in,
    # a saved one, or a new recipe composed from engine building blocks. The model is told exactly
    # what was applied so its reply can't claim a look the video doesn't have.
    look, look_notes = L.resolve(message, model) if (L.style_request(message) or L._by_alias(message)) else (None, [])
    look_controls = {"look": look["name"], "lookRecipe": look} if look else {}
    wanted = L.style_request(message)
    if look:
        ctx += (f"\n\nAPPLIED LOOK (code already applied it): {look['label']} — {look['description']}"
                + (f" NOT POSSIBLE YET: {', '.join(look['unsupported'])}." if look.get("unsupported") else ""))
    elif wanted:
        ctx += f"\n\nLOOK '{wanted}' COULD NOT BE BUILT with the current engine — say so plainly in the reply; don't claim it."

    # Explicit asks code can check afterwards (length, exact wording).
    if req["seconds"]:
        ctx += f"\n\nTARGET LENGTH: {req['seconds']:.0f} seconds (code sets the timing)."
        if tid == D.CUSTOM:
            n = B.planned_beats(req["seconds"], (look or {}).get("base") or "clean-saas")
            ctx += f" WRITE {n} BEATS — length comes from more beats, never from longer ones. Every beat distinct."
    if req["quotes"]:
        ctx += "\n\nMUST APPEAR WORD FOR WORD in the right slot/beat: " + "; ".join(f'"{q}"' for q in req["quotes"])

    changed: list = []
    if tid == D.CUSTOM and editing:
        base = draft["values"]
        system = "\n\n".join([D.skill("director"), D.skill("story"), D.skill("custom"), CUSTOM_EDIT_TASK,
                              "CONTROLS: " + _controls_doc()])
        out = _ask(system, f"{ctx}\n\nCURRENT VIDEO:\n{_describe(base, brand_doc)}\n\nUSER: {message}", history, model) or {}
        new_beats, changed = apply_ops(base.get("beats") or [], out.get("ops"))
        proposed = {**base, "beats": new_beats, **{k: out[k] for k in ("title", "mood", "style", "seconds") if k in out}}
        values, fixes = B.sanitize(proposed, brand_doc, message, assets)
        if len(values["beats"]) < 2:  # an edit that wipes the video is a mistake, not a request
            values, fixes = B.sanitize(base, brand_doc, message, assets)
            changed, fixes = [], fixes + ["that edit would have left an empty video, so nothing changed"]
    elif tid == D.CUSTOM:
        base = B.seed_beats(brand_doc)
        system = "\n\n".join([D.skill("director"), D.skill("story"), D.skill("custom"),
                              CUSTOM_TASK.format(mode=NEW_MODE), "CONTROLS: " + _controls_doc()])
        out = _ask(system, f"{ctx}\n\nSEED: {json.dumps(base)}\n\nUSER: {message}", history, model) or {}
        proposed = {k: out[k] for k in ("title", "mood", "style", "seconds", "beats") if k in out} or base
        values, fixes = B.sanitize(proposed, brand_doc, message, assets)
        if len(values["beats"]) < 2:  # the model gave us nothing usable
            values, fixes = B.sanitize(base, brand_doc, message, assets)
            fixes.append("used the draft built from your site copy")
    else:
        base = {**D.seed(tid, brand_doc), **(draft.get("values") or {})} if editing else D.seed(tid, brand_doc)
        if editing:
            system = "\n\n".join([D.skill("director"), D.skill(tid), "SLOTS:\n" + _slot_spec(tid),
                                  TEMPLATE_EDIT_TASK.format(tid=tid, controls=_controls_doc())])
            out = _ask(system, f"{ctx}\n\nCURRENT VALUES: {json.dumps(base, ensure_ascii=False)}\n\nUSER: {message}", history, model) or {}
            patch = out.get("set") if isinstance(out.get("set"), dict) else {}
            changed = [f"changed {k}" for k, v in patch.items() if k in base and v != base.get(k)]
            values, fixes = D.guard(tid, {**base, **patch}, base, brand_doc, message, assets)
        else:
            system = "\n\n".join([D.skill("director"), D.skill(tid), "SLOTS:\n" + _slot_spec(tid),
                                  TEMPLATE_TASK.format(tid=tid, mode=NEW_MODE, controls=_controls_doc())])
            out = _ask(system, f"{ctx}\n\nSEED: {json.dumps(base)}\n\nUSER: {message}", history, model) or {}
            values, fixes = D.guard(tid, out.get("values") or {}, base, brand_doc, message, assets)

    controls = D.controls(message, {**(out.get("controls") or {}), **look_controls}, (draft or {}).get("controls") if draft else None)
    reply = D.clean(out.get("reply")) or ("Updated your draft." if editing else "Here's a first cut from your site.")
    if editing and not changed and not out.get("controls") and not look and not any(k in out for k in ("title", "mood", "style", "seconds")):
        reply = D.clean(out.get("reply")) or "I couldn't tell which part to change. Which scene do you mean?"
    # Honesty is enforced in code too, whatever the model wrote.
    if look and look.get("unsupported"):
        reply += f" Heads up: {look['label']} can't do {', '.join(look['unsupported'])} yet — everything else is in."
    elif wanted and not look:
        reply = f"I can't make a '{wanted}' look yet, so I kept the current style. " + reply
    fixes += look_notes

    # Verify the explicit asks were actually met; say so when one wasn't.
    notes = []
    if req["seconds"] and tid != D.CUSTOM:
        lo, hi = T.duration_range(tid)
        if not lo <= req["seconds"] <= hi:
            got = hi if req["seconds"] > hi else lo
            notes.append(f"this template runs {lo:.0f}–{hi:.0f}s, so it's set to about {got:.0f}s. "
                         f"Say \"make it a custom video\" for exactly {req['seconds']:.0f}s")
    blob = json.dumps(values, ensure_ascii=False).lower()
    missing = [q for q in req["quotes"] if q.lower() not in blob]
    if missing:
        notes.append("I couldn't fit " + ", ".join(f'"{q}"' for q in missing) + " — tell me which part it should replace")
    if notes:
        reply += " Note: " + "; ".join(notes) + "."
    # Brand gaps (system fonts, no logo, no website): ask for the real assets instead of silently substituting.
    needs = (brand_doc or {}).get("needs") or []
    if needs and not editing:
        reply += " To match your brand exactly: " + " ".join(n["message"] for n in needs[:3])
    return {"reply": reply, "template": tid, "values": values, "controls": controls, "fixes": fixes, "needs": needs,
            "changed": changed,
            "look": {"name": look["name"], "label": look["label"]} if look else None}
