"""Beat sheet → VideoSpec. The compiler behind custom (non-template) videos.

The model writes a short list of beats — {kind, words} — and this module does the
directing: scene type per beat, props, timing to hit the target length, camera,
transitions, a contrast beat, hook-first / CTA-last structure, real screenshots for
product beats, and validation errors fixed in code (never sent back to the model).
"""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from . import draft as D
from . import engine
from . import templates as T

MAX_BEATS = 16
# Shots a beat can be filmed as (engine scene `variant`). Picked per brand look + per video so two videos
# don't share the same frames; a beat can name one explicitly ("show the pings on a phone lockscreen").
VARIANTS = {
    "problem": ["cards", "scatter", "thread", "ticker", "lockscreen"],
    "trace": ["rows", "terminal", "sheet", "nodes", "document", "cards"],
}
MAX_STRETCH = 1.15  # a scene never runs past 115% of its natural max — length comes from more beats
# ...except the shots where the product is working: that's what people watch, so those may hold longer
# (the camera keeps pushing inside them) instead of padding the story with filler beats.
HOLD_TYPES = {"chat_demo", "search_results", "table_fill", "terminal_type", "site_showcase", "phone_showcase", "agent_trace"}
HOLD_STRETCH = 1.5

STYLES = ["story-film", "clean-saas", "dark-keynote", "kinetic-bold", "editorial-paper", "neon-tech", "soft-brand"]
MOODS = ("calm", "normal", "energetic")
OPENERS, CLOSERS = ("hook", "words", "statement"), ("cta", "logo")
# Beats that depict a demo scenario — their numbers are the demo, not claims.
DEMO_KINDS = {"chat", "search", "table", "terminal", "code", "problem", "click", "trace"}

LIM = {"title": 48, "accent": 24, "eyebrow": 28, "final": 30, "caption": 44, "heading": 40, "button": 22, "result": 32,
       "headline": 44, "cta": 22, "tagline": 44, "query": 60, "status": 36, "beforeTitle": 16, "afterTitle": 16,
       "quote": 110, "author": 28, "role": 32, "url": 40, "prompt": 80, "result": 40}
ITEM_LIM = {"words": 14, "statement": 40, "problem": 22, "list": 28, "steps": 18, "compare": 18, "terminal": 60,
            "code": 80, "chat": 32}
MAX_ITEMS = {"words": 6, "statement": 3, "problem": 2, "list": 5, "features": 6, "steps": 5, "before": 5, "after": 3,
             "stats": 3, "messages": 5, "results": 4, "columns": 4, "rows": 6, "terminal": 6, "code": 14, "notif": 4}

ICONS = [(r"fast|speed|quick|instant|second", "zap"), (r"secur|safe|priva|trust", "shield-check"),
         (r"time|schedul|calendar|week|day", "clock"), (r"team|people|user|collab|invite", "users"),
         (r"code|api|sdk|dev|terminal|cli", "code"), (r"video|film|clip|render|record|mp4", "film"),
         (r"zoom|focus|detail", "zoom-in"), (r"click|cursor|tap", "mouse-pointer-click"),
         (r"chart|data|metric|analytic|report", "bar-chart-3"), (r"mail|email|inbox", "mail"),
         (r"chat|message|text|reply", "message-square"), (r"search|find|research", "search"),
         (r"dashboard|app|product|ui", "layout-dashboard"), (r"brand|design|color|style", "palette"),
         (r"export|download|share|ship|launch", "rocket")]


def icon_for(text: str) -> str:
    t = (text or "").lower()
    return next((ic for rx, ic in ICONS if re.search(rx, t)), "sparkles")


# ---------------------------------------------------------------- sanitize

def _s(v, key: str) -> str:
    return D.fit(v, LIM.get(key)) if isinstance(v, (str, int, float)) else ""


def _list(v, lim: int, n: int) -> List[str]:
    out, seen = [], set()
    for it in v if isinstance(v, list) else [v] if isinstance(v, str) else []:
        it = D.fit(it, lim) if isinstance(it, (str, int, float)) else ""
        if it and D._norm(it) not in seen:
            seen.add(D._norm(it)); out.append(it)
    return out[:n]


