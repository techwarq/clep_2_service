import type { SceneDef } from "./defineScene";
import { typographyScenes } from "@/scenes/typography";
import { productScenes } from "@/scenes/product";
import { devScenes } from "@/scenes/dev";
import { dataScenes } from "@/scenes/data";
import { storyScenes } from "@/scenes/story";
import { brandScenes } from "@/scenes/brand";
import { clipScenes } from "@/scenes/clip";
import { filmScenes } from "@/scenes/film";

/**
 * Every scene the director can use. Adding a scene = write it with
 * defineScene() in src/scenes/, add it here, run `npm run registry` so the
 * Python director sees it. Nothing else changes.
 */
export const SCENES: SceneDef[] = [
  ...typographyScenes,
  ...productScenes,
  ...devScenes,
  ...dataScenes,
  ...storyScenes,
  ...brandScenes,
  ...clipScenes,
  ...filmScenes,
] as SceneDef[];

export const REGISTRY: Record<string, SceneDef> = Object.fromEntries(SCENES.map((s) => [s.type, s]));
