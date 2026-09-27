"""Code-side director: routing, site-copy seeds, and guards on whatever the model returns.

The model only writes words. Everything a cheap model tends to get wrong — character
limits, accents that aren't in their headline, invented numbers/quotes, bad asset
paths, unknown control values — is fixed here. When the model fails outright, the
seed built from the site's own copy is a complete, valid draft on its own.
"""
from __future__ import annotations

import copy
import json
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from . import templates as T
from .paths import ROOT

SKILLS = ROOT / "skills"

# ---------------------------------------------------------------- skills

def _split_frontmatter(text: str) -> Tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    head, _, body = text[3:].partition("\n---")
    meta = {}
    for line in head.strip().splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    return meta, body.lstrip("\n")


def skill(name: str) -> str:
    """skills/<name>.md, or templates/<name>/skill.md for a template id."""
    p = SKILLS / f"{name}.md"
    if not p.exists():
        p = T.TEMPLATES / name / "skill.md"
    return _split_frontmatter(p.read_text())[1] if p.exists() else ""


def _triggers() -> Dict[str, List[str]]:
    out = {}
    for t in T.list_templates():
        p = T.TEMPLATES / t["id"] / "skill.md"
        meta = _split_frontmatter(p.read_text())[0] if p.exists() else {}
        out[t["id"]] = [w.strip().lower() for w in meta.get("triggers", "").split(",") if w.strip()]
    return out


# ---------------------------------------------------------------- routing

CUSTOM = "custom"
# Strong: always means "not a template". Weak: structure talk — custom only for a brand-new video,
# since on an existing template draft "end with Join the beta" is just a copy edit.
_CUSTOM_RX = re.compile(
    r"\b(custom|from scratch|whole (new|different)|(a |something )?different (video|kind|style of video)|not (a|the|from a) template|"
    r"no template|own structure|story (about|of)|tell (a|the) story|narrative|explainer|scene by scene)\b", re.I)
_STRUCTURE_RX = re.compile(r"\b(start (with|on)|open (with|on)|end (with|on)|beats?|sequence|then show|followed by)\b", re.I)
_SWITCH_RX = re.compile(r"\b(instead|switch|change (it )?to|make it (a|an)|turn it into|use the)\b", re.I)


def route(message: str, draft: Optional[dict] = None) -> str:
    """Pick the template id — or CUSTOM — in code, so the model never has to."""
    m = message.lower()
    tpls = T.list_templates()
    for t in tpls:  # explicit name wins
        if t["id"] in m or t["name"].lower() in m:
            return t["id"]
    if _CUSTOM_RX.search(m) or (not draft and _STRUCTURE_RX.search(m)):
        return CUSTOM
    scores = {tid: sum(1 for w in words if re.search(rf"\b{re.escape(w)}\b", m)) for tid, words in _triggers().items()}
    best = max(scores, key=scores.get) if scores else None
    if draft and draft.get("template"):
        # Editing: stay put unless they clearly ask for a different kind of video.
        if not (_SWITCH_RX.search(m) and best and scores[best] > 0 and best != draft["template"]):
            return draft["template"]
    return best if best and scores[best] > 0 else "feature-film"


# ---------------------------------------------------------------- text helpers

_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍]")
_ARROWS = re.compile(r"[→←↗↘⤓⤴»«➜➔▶►]")
_MD = re.compile(r"(\*\*|__|`|^#+\s*)", re.M)
_DANGLING = {"a", "an", "the", "and", "or", "but", "to", "of", "for", "with", "in", "on", "at", "by", "from",
             "your", "our", "their", "is", "are", "that", "which", "&", "—", "-"}


def clean(s) -> str:
    if s is None:
        return ""
    s = str(s)
    s = _MD.sub("", _ARROWS.sub("", _EMOJI.sub("", s)))
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in s.replace("\\n", "\n").split("\n")]
    s = "\n".join(ln for ln in lines if ln)
    return s.strip().strip('"“”\'').strip()


def fit(s: str, limit: Optional[int]) -> str:
    """Shorten to `limit` chars at a clause or word boundary — never mid-word, never on 'and'."""
    s = clean(s)
    if not limit or len(s) <= limit:
        return s
    for sep in (" — ", " – ", " - ", ": ", "; ", ", ", ". "):
        head = s.split(sep)[0].strip()
        if 2 <= len(head.split()) and len(head) <= limit:
            return head.rstrip(",;:")
    words, out = s.replace("\n", " \n ").split(" "), ""
    for w in words:
        cand = (out + " " + w).strip() if w != "\n" else out + "\n"
        if len(cand.replace("\n", " ").strip()) > limit:
            break
        out = cand
    toks = out.strip().split()
    while toks and toks[-1].lower().strip(",;:") in _DANGLING:
        toks.pop()
    out = " ".join(toks) if "\n" not in out else out.strip()
    while out.split() and out.split()[-1].lower().strip(",;:") in _DANGLING:
        out = out.rsplit(None, 1)[0]
    return out.rstrip(",;:—- ")


