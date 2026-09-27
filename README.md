# pipeline_motion — script + website + assets → pro motion graphics

One pipeline. **Remotion** renders, **GSAP** animates, an **LLM director** composes videos out of
a pre-built kit, using the brand's *real* colors, fonts, logo and screenshots, pulled from its website.
The model never writes render code: it writes a **VideoSpec** (JSON), the engine validates and renders it.

```
            ┌──────────── director/ (Python) ────────────┐        ┌──────── engine/ (Remotion + GSAP) ────────┐
 website ──▶│ brand.py   site → colors, fonts, logo,     │        │ kit/motion   eases, keyframes, springs,   │
            │            screenshots, copy (Playwright)  │        │              GSAP timelines, KineticText, │
 script  ──▶│ storyboard 3 variants in a named style ────┼─spec──▶│              Camera, transitions          │
 reference ▶│ notes.py   "slow every zoom to 0.7x" → spec│  JSON  │ kit/ui       Browser/Phone frames, Cursor,│
 assets  ──▶│ engine.py  validate · stills · render      │        │              Code, Pills, Icons, Logo     │
            └────────────────────────────────────────────┘        │ scenes/      26 parametric scenes         │
                           ▲         registry.json (scene contract, exported from TS)      │ engine/      spec schema, styles, SpecVideo│
                           └─────────────────────────────────────────────────────────────┘
```

## The workflow (maps 1:1 to what actually makes these videos look pro)

| Step | Command | Why |
|---|---|---|
| 1. Reference | `--ref "Linear launch video"` / `reference.txt` | Naming a style beats describing one. The director maps it to a **style preset** (pacing, type, camera, transitions). |
| 2. Renderer | `engine/` (Remotion + GSAP) | Every frame is code → exact, and a change re-renders one scene, not the whole thing. |
| 3. Real components | `engine/src/kit` + `kit/components/ui` (shadcn / Magic UI / 21st.dev) | Real buttons, cards, windows instead of invented UI. |
| 4. Context dump | `motion.py new --url … --script … --assets …` | Brand kit extracted from the site: colors, fonts (actual font files), logo, screenshots, copy. |
| 5. Storyboard ×3 | `motion.py board` → stills | 3 genuinely different directions; **one still per scene** before anything renders. |
| 6. Director notes | `motion.py note … "hard cut here, push in on the button"` | Camera words map to spec fields (`camera.speed`, `transition`, `props.zoom`…). |
| 7. Render | `motion.py render` | 1080p/4K/9:16 mp4, ~1 min for a 25 s video. |

```bash
cd pipeline_motion
(cd engine && npm install)                        # once
export OPENROUTER_API_KEY=...                     # or it's read from ../pipeline/.env
# optional: MOTION_DIRECTOR_MODEL=anthropic/claude-opus-5.5 (default)

python3 motion.py new acme --url https://acme.com --script script.txt --ref "dark keynote, Apple-style" \
        --assets ~/Desktop/logo.svg ~/Desktop/app.png ~/Desktop/voiceover.mp3
python3 motion.py board acme --variants 3 --seconds 30          # add --portrait for 9:16
open projects/acme/stills/*/storyboard.jpg
python3 motion.py note acme v2-product-proof "slow every zoom to 0.7x, hard cut into scene 3"
python3 motion.py render acme v2-product-proof.n1               # --draft = half-res preview
python3 motion.py studio acme v2-product-proof.n1               # live scrub/edit in Remotion Studio
```

`python3 motion.py go acme --url … --script …` runs everything and renders variant 1.

## Templates (pick one, fill slots, render)

Five pre-directed looks, drawn from what actually ships on whatships.com. The gallery is `templates/index.html`.

| id | look | best for |
|---|---|---|
| `feature-film` | real product capture floating on a gradient; **camera follows the Clep trace.json** (push-ins, click ripples, callouts) | SaaS feature launches |
| `agent-run` | prompt types → agent works a table live → big number | AI agents, automation |
| `teaser` | kinetic poster type on the beat → announcement → logo | coming-soon, version drops |
| `editorial` | paper + serif + italic accents, product as proof, quote | thoughtful / category launches |
| `phone-chat` | bright stage, phone chat with an agent, approve | consumer & messaging agents |

```bash
python3 motion.py templates                                    # slots + controls
python3 motion.py template acme feature-film --values v.json \
        --control fontPairing=editorial backdrop=pastel pace=snappy format=9:16
python3 motion.py render acme feature-film
python3 motion.py examples --render                            # rebuild templates/*/example.mp4
```

- A template is `templates/<id>/template.json`: a VideoSpec with `{{slot}}` placeholders, typed slots (text / textList / table / items / image / clip) with character limits, and default controls.
- The controls are shared by every template (`templates/controls.json`): font pairing, backdrop, colors, pace, text animation, transitions, camera intensity, and format (16:9 · 9:16 · 1:1 · 4:5).
- A `clip` slot takes `{"src": "clips/x.mp4", "trace": "clips/x.trace.json"}`. `director/capture.py` records a raw capture + trace from any URL (the Clep recorder contract).

## Motion API (powers the Clep dashboard)

```bash
python3 motion.py serve            # http://localhost:8791
```

The Clep app points at it with `NEXT_PUBLIC_MOTION_API_URL`. Endpoints:
- `GET /templates`
- `POST /brand {url}`: site → brand kit
- `POST /chat {message, project, draft}`: template + slot values, or edits to the current draft
- `POST /preview`: storyboard stills, about 3s once the project is bundled
- `POST /render` → poll `GET /jobs/<id>`
- `POST /upload`
- `GET /files/...` (range requests; add `?dl=1` to download)

