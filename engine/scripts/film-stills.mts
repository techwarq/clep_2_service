/**
 * Storyboard for a chat-made film: one still per beat, from an already-bundled engine.
 *
 *   npx tsx scripts/film-stills.mts --serve <bundle> --props film.json --out <dir> [--at 0.6] [--scale 0.5]
 *
 * Writes <out>/scene_XX_<kind>.jpg and <out>/stills.json (same manifest shape as stills.mts).
 */
import fs from "fs";
import path from "path";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const arg = (name: string, def?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

const serveUrl = path.resolve(arg("serve")!);
const props = JSON.parse(fs.readFileSync(arg("props")!, "utf8"));
const outDir = path.resolve(arg("out", "out/film-stills")!);
const at = parseFloat(arg("at", "0.62")!);
const scale = parseFloat(arg("scale", "0.5")!);
fs.mkdirSync(outDir, { recursive: true });

const browser = await openBrowser("chrome");
const composition = await selectComposition({ serveUrl, id: "Film", inputProps: props, puppeteerInstance: browser });
const manifest: { index: number; type: string; frame: number; path: string }[] = [];
for (const [index, b] of (props.beats as { kind: string; start: number; end: number }[]).entries()) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round((b.start + (b.end - b.start) * at) * props.fps));
  const file = path.join(outDir, `scene_${String(index).padStart(2, "0")}_${b.kind}.jpg`);
  await renderStill({ serveUrl, composition, inputProps: props, frame, output: file, imageFormat: "jpeg", jpegQuality: 88, scale, puppeteerInstance: browser, logLevel: "error" });
  manifest.push({ index, type: b.kind, frame, path: file });
  console.log(`still ${index} ${b.kind} @${frame}`);
}
await browser.close({ silent: true });
fs.writeFileSync(path.join(outDir, "stills.json"), JSON.stringify(manifest, null, 2));
