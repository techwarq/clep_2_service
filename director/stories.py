"""Story shapes for launch films. Each film gets one, chosen at random from the shapes that fit
the product and that this chat hasn't used yet, so two films are never built the same way.

The engine's motion stays the same for every shape; what changes is the order of ideas, which
beats carry them, how the narrator speaks and where the product first appears.
"""
from __future__ import annotations

import random
import re
from typing import List, Optional

STORIES = [
    {"id": "moment", "name": "A moment in their day",
     "shape": "Open on a specific time, place and person (a headline, dark) → the friction happening right then "
              "(checklist or grind) → the turn → reveal → the product handling that exact moment (app) → what changed "
              "(result) → close.",
     "voice": "present tense, observational, like a documentary."},
    {"id": "before-after", "name": "Two worlds",
     "shape": "Before: 2–3 dark beats of how it's done today (grind, loop, headline) → one hard switch at the reveal → "
              "after: the same task done in the product (app) → result chips comparing before and after → close.",
     "voice": "contrast; short parallel sentences (\"Before, … Now, …\")."},
    {"id": "manifesto", "name": "A belief",
     "shape": "A bold belief (headline) → the world that proves it wrong (grind or checklist) → a second belief (headline) → "
              "reveal → the product living that belief (app or screenshot) → the outcome (result) → close.",
     "voice": "declarative, confident, a little defiant."},
    {"id": "demo-first", "name": "Product first",
     "shape": "Open on the product already working (app), with no setup → a headline naming what just happened → reveal → "
              "a second, different use (app or screenshot) → carousel of other things it handles → close.",
     "voice": "fast, crisp, show-don't-tell."},
    {"id": "question", "name": "What if",
     "shape": "A provocative question as the hook (headline) → the reality today (checklist or grind) → one \"imagine…\" "
              "headline → reveal → the product answering the question live (app) → result → close.",
     "voice": "curious, conversational, inviting."},
    {"id": "customer", "name": "In their words",
     "shape": "First-person narrator who IS the user (\"I run three buildings…\") → their day and their pain (checklist "
              "or grind) → how they found it (reveal) → them using it (app) → their outcome (result) → close.",
     "voice": "first person, warm, specific, human."},
    {"id": "steps", "name": "As simple as",
     "shape": "Reveal early (beat 2) → three short numbered beats showing how simple it is (headline, app, headline "
              "or code) → result → close.",
     "voice": "calm and precise; count the steps out loud."},
    {"id": "numbers", "name": "The number", "needs": "proof",
     "shape": "Open on a real number from the brief's proof (headline) → what it means for the user → reveal → the "
              "product producing that outcome (app, dashboard layout) → result → close.",
     "voice": "measured, factual, lets the number land."},
    {"id": "agent", "name": "Just ask", "needs": "agent",
     "shape": "The pain (checklist or grind) → the turn → reveal → someone asks the product in plain words and it "
              "does the work (prompt, with the product as the agent) → result → close.",
     "voice": "calm, confident, a little magical."},
]
BY_ID = {s["id"]: s for s in STORIES}

# chat asks that mean "not this one, write me a different film"
FRESH = re.compile(r"\b(new|another|different|fresh|redo|re-?make|start over|from scratch|again|other (one|version)|alternative)\b", re.I)


def pick(brief: dict, avoid: List[str], asked: Optional[str] = None, rng: Optional[random.Random] = None) -> dict:
    """A story shape for this product: the one the user asked for, else random among those that
    fit and haven't been used in this chat."""
    if asked and asked in BY_ID:
        return BY_ID[asked]
    rng = rng or random.Random()
    proof = any(re.search(r"\d", str(p)) for p in (brief.get("proof") or []))
    ok = [s for s in STORIES
          if not (s.get("needs") == "proof" and not proof) and not (s.get("needs") == "agent" and not brief.get("is_agent"))]
    fresh = [s for s in ok if s["id"] not in avoid] or ok
    return rng.choice(fresh)


def from_message(message: str) -> Optional[str]:
    low = message.lower()
    for s in STORIES:
        if s["id"].replace("-", " ") in low or s["name"].lower() in low:
            return s["id"]
    if re.search(r"day in the life|a day with", low):
        return "moment"
    if re.search(r"before (and|&|/) after", low):
        return "before-after"
    if re.search(r"testimonial|customer story|first person", low):
        return "customer"
    return None


def describe(story: dict) -> str:
    return (f"STORY SHAPE for this film: \"{story['name']}\" ({story['id']}).\n"
            f"Shape: {story['shape']}\nNarration: {story['voice']}\n"
            "Follow this shape. It is what makes this film different from every other one.")