def accent_for(text: str, limit: Optional[int] = 24) -> str:
    """Payoff words: the last line if it fits, else the last 3→1 words."""
    text = clean(text)
    if not text:
        return ""
    last = text.split("\n")[-1].strip()
    if "\n" in text and len(last) <= (limit or 99) and len(last.split()) <= 4:
        return last
    words = last.split()
    for n in (3, 2, 1):
        tail = words[-n:]
        while len(tail) > 1 and tail[0].lower() in {"a", "an", "the", "and", "or", "but", "&", "—", "-"}:
            tail = tail[1:]
        cand = " ".join(tail)
        if len(words) > n and len(cand) <= (limit or 99):
            return cand
    return words[-1] if words and len(words[-1]) <= (limit or 99) else ""


_NUM = re.compile(r"\d[\d,.]*")


def _digits(s: str) -> set:
    return {n.replace(",", "").rstrip(".") for n in _NUM.findall(s or "")}


def invented_numbers(s: str, source: str) -> bool:
    return bool(_digits(s) - _digits(source))


_BANNED = re.compile(r"\b(unleash\w*|supercharg\w*|revolutioni[sz]\w*|seamless\w*|cutting[- ]edge|next[- ]level|"
                     r"game[- ]chang\w*|empower\w*|elevat\w*|magic(al)?|click here|learn more)\b", re.I)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", (s or "").lower())).strip()


# ---------------------------------------------------------------- site copy → seed

def host_of(url: Optional[str]) -> str:
    if not url:
        return ""
    return urlparse(url if "//" in url else "https://" + url).netloc.replace("www.", "")


def site_lines(doc: Optional[dict]) -> List[str]:
    """Short, human lines from the site, best first (h1, h2, then paragraphs)."""
    c = (doc or {}).get("copy") or {}
    raw = list(c.get("h1") or []) + list(c.get("h2") or []) + list(c.get("paragraphs") or [])
    raw += re.split(r"(?<=[.!?])\s+", c.get("description") or "")
    out, seen = [], set()
    for ln in raw:
        ln = clean(ln)
        if not (2 <= len(ln.split()) <= 10) or re.search(r"[$/{}<>|✓✗@]|https?:", ln) or _norm(ln) in seen:
            continue
        seen.add(_norm(ln))
        out.append(ln)
    return out


def site_cta(doc: Optional[dict]) -> Optional[str]:
    buttons = [clean(b) for b in ((doc or {}).get("copy") or {}).get("buttons") or []]
    ok = [b for b in buttons if 1 <= len(b.split()) <= 4 and len(b) <= 22 and re.fullmatch(r"[A-Za-z][A-Za-z '’!-]*", b)
          and b.lower() not in {"copy", "copy snippet", "menu", "close", "open", "login", "log in", "sign in"}]
    return Counter(ok).most_common(1)[0][0] if ok else None


_ACCENT_OF = {"hookAccent": "hook", "openingAccent": "opening", "shotAccent": "shotCaption", "endAccent": "endHeadline",
              "flashAccent": "flashFinal", "linesAccent": "lines"}
_CTA_WORDS = re.compile(r"\b(start|try|get|join|free|today|now|sign up|begin)\b", re.I)
_LIST_FROM_SITE = {"benefits", "results", "lines"}


