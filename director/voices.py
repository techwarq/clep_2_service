"""Narration voices a film can use (ElevenLabs premade voices via fal), and picking one from chat.

    catalog()                 every voice with a description, tags and a preview URL
    suggest(brand, mood, n)   the voices that fit a brand / mood best, best first
    from_message(text)        a voice the user named or described ("use Lily", "a British woman") or None

Previews are one short read per voice, generated once (`motion.py voices --publish`) and served from
templates/voices/<id>.mp3 locally or motion/voices/<id>.mp3 in R2.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional

from .paths import ROOT

DEFAULT = "Brian"
PREVIEW_TEXT = "Every product has a moment where it has to show itself. This is yours."
PREVIEWS = ROOT / "templates" / "voices"

# id is the fal/ElevenLabs voice name. tags drive suggestions and chat matching.
VOICES = [
    {"id": "Brian", "label": "Brian", "gender": "male", "accent": "American", "age": "middle-aged",
     "description": "Deep, calm narrator. Launch films and trailers.", "tags": ["narration", "calm", "deep", "cinematic", "trustworthy"]},
    {"id": "Eric", "label": "Eric", "gender": "male", "accent": "American", "age": "middle-aged",
     "description": "Smooth and friendly. Story-led product films.", "tags": ["friendly", "smooth", "story", "calm", "warm"]},
    {"id": "Chris", "label": "Chris", "gender": "male", "accent": "American", "age": "middle-aged",
     "description": "Casual, down-to-earth. Dev tools, explainers.", "tags": ["casual", "conversational", "developer", "explainer"]},
    {"id": "Will", "label": "Will", "gender": "male", "accent": "American", "age": "young",
     "description": "Young, upbeat and friendly. Consumer apps.", "tags": ["upbeat", "young", "friendly", "energetic", "consumer"]},
    {"id": "Liam", "label": "Liam", "gender": "male", "accent": "American", "age": "young",
     "description": "Articulate and crisp. Tech launches, SaaS.", "tags": ["crisp", "articulate", "tech", "saas", "energetic"]},
    {"id": "Roger", "label": "Roger", "gender": "male", "accent": "American", "age": "middle-aged",
     "description": "Confident and direct. B2B, enterprise.", "tags": ["confident", "b2b", "enterprise", "direct"]},
    {"id": "Bill", "label": "Bill", "gender": "male", "accent": "American", "age": "older",
     "description": "Seasoned, documentary warmth. Mission and brand films.", "tags": ["documentary", "trustworthy", "older", "brand"]},
    {"id": "George", "label": "George", "gender": "male", "accent": "British", "age": "middle-aged",
     "description": "Warm British storyteller.", "tags": ["british", "warm", "narration", "story", "cinematic"]},
    {"id": "Daniel", "label": "Daniel", "gender": "male", "accent": "British", "age": "middle-aged",
     "description": "Authoritative British newsreader.", "tags": ["british", "authoritative", "news", "fintech", "enterprise"]},
    {"id": "Callum", "label": "Callum", "gender": "male", "accent": "Transatlantic", "age": "middle-aged",
     "description": "Intense, gravelly. Bold, dramatic launches.", "tags": ["intense", "dramatic", "bold", "gaming"]},
    {"id": "Charlie", "label": "Charlie", "gender": "male", "accent": "Australian", "age": "middle-aged",
     "description": "Natural, laid-back Australian.", "tags": ["australian", "natural", "conversational", "casual"]},
    {"id": "Sarah", "label": "Sarah", "gender": "female", "accent": "American", "age": "young",
     "description": "Soft and clear. Calm product walkthroughs.", "tags": ["soft", "clear", "calm", "walkthrough", "narration"]},
    {"id": "Jessica", "label": "Jessica", "gender": "female", "accent": "American", "age": "young",
     "description": "Expressive and conversational. Social-first launches.", "tags": ["expressive", "conversational", "social", "upbeat", "consumer"]},
    {"id": "Laura", "label": "Laura", "gender": "female", "accent": "American", "age": "young",
     "description": "Bright and upbeat. Consumer, lifestyle.", "tags": ["upbeat", "bright", "energetic", "consumer", "lifestyle"]},
    {"id": "Aria", "label": "Aria", "gender": "female", "accent": "American", "age": "middle-aged",
     "description": "Expressive, polished narrator. Premium brands.", "tags": ["expressive", "polished", "premium", "narration"]},
    {"id": "Matilda", "label": "Matilda", "gender": "female", "accent": "American", "age": "middle-aged",
     "description": "Warm and friendly. Health, education, community.", "tags": ["warm", "friendly", "education", "health"]},
    {"id": "Alice", "label": "Alice", "gender": "female", "accent": "British", "age": "middle-aged",
     "description": "Confident British presenter.", "tags": ["british", "confident", "presenter", "b2b", "fintech"]},
    {"id": "Lily", "label": "Lily", "gender": "female", "accent": "British", "age": "middle-aged",
     "description": "Warm British narrator. Thoughtful, cinematic stories.", "tags": ["british", "warm", "narration", "cinematic", "story", "calm"]},
    {"id": "River", "label": "River", "gender": "neutral", "accent": "American", "age": "middle-aged",
     "description": "Calm, gender-neutral and confident.", "tags": ["neutral", "calm", "confident", "modern"]},
]
BY_ID = {v["id"].lower(): v for v in VOICES}

MOOD_TAGS = {
    "calm": ["calm", "narration", "cinematic", "warm", "story"],
    "normal": ["friendly", "crisp", "tech", "conversational", "narration"],
    "energetic": ["upbeat", "energetic", "expressive", "young", "bold"],
}


def preview_key(vid: str) -> str:
    return f"motion/voices/{vid}.mp3"


def catalog(local: bool = False) -> List[dict]:
    """Voices + preview URLs. local=True → /files/templates/voices/… (motion.py serve), else the Worker's R2 path."""
    out = []
    for v in VOICES:
        f = PREVIEWS / f"{v['id']}.mp3"
        url = (f"/files/templates/voices/{v['id']}.mp3" if f.exists() else None) if local else f"/v1/motion/files/{preview_key(v['id'])}"
        out.append({**{k: v[k] for k in ("id", "label", "gender", "accent", "age", "description", "tags")}, "preview": url})
    return out


