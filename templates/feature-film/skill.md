---
template: feature-film
triggers: feature, launch, changelog, shipped, release, walkthrough, how it works, saas, dashboard, new feature, product video
---
# Feature Film: real product, camera follows the clicks

Beats (fixed by code): hook title → real product capture → benefits → end card.

- **eyebrow**: "New", "Introducing <Product>" or "Just shipped".
- **hook**: the promise in ≤ 8 words, taken from the site's h1/h2. A `\n` before the payoff reads well.
- **hookAccent**: the last 1–3 words of the hook, verbatim.
- **url**: the app's domain as the address bar shows it.
- **benefits**: 3 outcomes, 2–4 words each, taken from the site's steps and feature headings.
- **endHeadline**: an inviting close. The site's closing h2 is usually right.
- **cta** / **ctaUrl**: the site's main button text, and the bare domain.
- Leave **clip** out. The system records the product.

```json
{"eyebrow": "Introducing clep", "hook": "Product demos,\nstraight from your code.", "hookAccent": "from your code.",
 "url": "clep.dev", "benefitsTitle": "How it works", "benefits": ["Tag the feature", "Ask for the clip", "Get the MP4"],
 "endHeadline": "Start creating for free.", "cta": "Ask for invite", "ctaUrl": "clep.dev"}
```
