---
template: editorial
triggers: editorial, calm, thoughtful, letter, founder, essay, manifesto, writing, reading, finance, serif, elegant
---
# Editorial: a calm argument on paper

Beats (fixed by code): 2-line statement → product screenshot + caption → before/after → quote → end card.

- **opening**: 2 short lines that set up a tension, then the turn. **openingAccent**: the payoff words of the last line.
- **screenshot**: one of the provided screenshot paths. The hero shot is usually right.
- **shotCaption** / **shotAccent**: what the screenshot proves (≤ 44 chars), plus its last 1–3 words.
- **oldWay**: the old way, as up to 5 short nouns. **newWay**: the new way, as 1–3 short nouns.
- **quote**: must be a sentence that appears in SITE COPY or that the user gave you. Never write a testimonial.
  If there's none, keep the seed. Code swaps in a real line from the site and credits the brand.
- **endHeadline** / **endAccent**, **cta**, **ctaUrl**: the close, its payoff words, and the main button.

```json
{"opening": ["Demos go stale every sprint.", "Yours can ship with the code."], "openingAccent": "ship with the code.",
 "shotCaption": "Your product, demoing itself.", "shotAccent": "demoing itself.",
 "oldWay": ["Screen recorder", "Editor", "Re-takes"], "newWay": ["One command"],
 "endHeadline": "Start creating for free.", "endAccent": "for free.", "cta": "Ask for invite", "ctaUrl": "clep.dev"}
```