def seed(tid: str, doc: Optional[dict]) -> dict:
    """A complete draft for template `tid` from the site's own copy — no model involved."""
    tpl = T.load(tid)
    vals = {k: copy.deepcopy(s.get("default")) for k, s in tpl["slots"].items() if s["type"] != "clip"}
    if not doc:
        return vals
    b = doc.get("brand") or {}
    name, host = b.get("name") or "", host_of(b.get("url"))
    lines = site_lines(doc)
    used: set = set()

    def take(limit, pred=lambda ln: True):
        for ln in lines:
            if _norm(ln) not in used and pred(ln):
                v = fit(ln, limit)
                if len(v.split()) >= 2:
                    used.add(_norm(ln))
                    return v
        return None

    for k, s in tpl["slots"].items():
        lim, t = s.get("max"), s["type"]
        v = None
        if k in ("url", "ctaUrl"):
            v = host or None
        elif k == "cta":
            v = site_cta(doc)
        elif k == "eyebrow" and name:
            v = f"Introducing {name}" if len(f"Introducing {name}") <= (lim or 28) else "New"
        elif k in ("hook", "flashFinal"):
            v = take(lim)
        elif k == "endHeadline":
            v = take(lim, lambda ln: bool(_CTA_WORDS.search(ln))) or take(lim)
        elif k in ("shotCaption", "tagline"):
            v = take(lim)
        elif k == "date":
            v, vals[k] = None, ""  # never ship the template's placeholder date
        elif k == "announce" and name:
            v = fit(name, lim)
        elif k == "quote":
            v = take(lim, lambda ln: len(ln.split()) >= 5)
            if v:
                vals["quoteAuthor"], vals["quoteRole"] = name or host, ""
        elif t == "textList" and k in _LIST_FROM_SITE:
            n = min(len(s.get("default") or []) or 3, s.get("maxItems") or 3)
            got = [x for x in (take(lim) for _ in range(n)) if x]
            v = got if len(got) >= 2 else None
        elif t == "image":
            shots = b.get("screenshots") or []
            v = shots[0] if shots else None
        if v:
            vals[k] = v
    for acc, target in _ACCENT_OF.items():
        if acc in tpl["slots"] and vals.get(target):
            tgt = vals[target][-1] if isinstance(vals[target], list) else vals[target]
            vals[acc] = accent_for(tgt, tpl["slots"][acc].get("max"))
    return vals


# ---------------------------------------------------------------- guard

# Slots whose content is a depicted demo scenario (numbers there are the demo, not a claim).
_DEMO_SLOTS = {"statValue", "approveTotal", "status", "prompt", "rows", "columns", "messages", "notifications",
               "approveItems", "flashWords", "date", "announce"}


def source_text(doc: Optional[dict], *extra) -> str:
    parts = [json.dumps((doc or {}).get("copy") or {}), json.dumps(((doc or {}).get("brand") or {}).get("name") or "")]
    parts += [e if isinstance(e, str) else json.dumps(e) for e in extra if e]
    return "\n".join(parts)


def valid_assets(doc: Optional[dict], extra: Optional[List[str]] = None) -> set:
    return set(((doc or {}).get("brand") or {}).get("screenshots") or []) | set(extra or [])


def guard(tid: str, values: dict, base: dict, doc: Optional[dict], message: str = "",
          assets: Optional[List[str]] = None) -> Tuple[dict, List[str]]:
    """Coerce model values into what the template can render. Returns (values, fixes)."""
    tpl = T.load(tid)
    src = source_text(doc, message, base)
    ok_assets = valid_assets(doc, assets)
    out, fixes = {}, []
    for k, s in tpl["slots"].items():
        t, lim, b = s["type"], s.get("max"), base.get(k)
        v = values.get(k, b)
        if t == "clip":
            if isinstance(v, dict) and v.get("src"):
                out[k] = v
            continue
        if t == "text":
            v = fit(v, lim) if isinstance(v, (str, int, float)) else ""
            if not v:
                v = b
            elif k not in _DEMO_SLOTS and invented_numbers(v, src):
                fixes.append(f"{k}: dropped a number that isn't on the site"); v = b
            elif k not in _DEMO_SLOTS and _BANNED.search(v) and v != b:
                fixes.append(f"{k}: replaced filler copy with the site's own line"); v = b
            elif k == "quote" and _norm(v) not in _norm(src):
                fixes.append("quote: not found in site copy — using a real line from the site"); v = b
        elif t == "textList":
            items = v if isinstance(v, list) else [v] if isinstance(v, str) else []
            seen, clean_items = set(), []
            for it in items:
                it = fit(it, lim) if isinstance(it, (str, int, float)) else ""
                if it and _norm(it) not in seen and (k in _DEMO_SLOTS or not (invented_numbers(it, src) or _BANNED.search(it))):
                    seen.add(_norm(it)); clean_items.append(it)
            for it in b or []:  # a list that shrank below 2 is topped up from the seed
                if len(clean_items) >= min(2, len(b)):
                    break
                if _norm(it) not in seen:
                    seen.add(_norm(it)); clean_items.append(it)
            v = clean_items[: s.get("maxItems") or len(clean_items)] or b
        elif t == "items":
            fields = s.get("fields") or []
            rows = []
            for it in v if isinstance(v, list) else []:
                if isinstance(it, dict) and it.get(fields[0] if fields else ""):
                    rows.append({f: fit(it[f], 40) for f in fields if it.get(f) not in (None, "")})
            v = rows[: s.get("maxItems") or len(rows)] or b
        elif t == "table":
            ncol = len(values.get("columns") or base.get("columns") or []) or None
            rows = []
            for r in v if isinstance(v, list) else []:
                if isinstance(r, list):
                    r = [fit(c, 24) for c in r][:ncol] if ncol else [fit(c, 24) for c in r]
                    rows.append(r + [""] * ((ncol or len(r)) - len(r)))
            v = rows[: s.get("maxItems") or len(rows)] or b
        elif t == "image":
            if not (isinstance(v, str) and v in ok_assets):
                if v:
                    fixes.append(f"{k}: '{v}' isn't one of the project's images")
                v = b
        if v not in (None, "", []):
            out[k] = v
    if out.get("quote") and out["quote"] == base.get("quote"):
        for f in ("quoteAuthor", "quoteRole"):
            if f in base:
                out[f] = base[f]
    for acc, target in _ACCENT_OF.items():
        if acc in tpl["slots"] and out.get(target):
            tgt = out[target][-1] if isinstance(out[target], list) else out[target]
            if not out.get(acc) or out[acc] not in tgt:
                out[acc] = accent_for(tgt, tpl["slots"][acc].get("max"))
    return out, fixes