def sanitize(doc_in: dict, site: Optional[dict], message: str = "", assets: Optional[List[str]] = None) -> Tuple[dict, List[str]]:
    """Clean every beat; drop the ones that can't render or that invent proof. Returns (beat doc, fixes)."""
    # `approved`: lines the user wrote or signed off on (a script, sourced figures) count as a source, like their message.
    approved = " ".join(str(x) for x in (doc_in.get("approved") or []) if isinstance(x, (str, int, float)))
    src = D.source_text(site, message, approved)
    ok_assets = D.valid_assets(site, assets)
    fixes, beats = [], []
    demo = ""  # text of the demo beats so far: a payoff may repeat their numbers — it's the scenario, not a new claim
    for i, b in enumerate(doc_in.get("beats") or []):
        if not isinstance(b, dict):
            continue
        k = str(b.get("kind") or "").lower().strip()
        nb: dict = {"kind": k}
        if k == "hook":
            nb.update(title=_s(b.get("title"), "title"), accent=_s(b.get("accent"), "accent"), eyebrow=_s(b.get("eyebrow"), "eyebrow"))
            ok = bool(nb["title"])
        elif k == "words":
            nb.update(words=_list(b.get("words"), ITEM_LIM["words"], MAX_ITEMS["words"]), final=_s(b.get("final"), "final"),
                      accent=_s(b.get("accent"), "accent"))
            ok = len(nb["words"]) >= 2
        elif k in ("statement", "problem"):
            nb["lines"] = _list(b.get("lines"), ITEM_LIM[k], MAX_ITEMS[k])
            nb["accent"] = _s(b.get("accent"), "accent")
            if k == "problem":
                nb["items"] = [{"app": D.fit(x.get("app"), 16), "title": D.fit(x.get("title"), 36)}
                               for x in (b.get("items") or []) if isinstance(x, dict) and x.get("title")][:MAX_ITEMS["notif"]]
                ok = len(nb["items"]) >= 2
            else:
                ok = bool(nb["lines"])
        elif k == "product":
            nb.update(caption=_s(b.get("caption"), "caption"), accent=_s(b.get("accent"), "accent"))
            shot = b.get("screenshot")
            nb["screenshot"] = shot if isinstance(shot, str) and shot in ok_assets else None
            ok = True
        elif k == "click":
            nb.update(heading=_s(b.get("heading"), "heading"), button=_s(b.get("button"), "button"), result=_s(b.get("result"), "result"))
            ok = bool(nb["heading"] and nb["button"])
        elif k == "list":
            nb.update(title=_s(b.get("title"), "caption"), items=_list(b.get("items"), ITEM_LIM["list"], MAX_ITEMS["list"]))
            ok = len(nb["items"]) >= 2
        elif k == "features":
            items = []
            for x in b.get("items") or []:
                if isinstance(x, dict) and x.get("title"):
                    items.append({"title": D.fit(x["title"], 22), "desc": D.fit(x.get("desc"), 40)})
                elif isinstance(x, str) and x.strip():
                    items.append({"title": D.fit(x, 22), "desc": ""})
            nb.update(title=_s(b.get("title"), "caption"), items=items[:MAX_ITEMS["features"]])
            ok = len(nb["items"]) >= 2
        elif k == "steps":
            nb.update(items=_list(b.get("items"), ITEM_LIM["steps"], MAX_ITEMS["steps"]), caption=_s(b.get("caption"), "caption"))
            ok = len(nb["items"]) >= 2
        elif k == "compare":
            nb.update(beforeTitle=_s(b.get("beforeTitle") or "Before", "beforeTitle"),
                      before=_list(b.get("before"), ITEM_LIM["compare"], MAX_ITEMS["before"]),
                      afterTitle=_s(b.get("afterTitle") or "Now", "afterTitle"),
                      after=_list(b.get("after"), ITEM_LIM["compare"], MAX_ITEMS["after"]))
            ok = bool(nb["before"] and nb["after"])
        elif k == "stat":
            stats = [{"value": D.fit(x.get("value"), 10), "label": D.fit(x.get("label"), 32)}
                     for x in (b.get("stats") or []) if isinstance(x, dict) and x.get("value")]
            real = [x for x in stats if not D.invented_numbers(x["value"], src + demo)]
            if len(real) < len(stats):
                fixes.append(f"beat {i} (stat): dropped numbers that aren't on the site or in your message")
            nb["stats"] = real[:MAX_ITEMS["stats"]]
            ok = bool(nb["stats"])
        elif k == "quote":
            nb.update(quote=_s(b.get("quote"), "quote"), author=_s(b.get("author"), "author"), role=_s(b.get("role"), "role"))
            ok = bool(nb["quote"]) and D._norm(nb["quote"]) in D._norm(src)
            if nb["quote"] and not ok:
                fixes.append(f"beat {i} (quote): not found in site copy or your message — removed, we never invent testimonials")
        elif k == "chat":
            msgs = [{"from": "user" if str(x.get("from")).lower() == "user" else "agent", "text": D.fit(x.get("text"), 80)}
                    for x in (b.get("messages") or []) if isinstance(x, dict) and x.get("text")]
            nb.update(messages=msgs[:MAX_ITEMS["messages"]], results=_list(b.get("results"), ITEM_LIM["chat"], MAX_ITEMS["results"]))
            ok = len(nb["messages"]) >= 2
        elif k == "search":
            res = [{"title": D.fit(x.get("title"), 40), "source": D.fit(x.get("source"), 20)}
                   for x in (b.get("results") or []) if isinstance(x, dict) and x.get("title")]
            nb.update(query=_s(b.get("query"), "query"), status=_s(b.get("status"), "status"), results=res[:MAX_ITEMS["results"]])
            ok = bool(nb["query"])
        elif k == "table":
            cols = _list(b.get("columns"), 16, MAX_ITEMS["columns"])
            rows = [[D.fit(c, 24) for c in r][: len(cols)] for r in (b.get("rows") or []) if isinstance(r, list)]
            rows = [r + [""] * (len(cols) - len(r)) for r in rows if any(r)][:MAX_ITEMS["rows"]]
            nb.update(title=_s(b.get("title"), "caption"), columns=cols, rows=rows)
            ok = len(cols) >= 2 and len(rows) >= 2
        elif k == "terminal":
            nb["lines"] = _list(b.get("lines"), ITEM_LIM["terminal"], MAX_ITEMS["terminal"])
            ok = bool(nb["lines"])
        elif k == "code":
            lines = [str(x)[:ITEM_LIM["code"]] for x in (b.get("lines") or []) if isinstance(x, (str, int, float))][:MAX_ITEMS["code"]]
            hl = b.get("highlight") if isinstance(b.get("highlight"), int) else len(lines) - 1
            nb.update(lines=lines, highlight=max(0, min(hl, len(lines) - 1)))
            ok = bool(lines)
        elif k == "film":
            src = b.get("src")
            nb.update(src=src if isinstance(src, str) and src.lower().endswith((".mp4", ".mov", ".webm")) and ".." not in src else "",
                      caption=_s(b.get("caption"), "caption"), accent=_s(b.get("accent"), "accent"),
                      start=float(b.get("start") or 0), seconds=float(b.get("seconds") or 6))
            # A screen recording of the product: focus points {t, x, y, label?, click?} drive the camera.
            fx = [{kk: f[kk] for kk in ("t", "x", "y", "label", "click", "zoom") if kk in f}
                  for f in (b.get("focuses") or []) if isinstance(f, dict) and {"t", "x", "y"} <= set(f)]
            if fx:
                nb["focuses"] = fx[:12]
                nb["url"] = _s(b.get("url"), "url")
            ok = bool(nb["src"])
        elif k == "reel":
            films = [{"src": f["src"], "title": D.fit(f.get("title"), 32), "start": float(f.get("start") or 0)}
                     for f in (b.get("films") or []) if isinstance(f, dict) and str(f.get("src", "")).endswith((".mp4", ".webm", ".mov"))]
            nb.update(films=films[:6], caption=_s(b.get("caption"), "caption"), accent=_s(b.get("accent"), "accent"),
                      seconds=float(b.get("seconds") or 8))
            ok = len(films) >= 2
        elif k == "trace":
            steps = []
            for x in b.get("steps") or []:
                if isinstance(x, dict) and x.get("text"):
                    d = str(x.get("dir") or "none").lower()
                    steps.append({"text": D.fit(x["text"], 48), "value": D.fit(x.get("value"), 16) if x.get("value") else "",
                                  "dir": d if d in ("up", "down") else "none"})
            nb.update(prompt=_s(b.get("prompt"), "prompt"), steps=steps[:6], result=_s(b.get("result"), "result"),
                      resultAccent=_s(b.get("resultAccent"), "accent"))
            ok = bool(nb["prompt"]) and len(nb["steps"]) >= 2
        elif k == "cta":
            nb.update(headline=_s(b.get("headline"), "headline"), accent=_s(b.get("accent"), "accent"),
                      cta=_s(b.get("cta"), "cta"), url=_s(b.get("url"), "url"))
            ok = bool(nb["headline"] or nb["cta"])
        elif k == "logo":
            nb["tagline"] = _s(b.get("tagline"), "tagline")
            ok = True
        else:
            fixes.append(f"beat {i}: unknown kind '{k}' — removed")
            continue
        if not ok:
            if k != "quote":
                fixes.append(f"beat {i} ({k}): missing required words — removed")
            continue
        if k not in DEMO_KINDS and k not in ("stat", "quote"):
            # Only words the viewer reads; ensure_ascii=False so "–"/"é" aren't escaped into digits ("\u2013" → "2013").
            text = json.dumps({kk: vv for kk, vv in nb.items() if kk not in ("kind", "screenshot", "url", "src", "start", "seconds", "focuses", "films")},
                              ensure_ascii=False)
            if D.invented_numbers(text, src + demo):
                fixes.append(f"beat {i} ({k}): contains a number that isn't on the site — removed")
                continue
        if k in DEMO_KINDS:
            demo += " " + json.dumps(nb, ensure_ascii=False)
        if b.get("variant") in VARIANTS.get(k, []):
            nb["variant"] = b["variant"]
        if isinstance(b.get("vo"), str) and b["vo"].strip():
            nb["vo"] = b["vo"].strip()[:240]           # narration for this beat (spoken, not shown)
        if isinstance(b.get("vo_seconds"), (int, float)):
            nb["vo_seconds"] = float(b["vo_seconds"])  # set by the producer after TTS
        beats.append(nb)
    out = {
        "title": _s(doc_in.get("title"), "title") or "Custom video",
        "mood": doc_in.get("mood") if doc_in.get("mood") in MOODS else "normal",
        "style": doc_in.get("style") if doc_in.get("style") in STYLES else None,
        "seconds": max(8.0, min(90.0, float(doc_in.get("seconds") or 25))) if str(doc_in.get("seconds") or "25").replace(".", "", 1).isdigit() else 25.0,
        "beats": beats[:MAX_BEATS],
    }
    return out, fixes


