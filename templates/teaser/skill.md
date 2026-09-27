---
template: teaser
triggers: teaser, coming soon, waitlist, announce, announcement, countdown, hype, v2, version, drop, sneak peek, launch day
---
# Teaser: kinetic type on the beat, before anyone sees the UI

Beats (fixed by code): word flash → statement → announcement title → logo.

- **flashWords**: 3–6 single punchy words ending in "." ("Faster." "Smaller." "Sharper."). Take them from what the
  product claims.
- **flashFinal** / **flashAccent**: the line the flash lands on (≤ 30 chars) and its payoff words.
- **lines** / **linesAccent**: 3 short lines (≤ 30 chars) that build up, plus the payoff words of the last line.
- **date**: only if the user gave a date. Otherwise keep the seed.
- **announce**: what's coming ("Version 2", "clep for teams").
- **tagline**: the ask ("Join the waitlist", "Ask for invite").

```json
{"flashWords": ["Mark.", "Run.", "Export."], "flashFinal": "Demos from your code.", "flashAccent": "your code.",
 "lines": ["No screen recorder.", "No editor.", "Just /clep."], "linesAccent": "Just /clep.", "announce": "clep", "tagline": "Ask for invite"}
```
