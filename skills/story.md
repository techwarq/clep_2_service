# Story playbook: launch films people actually watch

Distilled from launch films that did 0.5–5M views on X (T:0, Listen Labs, Browserbase, Wonder, Aside,
Replit Canvas, Work Louder). None of them is an ad with a feature list. Each one is a short story about
one moment, told in a few words at a time, with the real product doing the work on screen.
People keep watching because they're waiting to see what happens, not because they're being sold to.

## The spine (every video, any length)

| # | Beat | What the viewer feels | Share of runtime |
|---|---|---|---|
| 1 | **The moment** | "that's me" | 15–20% |
| 2 | **The turn** | "oh, you just ask it" | 10% |
| 3 | **Watch it work** | "it's actually doing it" | 40–50% |
| 4 | **The payoff** | "that's the answer" | 10–15% |
| 5 | **The name** | quiet, confident | 10% |

1. **The moment.** Open on one specific, recognizable pain, the way it actually happens to one person.
   Not a category ("Finance is hard") but a scene ("Profit dropped. Nobody knows why."). No logo, no
   product name, no promise yet. The first words on screen must make the right viewer nod.
2. **The turn.** The product enters as an action rather than an announcement: a question typed into its
   input, a button pressed, a command run. Use the literal words a real user would type, lowercase and
   plain ("why did my profit drop last month?").
3. **Watch it work.** Show the product thinking in visible steps, one finding per step, each with a
   concrete value ("onboarding drop-off ▲31%"). This is the part viewers watch, so give it the most time.
   Show 3–5 steps. Fewer feels fake, and more turns into a list. It's **one continuous demo**: never retell the
   same findings in another format (chat, then table, then screenshot of the same thing). Each beat adds something new.
4. **The payoff.** Everything collapses into one answer: one number, one sentence, one result. If there's
   a "so what", it goes here in 5 words or fewer ("Amazon fees are half of it.").
5. **The name.** Logo or name, then URL, and at most one short line (a tagline or the site's own CTA). Keep it calm:
   no stacked claims, no "and so much more".

## Words on screen

- **1–4 words at a time.** Text is the narrator. A sentence is split across beats or revealed word by
  word: "You're / scaling / your business / like it's 2020." Headlines are fragments, not slogans.
- **No line twice.** Every beat's words are new. Don't restate the final word of a `words` beat as its `final`.
- **Say it like a person, not a brochure.** "Nobody knows why." beats "Gain actionable insights."
- **One accent per beat**, on the word that carries the turn (the pain word, the number, the verb).
- **Numbers are characters.** In a demo scenario, invent a believable, specific scenario and keep every
  number consistent across beats (steps must add up to the payoff). Round numbers look fake: 31% and $8,412 read as real, 30% and $8,000 read as made up.
- **Never** use: introducing, meet, unleash, supercharge, seamless, all-in-one, powerful, revolutionize,
  "the future of", "and much more", or three-adjective stacks.

## What to leave out (it's what makes it look like an ad)

- Feature lists or feature grids. If three features matter, show one working and let the others go.
- Opening on the logo or the product name.
- A new idea every beat. A story has one thread, so every beat should continue the one before it.
- Stock "problem" montages of generic app icons. Use the specific tools and messages from the story.
- Laptop or phone mockups floating in space. Stay tight on the one part of the UI that matters.
- Loud transitions (glitch, slash, impact) on every cut. Those are accents at most once per video.

## Pacing

Slower than you think. The best films hold a shot for 5–20 seconds and move *inside* it (a camera
push toward the element that's changing, text building up word by word) instead of cutting away. In
a 30s video, aim for **5–7 beats**, not 12. Only "the moment" can be fast. Let the payoff hold.

## Worked spines (shapes only: never reuse their words or numbers, build the scenario from this brand)

**AI agent (analytics/ops):** "Churn went up." / "Stripe. Intercom. Mixpanel." / "Nobody knows why."
→ types "why did we lose customers in March?" → steps: signups flat, onboarding drop-off ▲31%, one bug
ticket ×84, all on Android → "One broken screen." "Most of it." → name + URL.

**Dev tool / API:** "Your agent is stuck." / "85% of the web has no API." → one prompt to the agent
→ it opens the site, clicks, fills, downloads (4 steps) → "400 receipts. Done." → name + URL.

**Design / creative tool:** "Design. Hand-off. Rebuild." / "Every time, you lose something." → one prompt
on the canvas → variants appear, one is refined, it ships → "What you designed is what shipped." → name.

**Consumer app:** "It's 11pm." / "Three tabs. One flight. Still no answer." → one text to the app →
it checks, compares, books → "Booked. Aisle seat." → name.