# ---------------------------------------------------------------- seed

def seed_beats(site: Optional[dict]) -> dict:
    """hook → product → cta, all from the site's own copy. Valid on its own. No list: filler lists read as an ad."""
    lines = D.site_lines(site)
    b = (site or {}).get("brand") or {}
    host = D.host_of(b.get("url"))
    hook = D.fit(lines[0], 48) if lines else f"Meet {b.get('name') or 'the product'}."
    end = next((D.fit(x, 44) for x in lines[4:] if D._CTA_WORDS.search(x)), None) or "Try it today."
    beats = [{"kind": "hook", "title": hook, "accent": D.accent_for(hook, 24)},
             {"kind": "product", "caption": D.fit(lines[1], 44) if len(lines) > 1 else ""}]
    beats.append({"kind": "cta", "headline": end, "cta": D.site_cta(site) or "Get started", "url": host})
    return {"title": b.get("name") or "Video", "mood": "normal", "seconds": 20, "beats": beats}


# ---------------------------------------------------------------- compile

def pick_style(bd: dict, site: Optional[dict]) -> str:
    if bd.get("style") in STYLES:
        return bd["style"]
    kinds = {b["kind"] for b in bd["beats"]}
    dark = (((site or {}).get("brand") or {}).get("mode") or "").lower() == "dark"
    if bd["mood"] == "energetic":
        return "kinetic-bold"
    # The founder-launch film look (flat brand ground, streamed type, long product shots) is the default;
    # the older presets stay available by name or through a look.
    return "story-film"


def _ensure_shape(bd: dict, site: Optional[dict], dedup: bool = True) -> dict:
    """Hook first, CTA last, at least one product beat, no identical kinds back to back."""
    beats, sb = list(bd["beats"]), seed_beats(site)["beats"]
    if not beats or beats[0]["kind"] not in OPENERS:
        beats.insert(0, sb[0])
    if beats[-1]["kind"] not in CLOSERS:
        beats.append(sb[-1])
    if dedup and not any(b["kind"] in ("product", "film") for b in beats) and ((site or {}).get("brand") or {}).get("screenshots"):
        beats.insert(min(2, len(beats) - 1), {"kind": "product", "caption": ""})
    if not dedup:  # a written script (narrated videos): the author's order is deliberate
        return {**bd, "beats": beats}
    kept = [beats[0]]
    for b in beats[1:]:
        if b["kind"] == kept[-1]["kind"] and b["kind"] not in ("product", "film", "reel"):
            continue  # same beat twice in a row reads as a stutter
        kept.append(b)
    return {**bd, "beats": kept}


def _screens(site: Optional[dict]) -> List[str]:
    shots = (((site or {}).get("brand") or {}).get("screenshots") or [])
    return [s for s in shots if "full" not in Path(s).name] or shots


