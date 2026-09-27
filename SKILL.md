---
name: motion-director
description: Make a production-grade motion-graphics video (launch video, feature promo, explainer) from a script, a website and assets with pipeline_motion (Remotion + GSAP). Use when asked to make/edit a motion graphics or launch video.
---

# Motion director (pipeline_motion)

You are the director. You write **VideoSpec JSON**, never render code, unless a genuinely new scene type is needed.
Work from `pipeline_motion/`.

1. **Context first.** `python3 motion.py new <name> --url <site> --script <file|text> --ref "<reference style>" --assets …`
   Read `projects/<name>/brand.json` and look at `assets/shots/*.png`. Real screenshots are what the video shows.
2. **Three directions.** `python3 motion.py board <name> --variants 3 --seconds 30`. Alternatively, write the specs yourself into
   `projects/<name>/specs/` using `engine/registry.json` (scene props schemas, styles, transitions, cameras), and
   validate each with `cd engine && npx tsx scripts/validate.mts <spec>`.
3. **Stills before motion.** `python3 motion.py stills <name> <spec>` → view `stills/<spec>/storyboard.jpg`. Fix copy,
   layout and scene order here.
4. **Notes like a DP.** Edit the spec directly or run `python3 motion.py note <name> <spec> "<notes>"`:
   camera.speed (0.7 = slower), transition.type "cut", site_showcase props.zoom {x,y,scale,at,duration},
   camera.keys for push-ins, scene.speed for animation pace, tone inverse/primary for contrast beats.
5. **Render.** `python3 motion.py render <name> <spec>` (`--draft` for half-res). Check it by sampling frames:
   `ffmpeg -i out.mp4 -vf fps=1,scale=480:-1,tile=5x5 sheet.jpg`.

Rules of taste: hook in 2s · never the same scene type twice in a row · real UI beats invented UI · brand copy over
filler · headlines ≤ 8 words · end on logo_reveal/end_card · one style preset per video.
