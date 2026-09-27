/**
 * Exports the engine's contract for the director (Python/LLM side):
 *   registry.json          — every scene: description, duration, JSON Schema of props, example
 *                            + styles, easings, transitions, camera moves, backgrounds
 *   examples/gallery.spec.json — one of every scene with its example props (kit gallery / smoke test)
 * Run after adding or changing a scene: `npm run registry`.
 */
import fs from "fs";
import path from "path";
import { z } from "zod";
import { SCENES } from "../src/engine/registry";
import { STYLES } from "../src/engine/styles";
import { EASE_NAMES } from "../src/kit/motion/easing";
import { BACKGROUNDS, CAMERA_MOVES, TRANSITIONS, VideoSpec } from "../src/engine/spec";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const registry = {
  generatedAt: new Date().toISOString(),
  scenes: SCENES.map((s) => ({
    type: s.type,
    category: s.category,
    description: s.description,
    duration: s.duration,
    defaultTone: s.defaultTone ?? "base",
    ownCamera: !!s.ownCamera,
    assetProps: s.assetProps ?? [],
    props: z.toJSONSchema(s.schema, { io: "input", unrepresentable: "any" }),
    example: s.example,
  })),
  styles: STYLES,
  eases: EASE_NAMES,
  transitions: TRANSITIONS,
  cameraMoves: CAMERA_MOVES,
  backgrounds: BACKGROUNDS,
  specSchema: z.toJSONSchema(VideoSpec, { io: "input", unrepresentable: "any" }),
};
fs.writeFileSync(path.join(root, "registry.json"), JSON.stringify(registry, null, 2));

const demo = JSON.parse(fs.readFileSync(path.join(root, "examples/demo.spec.json"), "utf8"));
const gallery = {
  ...demo,
  title: "Kit gallery",
  brand: { ...demo.brand, screenshots: ["muse_tagline.jpeg"] },
  scenes: SCENES.filter((s) => s.type !== "video_showcase").map((s) => {
    const props = JSON.parse(JSON.stringify(s.example));
    if (s.type === "site_showcase") props.screenshot = "muse_tagline.jpeg";
    const [lo, hi] = s.duration;
    return { id: s.type, type: s.type, duration: Math.round(((lo + hi) / 2) * 10) / 10, props };
  }),
};
fs.writeFileSync(path.join(root, "examples/gallery.spec.json"), JSON.stringify(gallery, null, 2));
console.log(`registry.json: ${SCENES.length} scenes, ${Object.keys(STYLES).length} styles`);