_VAL = re.compile(r"\s*(?:(up|down|rose|fell|dropped|grew|increased|decreased|[▲▼↑↓+−-])\s*)?"
                  r"((?:[$€£]\s?)?[\d][\d,.]*\s?(?:%|x|×|k|K|m|M)?)\.?\s*$")


def _to_step(text: str) -> dict:
    """'Amazon fees up 27%' → {text: 'Amazon fees', value: '27%', dir: 'up'} (value/dir only if it ends in a number)."""
    text = text.strip().rstrip(".")
    m = _VAL.search(text)
    if not m or not m.group(2) or m.start() == 0:
        return {"text": D.fit(text, 48), "value": "", "dir": "none"}
    word = (m.group(1) or "").lower()
    d = "up" if word in ("up", "rose", "grew", "increased", "▲", "↑", "+") else "down" if word in ("down", "fell", "dropped", "decreased", "▼", "↓", "−", "-") else "none"
    return {"text": D.fit(text[:m.start()].strip(" :—-"), 48), "value": m.group(2).strip(), "dir": d}


def chat_to_trace(b: dict) -> Optional[dict]:
    user = next((m["text"] for m in b.get("messages") or [] if m["from"] == "user"), "")
    agent = [m["text"] for m in b.get("messages") or [] if m["from"] == "agent"]
    # "Checking Shopify, Amazon and Meta…" is status, not a finding.
    status = agent.pop(0) if agent and re.search(r"(…|\.\.\.)\s*$|^(on it|checking|looking|reading|investigating)", agent[0], re.I) else None
    steps = []
    for a in agent:  # one bubble may hold two findings: "Revenue down 3%. Fees up 27%."
        steps += [_to_step(p) for p in re.split(r"(?<=[\d%a-z])\.\s+", a) if p.strip()]
    steps += [_to_step(r) for r in b.get("results") or []]
    # Only an investigation (findings with values) becomes a trace; a plain back-and-forth stays a chat.
    if not user or len(steps) < 2 or sum(1 for s in steps if s["value"]) < 2:
        return None
    return {"kind": "trace", "prompt": user.lower() if user[:1].isupper() and user[1:2].islower() else user,
            "steps": steps[:6], **({"status": D.fit(status.rstrip(". …"), 32)} if status else {})}


def _logo(app: Optional[str], ctx: dict) -> Optional[dict]:
    """Real logo for a tool name, copied into the project (None when there's no project or no real logo)."""
    if not app or not ctx.get("assets"):
        return None
    from . import app_logos
    try:
        # Full-color marks always sit on a white app tile, so always take the light-background variant.
        hit = app_logos.resolve(app, ctx["assets"], dark=False)
    except Exception:
        return None
    return {k: v for k, v in (hit or {}).items() if k in ("src", "mode", "color")} or None


def pick_variant(kind: str, b: dict, i: int, ctx: dict) -> str:
    """The beat's own choice, else a rotation through the brand look's preferred shots (then the rest):
    each new video for a brand (`nth`, counted in brand.json) moves one step, so consecutive videos never
    share a shot; brand + position offset where the rotation starts, so brands start in different places."""
    import hashlib
    options = VARIANTS[kind]
    if b.get("variant") in options:
        return b["variant"]
    prefs = [v for v in ((ctx.get("look") or {}).get("variants") or {}).get(kind, []) if v in options]
    pool = (prefs + [o for o in options if o not in prefs])[: max(3, len(prefs))]
    offset = int(hashlib.sha1(f"{ctx.get('name')}|{kind}|{i}".encode()).hexdigest()[:8], 16)
    return pool[(offset + int(ctx.get("nth") or 0)) % len(pool)]


def _mentioned_app(text: str) -> Optional[str]:
    """'Amazon FBA fees raised' → 'Amazon' (only tools on the common list, longest name first)."""
    from . import app_logos
    for name in sorted(app_logos.COMMON, key=len, reverse=True):
        if re.search(rf"(?<![\w-]){re.escape(name)}(?![\w-])", text, re.I):
            return name
    return None