Feature Film auto-records a guided tour of the site (`director/capture.py:auto_tour`) whenever no recording is uploaded.

## Project layout

```
projects/<name>/
  brand.json         brand kit + ranked site palette + site copy  (edit freely)
  script.txt  reference.txt
  assets/            Remotion public dir for this project
    shots/ brand/ fonts/   extracted from the website
    user/            your files — voiceover.mp3 / music.mp3 are auto-wired into audio
  specs/             v1-*.json, v2-*.json, v3-*.json, *.n1.json (note revisions)
  stills/<spec>/storyboard.jpg
  renders/<spec>.mp4
```

## VideoSpec — the whole contract

```jsonc
{
  "style": "clean-saas",                 // clean-saas | dark-keynote | kinetic-bold | editorial-paper | neon-tech | soft-brand
  "styleOverrides": { "titleAnim": "chars" },
  "format": { "width": 1920, "height": 1080, "fps": 30 },
  "brand": { … injected from brand.json … },
  "audio": { "voiceover": "user/voiceover.mp3", "music": "user/music.mp3", "musicVolume": 0.25 },
  "speed": 1,                            // global animation time scale
  "scenes": [
    { "type": "site_showcase", "duration": 4,
      "props": { "screenshot": "shots/hero.png", "zoom": { "x": 0.8, "y": 0.04, "scale": 2, "at": 1.4 },
                 "callouts": [{ "text": "Sign up in 1 click", "x": 0.82, "y": 0.05 }] },
      "transition": { "type": "whip", "duration": 0.35, "direction": "left" },
      "camera": { "move": "push_in", "speed": 0.7 },          // or keys: [{ at, zoom, focus: [x,y], ease }]
      "tone": "inverse", "speed": 1, "notes": "proof beat: the real signup" }
  ]
}
```

- **Transitions**: cut, fade, blur, slide, push, wipe, whip, zoom, flash, flip, iris, clock.
- **Camera**: none, push_in, pull_out, drift, pan_left/right, tilt_up/down, punch_in, dutch, or keyed
  (`keys: [{at, zoom, focus:[x,y], ease}]`), plus `shake` and `motionBlur`.
- **Eases** (shared by Remotion + GSAP): linear, easy (AE Easy Ease), out, in, inOut, expo, expoInOut, snappy, smooth, overshoot, anticipate.
- **Backgrounds**: flat, gradient, blobs, grid, dots, spotlight, paper, aurora, noise, image.
- **Tone** per scene: base / inverse (flip light↔dark) / primary (brand color as backdrop).

`engine/registry.json` is the full machine-readable catalog, with JSON Schema for every scene's props. It is
regenerated by `python3 motion.py registry`.

## Scene library (26)

| category | scenes |
|---|---|
| typography | kinetic_title, word_flash, statement, list_reveal, quote |
| product | site_showcase, ui_click, feature_grid, search_results, chat_demo, notification_stack, approval_card, phone_showcase, video_showcase |
| dev | terminal_type, code_zoom |
| data | stat_counter, progress_ring, bar_chart, split_compare, flow_diagram |
| story | card_scatter, timeline_assemble, logo_wall |
| brand | logo_reveal, end_card |

`python3 motion.py gallery` renders one still of each to `engine/out/gallery/storyboard.jpg`.

## Extending the kit

**New scene.** Add a `defineScene({...})` in `engine/src/scenes/*.tsx`, give it a zod props schema, an
LLM-facing description, a duration range and an example. Register it in `engine/src/engine/registry.ts`,
then run `python3 motion.py registry`. The director can use it immediately.
Scenes animate from `useSceneTime()` (not raw frames), so `speed` notes work, and size themselves in `useLayout()` units, so 4K and 9:16 work.

**GSAP in a scene.** Use `useGsapTimeline((tl, q) => { … })`. The timeline is paused and seeked to the
Remotion frame, so SplitText, DrawSVG, MorphSVG, ScrambleText and CustomEase are all frame-exact and parallel-render safe.
Eases are registered as `kit.<name>`.

**Components from 21st.dev / shadcn / Magic UI.**
```bash
cd engine && npx shadcn@latest add "https://21st.dev/r/<author>/<component>"   # lands in src/kit/components/ui
```
Then follow the rules that make library components render-safe:
1. **No wall-clock animation.** Framer Motion, CSS `transition` and `animation` all run on real time. Freeze CSS keyframe
   animations with `animationPlayState: "paused"` + `animationDelay: -frame/fps s` (see `ui/shimmer-button.tsx`),
   and drive everything else from `useSceneTime()` or `useGsapTimeline`.
2. **Theme through CSS vars.** The components read `var(--primary)`, `var(--card)` and so on, which `ThemeProvider` sets from the brand.
3. **Wrap, don't fork.** Put a frame-locked wrapper next to it in `kit/components/` (see `ShimmerButton.tsx`, `Marquee.tsx`).

## Layout

```
engine/      Remotion + GSAP renderer (TypeScript) — kit, scenes, spec schema, registry
director/    Python orchestration — brand extraction, LLM storyboard + notes, render bridge
motion.py    the CLI
projects/    one folder per video
legacy/      previous engines kept for reference: pil/ (PIL kinetic), morph_ui/ + service/ (canvas/GSAP HTML via Playwright)
```
