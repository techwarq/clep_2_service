/**
 * Validate a spec file against the engine contract (envelope + every scene's props).
 *   npx tsx scripts/validate.mts path/to/spec.json [--json]
 * Exit 0 = valid (normalized spec with defaults printed with --json), 1 = invalid.
 */
import fs from "fs";
import { validateSpec } from "../src/engine/validate";
import { buildTimeline } from "../src/engine/timeline";

const file = process.argv[2];
const asJson = process.argv.includes("--json");
if (!file) {
  console.error("usage: validate.mts <spec.json> [--json]");
  process.exit(2);
}
let raw: unknown;
try {
  raw = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  const msg = `could not parse ${file}: ${(e as Error).message}`;
  console.log(asJson ? JSON.stringify({ ok: false, errors: [msg] }) : msg);
  process.exit(1);
}
const res = validateSpec(raw);
if (!res.ok) {
  console.log(asJson ? JSON.stringify({ ok: false, errors: res.errors }) : "INVALID\n" + res.errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
const tl = buildTimeline(res.spec, res.spec.format.fps);
const timeline = tl.entries.map((e) => ({ index: e.index, type: e.scene.type, from: e.from, frames: e.frames, transitionFrames: e.transition.frames }));
if (asJson) console.log(JSON.stringify({ ok: true, warnings: res.warnings, spec: res.spec, totalFrames: tl.total, timeline }));
else {
  console.log(`OK — ${res.spec.scenes.length} scenes, ${(tl.total / res.spec.format.fps).toFixed(2)}s`);
  res.warnings.forEach((w) => console.log("  warn: " + w));
}