def _scene(b: dict, i: int, ctx: dict) -> dict:
    if b["kind"] == "chat" and ctx.get("style") == "story-film":
        b = chat_to_trace(b) or b
    k = b["kind"]
    host, portrait = ctx["host"], ctx["portrait"]
    if k == "hook":
        p = {"title": b["title"], "accent": b["accent"] if b.get("accent") and b["accent"] in b["title"] else D.accent_for(b["title"], 24)}
        if b.get("eyebrow"):
            p["eyebrow"] = b["eyebrow"]
        return {"type": "kinetic_title", "props": p}
    if k == "words":
        p = {"words": b["words"]}
        if b.get("final"):
            p.update(final=b["final"], accent=b["accent"] if b.get("accent") and b["accent"] in b["final"] else D.accent_for(b["final"], 20))
        return {"type": "word_flash", "props": p}
    if k == "statement":
        last = b["lines"][-1]
        return {"type": "statement", "props": {"lines": b["lines"], "accent": b["accent"] if b.get("accent") and b["accent"] in last else D.accent_for(last, 24)}}
    if k == "problem":
        notes = []
        for x in b["items"]:
            n = {"app": x.get("app") or "App", "title": x["title"], "icon": icon_for(f"{x.get('app')} {x['title']}")}
            logo = _logo(x.get("app"), ctx)
            if logo:
                n["logo"] = logo
            notes.append(n)
        return {"type": "notification_stack", "props": {"notifications": notes, "caption": b.get("lines") or [],
                                                        "variant": pick_variant("problem", b, i, ctx)}}
    if k == "product":
        if ctx.get("clip") and not ctx.get("clip_used"):
            ctx["clip_used"] = True
            c = ctx["clip"]
            return {"type": "clip_showcase", "duration_fixed": c["duration"],
                    "props": {"src": c["src"], "focuses": c.get("focuses", []), "url": host, "frame": "browser", "zoom": 1.5}}
        screens = ctx["screens"]
        shot = b.get("screenshot") or (screens[ctx["shot_i"] % len(screens)] if screens else None)
        ctx["shot_i"] += 1
        if not shot:
            return {"type": "ui_click", "props": {"heading": b.get("caption") or f"Open {ctx['name']}", "button": ctx["cta"], "url": host}}
        if portrait:
            return {"type": "phone_showcase", "props": {"screenshot": shot, "caption": [b["caption"]] if b.get("caption") else []}}
        p = {"screenshot": shot, "url": host, "zoom": {"x": 0.5, "y": 0.38, "scale": 1.35, "at": 1.2}}
        if b.get("caption"):
            p.update(title=b["caption"], accent=b["accent"] if b.get("accent") and b["accent"] in b["caption"] else D.accent_for(b["caption"], 20))
        return {"type": "site_showcase", "props": p}
    if k == "click":
        p = {"heading": b["heading"], "button": b["button"], "url": host}
        if b.get("result"):
            p["result"] = b["result"]
        return {"type": "ui_click", "props": p}
    if k == "list":
        p = {"items": b["items"], "marker": "check"}
        if b.get("title"):
            p["title"] = b["title"]
        return {"type": "list_reveal", "props": p}
    if k == "features":
        feats = [{"icon": icon_for(f"{x['title']} {x.get('desc', '')}"), "title": x["title"], **({"desc": x["desc"]} if x.get("desc") else {})} for x in b["items"]]
        return {"type": "feature_grid", "props": {"features": feats, **({"title": b["title"]} if b.get("title") else {})}}
    if k == "steps":
        nodes = [{"label": x, "icon": icon_for(x)} for x in b["items"]]
        return {"type": "flow_diagram", "props": {"nodes": nodes, "highlight": len(nodes) // 2, **({"caption": b["caption"]} if b.get("caption") else {})}}
    if k == "compare":
        return {"type": "split_compare", "props": {"left": {"title": b["beforeTitle"], "items": b["before"]},
                                                   "right": {"title": b["afterTitle"], "items": b["after"]}}}
    if k == "stat":
        return {"type": "stat_counter", "props": {"stats": b["stats"]}}
    if k == "quote":
        return {"type": "quote", "props": {"quote": b["quote"], "author": b.get("author") or ctx["name"], **({"role": b["role"]} if b.get("role") else {})}}
    if k == "film":
        # A finished film (e.g. one Clep made) playing inside this one, in a window frame.
        if ctx.get("assets") and not (Path(ctx["assets"]) / b["src"]).exists():
            return {"type": "ui_click", "props": {"heading": b.get("caption") or ctx["name"], "button": ctx["cta"], "url": host}}
        if b.get("focuses"):  # the product in use: camera follows the clicks and typing
            return {"type": "clip_showcase", "duration_fixed": b.get("seconds") or 6,
                    "props": {"src": b["src"], "startFrom": b.get("start") or 0, "focuses": b["focuses"], "frame": "browser",
                              "url": b.get("url") or host, "zoom": 1.7, "width": 0.86, "tilt": i == 0 or False}}
        return {"type": "video_showcase", "duration_fixed": b.get("seconds") or 6,
                "props": {"src": b["src"], "startFrom": b.get("start") or 0, "frame": "window"}}
    if k == "reel":
        p = {"films": [{kk: vv for kk, vv in f.items() if vv not in ("", None)} for f in b["films"]]}
        if b.get("caption"):
            p["caption"] = b["caption"]
            if b.get("accent") and b["accent"] in b["caption"]:
                p["accent"] = b["accent"]
        return {"type": "film_reel", "duration_fixed": b.get("seconds") or 8, "props": p}
    if k == "trace":
        p = {"prompt": b["prompt"], "steps": [{kk: vv for kk, vv in s.items() if vv} for s in b["steps"]]}
        for s in p["steps"]:
            logo = _logo(_mentioned_app(s["text"]), ctx)
            if logo:
                s["logo"] = logo
        for kk in ("result", "resultAccent", "status"):
            if b.get(kk):
                p[kk] = b[kk]
        if p.get("resultAccent") and p.get("result") and p["resultAccent"] not in p["result"]:
            p.pop("resultAccent")
        p["variant"] = pick_variant("trace", b, i, ctx)
        return {"type": "agent_trace", "props": p}
    if k == "chat":
        return {"type": "chat_demo", "props": {"messages": b["messages"], **({"results": b["results"]} if b.get("results") else {})}}
    if k == "search":
        return {"type": "search_results", "props": {"query": b["query"], **({"status": b["status"]} if b.get("status") else {}),
                                                    **({"results": b["results"]} if b.get("results") else {})}}
    if k == "table":
        return {"type": "table_fill", "props": {"columns": b["columns"], "rows": b["rows"], **({"title": b["title"]} if b.get("title") else {})}}
    if k == "terminal":
        return {"type": "terminal_type", "props": {"lines": b["lines"]}}
    if k == "code":
        return {"type": "code_zoom", "props": {"lines": b["lines"], "highlight": b["highlight"]}}
    if k == "cta":
        head = b.get("headline") or ctx["end"]
        return {"type": "end_card", "props": {"headline": head, "accent": b["accent"] if b.get("accent") and b["accent"] in head else D.accent_for(head, 20),
                                              "cta": b.get("cta") or ctx["cta"], "url": b.get("url") or host}}
    return {"type": "logo_reveal", "props": {"tagline": b["tagline"]} if b.get("tagline") else {}}


MIN_SQUEEZE = 0.8  # a scene can run as short as 80% of its natural minimum


def _words(props) -> int:
    """Words the viewer actually reads — string values only, not keys, paths or numbers."""
    if isinstance(props, str):
        return 0 if re.search(r"[/\\.](png|jpg|jpeg|webp|mp4)$", props) else len(re.findall(r"[A-Za-z']+", props))
    if isinstance(props, dict):
        return sum(_words(v) for k, v in props.items() if k not in ("icon", "screenshot", "src", "url", "from"))
    if isinstance(props, list):
        return sum(_words(v) for v in props)
    return 0


def _bounds(sc: dict, reg: Dict[str, dict]) -> Tuple[float, float]:
    if "duration_fixed" in sc:
        return sc["duration_fixed"], sc["duration_fixed"]
    lo, hi = reg[sc["type"]]["duration"]
    return lo * MIN_SQUEEZE, hi * (HOLD_STRETCH if sc["type"] in HOLD_TYPES else MAX_STRETCH)


def _timing(scenes: List[dict], reg: Dict[str, dict], target: Optional[float]) -> None:
    """Natural reading-time lengths, then scaled so the whole video lands on `target`
    (which already includes transition overlap), each scene kept inside its bounds.
    Water-filling: scenes that hit a bound are frozen and the rest absorb the difference."""
    natural = []
    for sc in scenes:
        if "duration_fixed" in sc:
            natural.append(sc["duration_fixed"])
            continue
        lo, hi = reg[sc["type"]]["duration"]
        natural.append(min(hi, lo + 0.18 * _words(sc["props"])))
    bounds = [_bounds(sc, reg) for sc in scenes]
    dur = list(natural)
    if target is None:  # natural lengths as-is (narrated videos: the voice sets the length)
        for sc, d in zip(scenes, dur):
            sc.pop("duration_fixed", None)
            sc["duration"] = round(d, 2)
        return
    free = [i for i, sc in enumerate(scenes) if "duration_fixed" not in sc]
    for _ in range(8):
        gap = target - sum(dur)
        if abs(gap) < 0.05 or not free:
            break
        weight = sum(natural[i] for i in free) or 1.0
        still = []
        for i in free:
            lo, hi = bounds[i]
            d = min(hi, max(lo, dur[i] + gap * natural[i] / weight))
            dur[i] = d
            if lo < d < hi:
                still.append(i)
        free = still
    for sc, d in zip(scenes, dur):
        sc.pop("duration_fixed", None)
        sc["duration"] = round(d, 2)


def compile_spec(bd: dict, site: dict, fmt: Dict[str, int], clip: Optional[dict] = None,
                 reg: Optional[dict] = None, assets: Optional[Path] = None) -> dict:
    """Sanitized beat doc → VideoSpec (brand included). Deterministic: same beats, same video."""
    reg = reg or engine.registry()
    by_type = {s["type"]: s for s in reg["scenes"]}
    bd = _ensure_shape(bd, site, dedup=not any(b.get("vo_seconds") for b in bd["beats"]))
    style = pick_style(bd, site)
    st = reg["styles"].get(style, {})
    brand = copy.deepcopy(site["brand"])
    host = D.host_of(brand.get("url"))
    ctx = {"host": host, "portrait": fmt["height"] > fmt["width"], "screens": _screens(site), "shot_i": 0, "clip": clip, "style": style,
           "assets": assets, "dark": brand.get("mode") == "dark", "look": site.get("look") or {}, "title": bd.get("title"),
           "nth": site.get("videosMade", 0),
           "name": brand.get("name") or host, "cta": D.site_cta(site) or "Get started",
           "end": next((D.fit(x, 44) for x in D.site_lines(site) if D._CTA_WORDS.search(x)), "Try it today.")}
    scenes = [_scene(b, i, ctx) for i, b in enumerate(bd["beats"])]
    if style == "story-film" and scenes and scenes[0]["type"] == "kinetic_title":
        scenes[0]["props"]["anim"] = "pullout"  # the opener's first word fills the frame, then settles (T:0)
    default_tr = (st.get("transition") or {"type": "blur", "duration": 0.45})
    # Transitions overlap neighbouring scenes, so scenes must add up to target + total overlap.
    overlap = max(float(default_tr.get("duration") or 0), 0.5 if default_tr.get("type") != "cut" else 0) * (len(scenes) - 1)
    _timing(scenes, by_type, None if any(b.get("vo_seconds") for b in bd["beats"]) else bd["seconds"] + overlap)

    energetic, dark_style = bd["mood"] == "energetic", style in ("dark-keynote", "neon-tech")
    contrast_done = False
    for i, (sc, b) in enumerate(zip(scenes, bd["beats"])):
        sc["id"] = f"{i:02d}-{b['kind']}"
        own = by_type[sc["type"]].get("ownCamera")
        cat = by_type[sc["type"]]["category"]
        if not own and sc["type"] not in ("end_card", "logo_reveal"):
            if i == 0:
                sc["camera"] = {"move": "punch_in"} if energetic else {"move": "push_in"}
            elif cat == "typography":
                sc["camera"] = {"move": "drift"}
            elif cat in ("data", "product", "story"):
                sc["camera"] = {"move": "push_in"}
        if not contrast_done and not dark_style and 0 < i < len(scenes) - 1 and b["kind"] in ("statement", "problem", "stat"):
            sc["tone"] = "inverse"
            contrast_done = True
        sc["notes"] = f"beat: {b['kind']}"
        if b.get("vo_seconds"):
            sc["_vo"] = b["vo_seconds"]
    from . import edit
    edit.assign(scenes, edit.family_for(style, reg), max_loud=1)
    return {"version": 1, "title": bd.get("title") or brand.get("name") or "Video", "style": style,
            "format": {**fmt, "fps": 30}, "scenes": scenes, "brand": brand}


_ERR_IDX = re.compile(r"scenes\[(\d+)\]")


def validate_and_fix(spec: dict, tmp: Path, rounds: int = 3) -> Tuple[dict, List[str]]:
    """Engine validation; any scene it rejects is dropped (never the first/last) — no model round-trip."""
    fixes = []
    for _ in range(rounds + 1):
        ok, res = engine.validate(spec, tmp)
        if ok:
            return res["spec"], fixes
        bad = sorted({int(m) for e in res["errors"] for m in _ERR_IDX.findall(e)}, reverse=True)
        bad = [i for i in bad if 0 < i < len(spec["scenes"]) - 1] or [i for i in bad if len(spec["scenes"]) > 2]
        if not bad:
            break
        for i in bad:
            fixes.append(f"dropped scene {i} ({spec['scenes'][i]['type']}): " + next((e for e in res["errors"] if f"scenes[{i}]" in e), ""))
            spec["scenes"].pop(i)
        if spec["scenes"]:
            spec["scenes"][-1].pop("transition", None)
    raise RuntimeError("custom video still invalid:\n" + "\n".join(res.get("errors", [])[:20]))


# Scene length a beat of this kind naturally takes, in seconds (reading time + animation).
_BEAT_SCENE = {"reel": "film_reel", "film": "video_showcase", "trace": "agent_trace", "hook": "kinetic_title", "words": "word_flash", "statement": "statement", "problem": "notification_stack",
               "product": "site_showcase", "click": "ui_click", "list": "list_reveal", "features": "feature_grid",
               "steps": "flow_diagram", "compare": "split_compare", "stat": "stat_counter", "quote": "quote",
               "chat": "chat_demo", "search": "search_results", "table": "table_fill", "terminal": "terminal_type",
               "code": "code_zoom", "cta": "end_card", "logo": "logo_reveal"}


def _beat_seconds(kind: str, style: str, reg: dict) -> float:
    by_type = {s["type"]: s["duration"] for s in reg["scenes"]}
    scene = _BEAT_SCENE.get(kind, "statement")
    lo, hi = by_type.get(scene, (2.5, 4))
    if scene in HOLD_TYPES:
        return hi * HOLD_STRETCH * 0.85  # demo shots hold; see HOLD_STRETCH
    s_lo, s_hi = reg["styles"].get(style, {}).get("sceneSeconds", (2.2, 4.5))
    return max(lo * 0.9, min(hi, (s_lo + s_hi) / 2))


def planned_beats(seconds: float, style: str, reg: Optional[dict] = None) -> int:
    """How many beats a video of this length and pace needs (anime 30s ≈ 12, calm keynote 30s ≈ 7)."""
    reg = reg or engine.registry()
    s_lo, s_hi = reg["styles"].get(style, {}).get("sceneSeconds", (2.2, 4.5))
    per = max(2.2, (s_lo + s_hi) / 2 + 0.6)  # + transition overlap and product shots running long
    return max(4, min(MAX_BEATS, round(seconds / per)))


def pad_beats(bd: dict, site: Optional[dict], style: str, reg: Optional[dict] = None) -> Tuple[dict, int]:
    """Add real beats from the site (other screenshots, its own lines, steps, features) until the
    beat sheet naturally fills bd['seconds']. Never repeats text already used. Returns (bd, added)."""
    reg = reg or engine.registry()
    beats = list(bd["beats"])
    used_text = D._norm(json.dumps(beats))
    used_words = set(used_text.split())

    def fresh(ln: str) -> bool:
        # Near-duplicates count too: "has enough dashboards" ≈ "already has enough dashboards".
        w = [x for x in D._norm(ln).split() if len(x) > 2]
        return bool(w) and sum(x in used_words for x in w) / len(w) < 0.6

    lines = [ln for ln in D.site_lines(site) if D._norm(ln) not in used_text and fresh(ln)]
    used_shots = {b.get("screenshot") for b in beats if b.get("screenshot")}
    shots = [s for s in _screens(site) if s not in used_shots]
    h3 = [D.fit(x, 18) for x in ((site or {}).get("copy") or {}).get("h3") or [] if 1 <= len(str(x).split()) <= 3]
    h3 = [x for x in dict.fromkeys(h3) if x and D._norm(x) not in used_text]

    def take(n):
        out = []
        while lines and len(out) < n:
            out.append(lines.pop(0))
        return out

    def next_beat(prev_kind: str):
        # Product and one-line statements keep the story's thread; lists/features would turn it into an ad.
        order = ["product", "statement", "product", "steps", "statement", "product"]
        for k in order[len(beats) % len(order):] + order:
            if k == prev_kind:
                continue
            if k == "product" and shots:
                cap = take(1)
                return {"kind": "product", "screenshot": shots.pop(0), "caption": D.fit(cap[0], 44) if cap else ""}
            if k == "statement" and lines:
                ls = [D.fit(x, 40) for x in take(2)]
                return {"kind": "statement", "lines": ls, "accent": D.accent_for(ls[-1], 24)}
            if k == "list" and len(lines) >= 3:
                return {"kind": "list", "items": [D.fit(x, 28) for x in take(3)]}
            if k == "steps" and len(h3) >= 3:
                items, h3[:] = h3[:4], h3[4:]
                return {"kind": "steps", "items": items}
            if k == "features" and len(h3) >= 2 and lines:
                items, h3[:] = h3[:3], h3[3:]
                return {"kind": "features", "items": [{"title": t, "desc": D.fit(d, 40)} for t, d in zip(items, take(len(items)))]}
        return None

    def est() -> float:
        return sum(_beat_seconds(b["kind"], style, reg) for b in beats) - 0.4 * (len(beats) - 1)

    added = 0
    while est() < bd["seconds"] * 0.92 and len(beats) < MAX_BEATS:
        closer = len(beats) - 1 if beats and beats[-1]["kind"] in CLOSERS else len(beats)
        b = next_beat(beats[closer - 1]["kind"] if closer else "")
        if not b:
            break  # the site has no more real material — shorter beats the padding with filler
        beats.insert(closer, b)
        added += 1
    return {**bd, "beats": beats}, added


VO_LEAD, VO_TAIL = 0.25, 0.55  # breathe in after the cut lands; let the last word ring before the next cut


def voiced_timing(spec: dict) -> None:
    """Stretch each narrated scene so its line starts after the incoming transition and ends before the
    outgoing one. Records the line's start time on the scene as `_voAt` (seconds from video start)."""
    sc = spec["scenes"]
    t = 0.0
    for i, s in enumerate(sc):
        tin = float((sc[i - 1].get("transition") or {}).get("duration") or 0) if i else 0.0
        tout = float((s.get("transition") or {}).get("duration") or 0)
        if s.get("_vo"):
            need = tin + VO_LEAD + s["_vo"] + VO_TAIL + tout
            s["duration"] = round(max(float(s["duration"]), need), 2)
            s["_voAt"] = round(t + tin + VO_LEAD, 3)
        t += float(s["duration"]) - tout


def voice_marks(spec: dict) -> List[float]:
    """Pop the producer's timing marks off the scenes (the engine doesn't know them) → start time per voiced scene."""
    out = []
    for s in spec["scenes"]:
        s.pop("_vo", None)
        at = s.pop("_voAt", None)
        if at is not None:
            out.append(at)
    return out


def _total(spec: dict) -> float:
    sc = spec["scenes"]
    return sum(float(x["duration"]) for x in sc) - sum(float((x.get("transition") or {}).get("duration") or 0) for x in sc[:-1])


def retime(spec: dict, target: float, reg: Optional[dict] = None) -> float:
    """Final timing pass on the finished spec (real transitions, after the look): lands on `target`."""
    reg = reg or engine.registry()
    by_type = {x["type"]: x for x in reg["scenes"]}
    sc = spec["scenes"]
    for x in sc:
        if x["type"] in ("clip_showcase", "video_showcase"):
            x["duration_fixed"] = float(x["duration"])
    overlap = sum(float((x.get("transition") or {}).get("duration") or 0) for x in sc[:-1])
    _timing(sc, by_type, target + overlap)
    return _total(spec)


def _min_total(spec: dict, reg: dict) -> float:
    by_type = {x["type"]: x for x in reg["scenes"]}
    sc = spec["scenes"]
    lo = sum(float(x["duration"]) if x["type"] in ("clip_showcase", "video_showcase") else by_type[x["type"]]["duration"][0] * MIN_SQUEEZE for x in sc)
    return lo - sum(float((x.get("transition") or {}).get("duration") or 0) for x in sc[:-1])


def build(values: dict, site: dict, controls: dict, tmp: Path, clip: Optional[dict] = None,
          assets: Optional[Path] = None) -> Tuple[dict, List[str]]:
    """Draft values for template 'custom' → validated VideoSpec + list of automatic fixes.

    Length comes from the number of beats, not from stretching them: plan → pad from the site if
    short → assemble (controls + look) → trim only if even the shortest timing is too long →
    exact timing on the real transitions → validate."""
    if (controls or {}).get("seconds"):
        values = {**values, "seconds": controls["seconds"]}
    bd, fixes = sanitize(values, site)
    reg = engine.registry()
    recipe = (controls or {}).get("lookRecipe") or {}
    # No look asked for → the brand's own look (art-directed from its site), unless a style was named.
    if not recipe and (site or {}).get("look") and not (controls or {}).get("style") and not values.get("style"):
        recipe = site["look"]
        controls = {**(controls or {}), "look": recipe["name"], "lookRecipe": recipe}
    style = recipe.get("base") or pick_style(_ensure_shape(bd, site), site)
    voiced = any(b.get("vo_seconds") for b in bd["beats"])
    bd, added = (_ensure_shape(bd, site, dedup=False), 0) if voiced else pad_beats(_ensure_shape(bd, site), site, style, reg)
    if added:
        fixes.append(f"added {added} beat(s) from your site to fill {bd['seconds']:.0f}s without dragging scenes")
    ctl = {"fontPairing": "brand", "pace": "normal", "camera": "normal", "format": "16:9", **(controls or {})}
    w, h = T.CONTROLS["formats"].get(ctl["format"], [1920, 1080])

    def assemble(b: dict) -> dict:
        sp = compile_spec(b, site, {"width": w, "height": h}, clip=clip, reg=reg, assets=assets)
        br = sp.pop("brand")
        T.apply_controls(sp, br, ctl, set(controls or {}))
        T.apply_look(sp, br, ctl, set(controls or {}))
        sp["brand"] = br
        return sp

    spec = assemble(bd)
    if voiced:  # length comes from the narration: every voiced scene holds its line, nothing is padded or trimmed
        voiced_timing(spec)
        marks = voice_marks(spec)  # before validation: the engine schema strips unknown scene fields
        n = len(spec["scenes"])
        spec, more = validate_and_fix(spec, Path(tmp).resolve())
        if len(spec["scenes"]) != n:
            more.append("a scene was dropped in validation — narration timing may be off; check the render")
        if assets:
            from . import sfx
            sfx.apply(spec, assets)
        return {"template": D.CUSTOM, "controls": ctl, "voiceMarks": marks, **spec}, fixes + more
    padded = {id(x) for x in bd["beats"][-1 - added:-1]} if added else set()
    trimmed = 0
    while _min_total(spec, reg) > bd["seconds"] * 1.03 and len(bd["beats"]) > 4:
        middle = list(range(1, len(bd["beats"]) - 1))
        products = [i for i in middle if bd["beats"][i]["kind"] == "product"]
        droppable = [i for i in middle if not (bd["beats"][i]["kind"] == "product" and len(products) == 1)]
        if not droppable:
            break
        pick = next((i for i in reversed(droppable) if id(bd["beats"][i]) in padded), droppable[-1])
        bd = {**bd, "beats": bd["beats"][:pick] + bd["beats"][pick + 1:]}
        trimmed += 1
        spec = assemble(bd)
    if trimmed:
        fixes.append(f"trimmed {trimmed} beat(s) so it fits {bd['seconds']:.0f}s")
    got = retime(spec, bd["seconds"], reg)
    if abs(got - bd["seconds"]) > bd["seconds"] * 0.05:
        fixes.append(f"came out at {got:.0f}s — the closest these beats allow to {bd['seconds']:.0f}s")
    spec, more = validate_and_fix(spec, Path(tmp).resolve())
    if assets:  # UI sound design synced to each scene's motion (after validation, so dropped scenes carry none)
        from . import sfx
        sfx.apply(spec, assets)
    return {"template": D.CUSTOM, "controls": ctl, **spec}, fixes + more