# ---------------------------------------------------------------- controls

_FORMATS = [(r"\b(9:16|vertical|portrait|tiktok|reels?|shorts|stories|story format)\b", "9:16"),
            (r"\b(1:1|square)\b", "1:1"), (r"\b(4:5|instagram post|feed post)\b", "4:5"),
            (r"\b(16:9|landscape|widescreen|youtube|horizontal)\b", "16:9")]
_PACE = [(r"\b(calm(er)?|slow(er)?|relax(ed)?|gentle|chill)\b", "calm"),
         (r"\b(snappy|snappier|punch(y|ier)|fast(er)?|energ(y|etic)|hype|quick(er)?)\b", "snappy")]
_CAMERA = [(r"\b(no (camera|zoom|movement)|static|still camera)\b", "still"),
           (r"\b(more (camera|zoom|movement)|dynamic|cinematic)\b", "dynamic")]
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_SECS = re.compile(r"\b(\d{1,3})\s*-?\s*(?:s|sec|secs|second|seconds)\b", re.I)
_MINS = re.compile(r"\b(\d(?:\.\d)?)\s*-?\s*(?:min|mins|minute|minutes)\b", re.I)
_QUOTED = re.compile(r"[\"“”]([^\"“”]{2,60})[\"“”]|(?<!\w)'([^']{2,60})'(?!\w)")


def requested_seconds(message: str):
    m = _MINS.search(message)
    if m:
        return max(5.0, min(90.0, float(m.group(1)) * 60))
    m = _SECS.search(message)
    return max(5.0, min(90.0, float(m.group(1)))) if m else None


def requirements(message: str) -> dict:
    """Every explicit ask code can verify: the reply must honour each one or say it couldn't."""
    return {
        "seconds": requested_seconds(message),
        "quotes": [a or b for a, b in _QUOTED.findall(message)],
    }


def controls(message: str, proposed: Optional[dict], current: Optional[dict]) -> dict:
    """Merge: current draft → model's proposal (validated) → what the message literally says (wins)."""
    C = T.CONTROLS
    allowed = {"fontPairing": C["fontPairings"], "backdrop": C["backdrops"], "pace": C["pace"], "textAnim": C["textAnims"],
               "transition": C["transitions"], "camera": C["camera"], "format": C["formats"]}
    out = dict(current or {})
    if isinstance((proposed or {}).get("seconds"), (int, float)):
        out["seconds"] = max(5.0, min(90.0, float(proposed["seconds"])))
    for k in ("look", "lookRecipe"):  # set by looks.resolve in chat, or the dashboard's Look picker
        if k in (proposed or {}):
            out[k] = proposed[k]
    if out.get("look") is None:
        out.pop("look", None)
        out.pop("lookRecipe", None)
    for k, v in (proposed or {}).items():
        if k == "colors" and isinstance(v, dict):
            cols = {ck: cv for ck, cv in v.items() if ck in ("background", "foreground", "primary", "accent")
                    and isinstance(cv, str) and _HEX.match(cv)}
            if cols:
                out["colors"] = {**out.get("colors", {}), **cols}
        elif k in allowed and v in allowed[k]:
            out[k] = v
    secs = requested_seconds(message)
    if secs:
        out["seconds"] = secs
    m = message.lower()
    for key, table in (("format", _FORMATS), ("pace", _PACE), ("camera", _CAMERA)):
        for rx, val in table:
            if re.search(rx, m):
                out[key] = val
                break
    return out
