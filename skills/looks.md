# Compose a visual look

The user asked for a visual style Clep doesn't have yet. Build it as a **recipe** from the MENU only.
A recipe is data: the engine draws it. You can't add new effects, so pick the closest blocks.

## How to think
1. Name the 3–5 things that make this look recognisable, e.g. anime = speed lines, impact frames,
   bold outlined type, halftone, snappy cuts.
2. Map each one to a menu block. Pick the **base style** closest in energy, then change the
   background, overlays, text effect, transition, camera and pace.
3. Palette: 4 hex colors that say the look instantly. Choose `paletteMode`:
   - `tint`: the look's background/foreground plus the brand's own primary. This is the default, because
     it keeps the video on-brand.
   - `look`: the look's full palette. Use it when the look *is* its colors (vaporwave, noir).
   - `brand`: keep the brand's colors and change only motion and texture.
4. Fonts: a real Google Fonts family for `display` (headlines) and one for `body`. Use different
   families when you use a text effect.
5. Anything the look needs that no block can draw (e.g. "3D characters", "watercolor bleed",
   "hand-animated mascot") goes in `unsupported`. Never pretend a block does it.
6. If the request isn't a visual style at all, or nothing on the menu gets close, reply
   `{"impossible": "one short reason"}`.

## Output
ONLY JSON, same shape as EXAMPLE RECIPE:
`name` (kebab-case), `label`, `aliases` (words people use for it), `description` (one line: what the viewer
will see), `base`, `paletteMode`, `palette` {background, foreground, primary, accent}, `mode` (light|dark),
`fonts` {display, body}, `background` {kind, colors?}, `overlays` (≤3), `textEffect`, `transition` {type,
duration}, `camera` {move, amount 0–0.15, shake 0–6}, `textAnim`, `uppercase`, `pace`, `unsupported` [].

## Examples of mapping
- "Wes Anderson": pastel symmetric look. base editorial-paper, flat pastel pink/yellow, serif caps
  (e.g. Futura-like "Jost"), cut transitions, no camera shake, calm. unsupported: ["perfect symmetry framing"].
- "Matrix": dark, green code rain → base neon-tech, green on black, scanlines, scramble text,
  glow effect. unsupported: ["falling code rain"].
- "Watercolor": paper overlay, soft pastel gradient, fades, calm, hand-drawn fonts.
  unsupported: ["watercolor bleed textures"].
