import type React from "react";
import type { z } from "zod";
import { useVideoConfig } from "remotion";

/** Where a scene's main container sits (px), so a `morph` transition can carry it into the next scene. */
export type Anchor = { x: number; y: number; w: number; h: number; r: number; fill: "card" | "ink" | "dark" | "primary" | "outline" };
export type Box = { width: number; height: number };

export type SceneCategory = "typography" | "product" | "dev" | "data" | "story" | "brand";

export type SceneDef<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  type: string;
  category: SceneCategory;
  /** LLM-facing: what it looks like and when to use it. */
  description: string;
  /** Seconds [min, max] at speed 1. */
  duration: [number, number];
  schema: S;
  component: React.FC<z.infer<S>>;
  /** Tone the scene looks best in when the spec doesn't say. */
  defaultTone?: "base" | "inverse" | "primary";
  /** Background kind override (e.g. terminal scenes want flat). */
  defaultBackground?: string;
  /** Camera move the scene already implies (so the style camera doesn't fight it). */
  ownCamera?: boolean;
  /** Prop names holding asset paths (for validation + the director's asset list). */
  assetProps?: string[];
  /** Container at the scene's first frame (`in`) and last frame (`out`) — the morph transition's endpoints. */
  anchor?: (props: z.infer<S>, box: Box) => { in?: Anchor | null; out?: Anchor | null } | null;
  example: z.input<S>;
};

export const defineScene = <S extends z.ZodTypeAny>(d: SceneDef<S>) => d;

/** Layout units: u = 1 at 1080p-short-side, so every scene scales to 4K and to 9:16. */
export function useLayout(scale = 1) {
  const { width, height } = useVideoConfig();
  // `scale` lets UI-heavy scenes read larger than pure typography at the same resolution.
  const u = (Math.min(width, height) / 1080) * scale;
  const portrait = height > width;
  return { width, height, u, portrait, cx: width / 2, cy: height / 2 };
}
