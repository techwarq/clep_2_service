# engine — Remotion + GSAP motion-graphics renderer

Renders any `VideoSpec` through the single `Spec` composition. See `../README.md` for the full pipeline.

```bash
npm install
npx remotion studio                                   # preview (examples/demo.spec.json)
npx remotion render Spec out.mp4 --props=spec.json --public-dir=<assets dir>
npm run registry                                      # re-export registry.json after changing scenes
npm run validate -- spec.json
```

```
src/
  engine/   spec.ts (zod contract) · styles.ts (reference presets) · SpecVideo.tsx · timeline.ts · registry.ts · validate.ts
  kit/      motion/ (easing, keyframes, springTrack, gsap, KineticText, Camera, transitions)
            ui/ (devices, Cursor, code, bits) · components/ (shadcn / Magic UI, frame-locked) · theme/
  scenes/   typography · product · dev · data · story · brand
  videos/   hand-built compositions (MuseLaunch) made straight from the kit
scripts/    export-registry.mts · validate.mts · stills.mts
```
