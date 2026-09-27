/**
 * Storyboard renderer: one still per scene from an already-bundled engine.
 * Fixing a still takes seconds; fixing a render takes minutes — so every
 * spec is reviewed as stills before any full render.
 *
 *   npx remotion bundle --public-dir <assets> --out-dir <bundle>
 *   npx tsx scripts/stills.mts --serve <bundle> --props spec.json --out <dir> [--at 0.65] [--scale 0.5] [--scenes 0,3]
 *
 * Writes <out>/scene_XX_<type>.jpg and <out>/stills.json (frame + path per scene).
 */
import fs from "fs";
import path from "path";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { validateSpec } from "../src/engine/validate";
import { buildTimeline } from "../src/engine/timeline";

const arg = (name: string, def?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

const serveUrl = path.resolve(arg("serve")!);
const propsFile = arg("props")!;
const outDir = path.resolve(arg("out", "out/stills")!);
const at = parseFloat(arg("at", "0.65")!);
const scale = parseFloat(arg("scale", "0.5")!);
const only = arg("scenes")?.split(",").map((s) => parseInt(s, 10));

const res = validateSpec(JSON.parse(fs.readFileSync(propsFile, "utf8")));
if (!res.ok) {
  console.error("Invalid spec:\n" + res.errors.join("\n"));
  process.exit(1);
}
const spec = res.spec;
const { entries } = buildTimeline(spec, spec.format.fps);
fs.mkdirSync(outDir, { recursive: true });

const browser = await openBrowser("chrome");
const composition = await selectComposition({ serveUrl, id: "Spec", inputProps: spec, puppeteerInstance: browser });
const manifest: { index: number; type: string; frame: number; path: string }[] = [];
for (const e of entries) {
  if (only && !only.includes(e.index)) continue;
  // Sample inside the scene, clear of the incoming transition's overlap.
  const lo = e.from + (entries[e.index - 1]?.transition.frames ?? 0);
  const hi = e.from + e.frames - e.transition.frames - 1;
  const frame = Math.max(lo, Math.min(hi, Math.round(e.from + e.frames * at)));
  const file = path.join(outDir, `scene_${String(e.index).padStart(2, "0")}_${e.scene.type}.jpg`);
  await renderStill({ serveUrl, composition, inputProps: spec, frame, output: file, imageFormat: "jpeg", jpegQuality: 88, scale, puppeteerInstance: browser, logLevel: "error" });
  manifest.push({ index: e.index, type: e.scene.type, frame, path: file });
  console.log(`still ${e.index} ${e.scene.type} @${frame}`);
}
await browser.close({ silent: true });
fs.writeFileSync(path.join(outDir, "stills.json"), JSON.stringify(manifest, null, 2));
