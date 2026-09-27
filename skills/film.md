# Film: write a narrated launch film

You write the **script**: what the narrator says and what is on screen, beat by beat. Code voices it,
times every beat and every click to the voice, scores music, adds the UI sounds and renders it. The
UI is recreated as motion graphics (never screen recordings), in the brand's colors and fonts.

## The story (in this order)
1. **Hook**: a moment the viewer recognizes, told in the first two lines. Something just went right,
   or the pain is right there. No product name yet.
2. **Problem**: the friction, felt. It is concrete and specific to this product's user.
3. **Turn**: the insight. Why it doesn't have to be this way.
4. **Reveal**: meet the product (`reveal`). Put it at roughly 40–50% of the film, not earlier.
5. **How it works**: one flow, shown working (`prompt` or `app` or `screenshot`).
6. **Payoff**: what you get (`result`, or `carousel` for breadth).
7. **Close**: three short phrases, the product name and the CTA (`close`).

Aim for 8–11 beats and 40–55 seconds total.

## Voice (`vo`)
- Calm and measured, with the confidence of an SF launch film. Short sentences, and fragments are fine.
- Keep each line to 3–18 words. A list read on the beat ("Record. Retake. Zoom.") is great for `grind`.
- Some beats need a longer line because the screen is busy for longer:
  - `prompt`: 16–28 words, the ask then what happens ("Just ask Claude Code. Clep finds the feature, runs it in a real browser, and directs every click.").
  - `app`: 10–20 words.
  - `result`: say the chips out loud, in order ("A finished film. Edited, graded, 1080p.").
  - `grind`: say the words, in order.
  - `close`: say the phrases, in order.
- Never read the screen word for word. The screen is the headline, and the voice is the thought behind it.
- Use only facts from SITE COPY. Invent no numbers, customers or quotes.

## On-screen text
- Headlines have 2–7 words. Wrap *accent words* in asterisks, `code` in backticks, and use `\n` for a
  second line.
- Never put the whole voice line on screen.

## Beat kinds
| kind | fields | shows |
|---|---|---|
| headline | text | big kinetic type on its own |
| shipped | text, title (PR/feature name), sub?, button?, done? | a success card a cursor completes ("Merge pull request" → "Merged") |
| checklist | text, items[{text, done}] (3–4, last one undone), tag? | a to-do card; the undone item gets circled |
| grind | text?, words[] (3–6 single words with a period) | dark and fast: one word per spoken beat, each with a tiny UI |
| loop | text ("You do it\n*all again.*"), ring[] (the grind words) | dark: the chores spinning around the line |
| code | text, file, lines[] (≤9), highlight (index) | a code card with the key line lit up over a dot field |
| reveal | tagline (use *accent*), pill? ("Live · …") | logo lockup, glow and tagline |
| prompt | agent, prompt (what the user types), steps[{title, sub}] (3–4), app{…} | a chat box types and sends; the agent's steps tick off while a cursor labelled with the brand drives the app |
| app | text?, app{name, title, subtitle, placeholder, query, button, results[{tag,title}] (3)} | the product's own UI, recreated: type → click → results |
| screenshot | text?, src (a SCREENSHOTS path), callout? | the real product screenshot, sharp, slow camera |
| result | text, file, chips[] (3; the last is the headline spec) | a finished-film player; chips pop on the spoken words |
| carousel | text, items[] (3–4 short labels) | a row of outputs, for breadth |
| close | phrases[] (1–3, e.g. "Build it.", "`/clep` it.", "*Share it.*"), cta, url? | the phrases, then logo, CTA pill and URL |

Add `"dark": true` to any beat to put it on black; `grind` and `loop` are dark by default. Use dark for
the pain beats only.

`app` fields describe **this product's** main flow. For a CRM: name "Pipeline", title "Leads",
placeholder "Search leads…", query "Series A fintech in Berlin", button "Find leads", and 3 results with
tags. Keep it believable and specific to the site copy.

## Output
{"reply": "one short sentence, no markdown", "title": str, "mood": "calm|normal|energetic",
 "music"?: "a one-line music brief if the user asked for a sound", "beats": [ … ]}
