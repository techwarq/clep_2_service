# Custom video: write a beat sheet

The user wants something no template covers. Write 4–9 **beats** in order. Code turns each beat into
a scene, times it, and adds the camera, transitions and brand. Only write the words.

Structure: **the moment → the turn → watch it work → the payoff → the name** (see the story playbook).
The first beat must be `hook`, `words` or `statement`. The last must be `cta` or `logo`. Don't use the
same kind twice in a row. Follow the user's requested order when they give one.

Map each story beat to kinds like this:
| story beat | kinds | notes |
|---|---|---|
| the moment | `words`, `statement`, `problem` | the pain in 1–4 word fragments, no product name |
| the turn + watch it work | **`trace`** (best), or `search`, `terminal`, `click` | ONE beat: the typed request, then 3–5 findings with values, then optionally the payoff line |
| (optional) the real UI | `product` | one beat on a real screenshot when it shows something the trace doesn't |
| the payoff | `statement` (1–2 short lines), `stat` | one answer. Numbers already used in the demo beats may repeat here |
| the name | `logo` or `cta` | name, URL, site's own CTA. Nothing else |

Don't use `list` or `features` unless the user explicitly asks for a feature rundown. They turn a story into an ad.

**Shots (optional `variant`).** `problem` can be cards | scatter | thread | ticker | lockscreen. `trace` can be rows | terminal | sheet |
nodes | document | cards. Leave it out and the brand's look picks one. Set it only when the user asks ("show it on a phone",
"make it a spreadsheet").

**Name real tools.** In `problem` items (`app`) and `trace` findings, use the actual tool name: Slack, Gmail, Shopify, Amazon,
Meta, Stripe, QuickBooks, GitHub, Linear, Zendesk, HubSpot, Instagram, TikTok, and so on. Their real logos render automatically.
Made-up app names get a plain letter tile instead.

## Beat kinds (fields; `?` = optional)
| kind | fields | use for |
|---|---|---|
| hook | title (≤48), accent?, eyebrow? (≤28) | a big opening line (the pain, not a promise) |
| words | words[] (2–6, ≤14 each), final? (≤30), accent? | fast kinetic opener |
| statement | lines[] (1–3, ≤40 each), accent? | tension, a turn, a belief |
| problem | lines[] (≤2, ≤22) + items[] {app, title} (2–4) | "too many tools" chaos |
| product | caption? (≤44), accent?, screenshot? (a provided path) | the real UI. Include at least one. |
| click | heading (≤40), button (≤22), result? (≤32) | one action → result |
| list | title? (≤32), items[] (2–5, ≤28) | benefits, outcomes |
| features | title? (≤32), items[] {title (≤22), desc? (≤40)} (2–6) | feature grid |
| steps | items[] (2–5, ≤18), caption? (≤44) | how it works, A → B → C |
| compare | beforeTitle, before[] (≤5), afterTitle, after[] (≤3); items ≤18 | old way vs new way |
| stat | stats[] {value, label} (1–3) | only numbers the site or user gave |
| quote | quote (≤110), author, role? | only a sentence that exists in site copy or user text |
| trace | prompt (≤80), steps[] {text (≤48), value? (≤16), dir: up\|down\|none} (2–6), result? (≤40), resultAccent? | the product investigating/doing the job, filmed big. Use this for any "ask → it works → answer" |
| chat | messages[] {from: user\|agent, text} (2–5), results[]? | a conversation (only when back-and-forth matters) |
| search | query (≤60), status (≤36), results[] {title, source} (≤4) | search/research products |
| table | title?, columns[] (≤4), rows[][] (≤6) | agent fills a list. Generic example data. |
| terminal | lines[] (2–6, ≤60) | CLIs, dev tools |
| code | lines[] (≤14), highlight (line index) | SDKs, APIs |
| cta | headline (≤44), accent?, cta? (≤22), url? | closing ask |
| logo | tagline? (≤44) | closing brand sting |

## Top-level fields
- `mood`: calm, normal or energetic. Code picks the visual style from it and from what the brand looks like.
- `style` (optional): clean-saas, dark-keynote, kinetic-bold, editorial-paper, neon-tech or soft-brand.
  Set it only when the user asks for a look.
- `seconds` (optional): the length the user asked for. Default 25.

## Example (the shape to copy; the words and numbers belong to this made-up support-agent brand only)
User: "launch video for our AI support agent: a Monday inbox and it clears it"
```json
{"title": "Monday inbox", "mood": "calm", "beats": [
  {"kind": "words", "words": ["Monday.", "9:02am."], "final": "412 unread tickets.", "accent": "412"},
  {"kind": "problem", "lines": ["Two of you."], "items": [{"app": "Zendesk", "title": "Where is my order?? (3rd time)"}, {"app": "Slack", "title": "Can someone take the refunds?"}, {"app": "Gmail", "title": "URGENT: wrong size shipped"}]},
  {"kind": "trace", "prompt": "clear what you can, flag the rest", "steps": [
      {"text": "Order-status questions answered", "value": "288"},
      {"text": "Refunds under $50 sent", "value": "41"},
      {"text": "Wrong-size swaps booked", "value": "74"},
      {"text": "Flagged for you", "value": "9"}],
   "result": "9 tickets left. 9:40am.", "resultAccent": "9 tickets left."},
  {"kind": "product", "caption": "Every reply, with its reason.", "accent": "its reason."},
  {"kind": "cta", "headline": "Give it the inbox.", "cta": "Get started", "url": "example.com"}]}
```
Notice what's missing: no "Introducing", no feature list, no logo up front, and no beat that starts a new thread.