def get(vid: Optional[str]) -> Optional[dict]:
    return BY_ID.get((vid or "").strip().lower())


def suggest(brand_doc: Optional[dict] = None, mood: str = "normal", n: int = 3, exclude: Optional[str] = None) -> List[dict]:
    """Rank voices for this brand + mood. Dev tools lean calm/crisp; consumer leans upbeat."""
    want = list(MOOD_TAGS.get(mood, MOOD_TAGS["normal"]))
    blob = " ".join(str(x) for x in ((brand_doc or {}).get("copy") or {}).values()).lower()
    if re.search(r"\b(developer|api|code|sdk|cli|github|deploy|engineer)", blob):
        want += ["tech", "crisp", "developer", "calm"]
    if re.search(r"\b(bank|finance|payments|compliance|enterprise|security)", blob):
        want += ["confident", "b2b", "authoritative"]
    if re.search(r"\b(shop|fashion|fitness|social|creator|friends|music)", blob):
        want += ["upbeat", "consumer", "expressive"]
    scored = []
    for i, v in enumerate(VOICES):
        if exclude and v["id"].lower() == exclude.lower():
            continue
        scored.append((-sum(t in v["tags"] for t in want), i, v))
    return [s[2] for s in sorted(scored)[:n]]


def from_message(text: str) -> Optional[str]:
    """A voice the user asked for: by name ("use Lily", "Brian's voice") or by description ("british woman")."""
    low = text.lower()
    for v in VOICES:
        if re.search(rf"\b{v['id'].lower()}\b", low) and re.search(r"voice|narrat|use |read|speak|sound|switch|try", low):
            return v["id"]
    if not re.search(r"\bvoice|narrat|voiceover|vo\b", low):
        return None
    gender = "female" if re.search(r"\b(female|woman|women|girl|her|lady)\b", low) else "male" if re.search(r"\b(male|man|guy|his)\b", low) else None
    accent = next((a for a in ("British", "Australian", "American") if a.lower() in low or (a == "British" and "uk" in low.split())), None)
    words = re.findall(r"[a-z]+", low)
    best, best_score = None, 0
    for v in VOICES:
        if gender and v["gender"] != gender:
            continue
        if accent and v["accent"] != accent:
            continue
        score = 1 + sum(w in v["tags"] or w in v["description"].lower() for w in words if len(w) > 3)
        if score > best_score:
            best, best_score = v["id"], score
    return best if (gender or accent or best_score > 1) else None


def publish_previews(push: bool = False) -> List[Path]:
    """Generate (cached) a preview read per voice; push=True uploads them to R2 for the Worker."""
    from . import audio
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    done = []
    for v in VOICES:
        dest = PREVIEWS / f"{v['id']}.mp3"
        if not dest.exists():
            (clip, _), = audio.tts([PREVIEW_TEXT], PREVIEWS / ".cache", voice=v["id"])
            dest.write_bytes(clip.read_bytes())
        done.append(dest)
        if push:
            from . import store
            store.put_file(dest, preview_key(v["id"]))
    return done
