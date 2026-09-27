import { z } from "zod";
import { EASE_NAMES, EaseName } from "@/kit/motion/easing";

/**
 * THE contract. One VideoSpec JSON fully describes a video: format, brand,
 * style (the "reference"), audio, and an ordered list of scenes picked from
 * the scene registry. The director (LLM or human) only ever writes this; the
 * engine renders it. Every director note ("slow every zoom to 0.7x", "hard cut
 * here", "push in on the button") maps onto a field below — nothing requires
 * touching scene code.
 */

const Ease = z.enum(EASE_NAMES as [EaseName, ...EaseName[]]);

export const FontRef = z.object({
  family: z.string(),
  /** Font file inside the project's assets dir (woff2/ttf). Omit for Google Fonts / system. */
  src: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  google: z.boolean().optional(),
  /** The face is italic (e.g. an italic-only serif used for accent words). */
  italic: z.boolean().optional(),
});

export const Brand = z.object({
  name: z.string(),
  url: z.string().optional(),
  tagline: z.string().optional(),
  logo: z.string().optional(),
  logoOnDark: z.string().optional(),
  /** Square app-icon mark (asset). Used by LogoMark and, with `wordmark`, to compose the logo when there's no logo image. */
  mark: z.string().optional(),
  /** How to set the brand name as a wordmark next to the mark. */
  wordmark: z
    .object({ text: z.string().optional(), font: FontRef.optional(), weight: z.number().optional(), tracking: z.number().optional() })
    .optional(),
  mode: z.enum(["light", "dark"]).optional(),
  colors: z.object({
    background: z.string(),
    foreground: z.string(),
    primary: z.string(),
    primaryForeground: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    card: z.string().optional(),
    muted: z.string().optional(),
  }),
  fonts: z
    .object({ display: FontRef.optional(), body: FontRef.optional(), mono: FontRef.optional(), accent: FontRef.optional() })
    .default({}),
  radius: z.number().optional(),
  /** Accent words in italic (editorial serif brands). */
  accentItalic: z.boolean().optional(),
  /** Real product screenshots (asset paths) the scenes can reference. */
  screenshots: z.array(z.string()).default([]),
});

export const CAMERA_MOVES = [
  "none",
  "push_in",
  "pull_out",
  "drift",
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "punch_in",
  "dutch",
] as const;

export const CameraKey = z.object({
  /** Seconds from scene start. */
  at: z.number(),
  zoom: z.number().default(1),
  /** Point of the frame to look at, as fractions [x, y] (0.5,0.5 = center). */
  focus: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),
  rotate: z.number().default(0),
  ease: Ease.default("smooth"),
});

export const Camera = z.object({
  move: z.enum(CAMERA_MOVES).default("none"),
  /** Strength of the preset move (push_in 0.08 = 8% zoom over the scene). */
  amount: z.number().optional(),
  /** Time scale for the move: 0.7 = 30% slower. */
  speed: z.number().default(1),
  ease: Ease.optional(),
  /** Where preset moves zoom toward (fractions). */
  focus: z.tuple([z.number(), z.number()]).optional(),
  /** Explicit keyframed camera — overrides `move`. "push in on the button" = a key zooming to its focus. */
  keys: z.array(CameraKey).optional(),
  /** Handheld shake amplitude in px (0 = locked off). */
  shake: z.number().default(0),
  motionBlur: z.boolean().default(false),
});

export const TRANSITIONS = [
  "cut",
  "fade",
  "blur",
  "slide",
  "push",
  "wipe",
  "whip",
  "zoom",
  "flash",
  "flip",
  "iris",
  "clock",
  "impact",
  "strips",
  "slash",
  "glitch",
  "leak",
  "dip",
  "circle",
  "morph",
] as const;

export const Transition = z.object({
  type: z.enum(TRANSITIONS).default("cut"),
  /** Seconds (ignored for cut). */
  duration: z.number().default(0.4),
  direction: z.enum(["left", "right", "up", "down"]).default("left"),
  ease: Ease.optional(),
});

export const BACKGROUNDS = [
  "flat",
  "gradient",
  "blobs",
  "grid",
  "dots",
  "spotlight",
  "paper",
  "aurora",
  "noise",
  "image",
  "mesh",
  "speedlines",
  "sunburst",
  "halftone",
  "hairlines",
  "haze",
] as const;

export const Background = z.object({
  kind: z.enum(BACKGROUNDS),
  /** For kind=image: asset path. */
  src: z.string().optional(),
  /** 0–1 overlay dim for image backgrounds. */
  dim: z.number().optional(),
  /** Custom colors for gradient/mesh/aurora backdrops (e.g. a brand's pastel gradient). */
  colors: z.array(z.string()).max(4).optional(),
  /** Gradient angle in degrees. */
  angle: z.number().optional(),
});

export const Sfx = z.object({ src: z.string(), at: z.number().default(0), volume: z.number().default(1) });

export const Scene = z.object({
  id: z.string().optional(),
  type: z.string(),
  /** Seconds. */
  duration: z.number().positive(),
  props: z.record(z.string(), z.unknown()).default({}),
  /** Transition INTO the next scene. Omit to use the style default. */
  transition: Transition.partial().optional(),
  camera: Camera.partial().optional(),
  background: Background.optional(),
  /** base = brand colors, inverse = swap light/dark, primary = brand color as the backdrop. */
  tone: z.enum(["base", "inverse", "primary"]).optional(),
  /** Animation time scale for everything inside the scene (0.7 = slower, 1.3 = snappier). */
  speed: z.number().positive().optional(),
  sfx: z.array(Sfx).optional(),
  /** Free-text director intent — carried for the LLM, ignored by the renderer. */
  notes: z.string().optional(),
});

export const VideoSpec = z.object({
  version: z.literal(1).default(1),
  title: z.string().default("Untitled"),
  format: z
    .object({
      width: z.number().int().default(1920),
      height: z.number().int().default(1080),
      fps: z.number().int().default(30),
    })
    .default({ width: 1920, height: 1080, fps: 30 }),
  style: z.string().default("clean-saas"),
  /** Per-video overrides layered on top of the style preset. */
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
  brand: Brand,
  audio: z
    .object({
      voiceover: z.string().optional(),
      music: z.string().optional(),
      musicVolume: z.number().default(0.25),
      voiceVolume: z.number().default(1),
      /** Duck music under voiceover. */
      duck: z.boolean().default(true),
    })
    .optional(),
  /** Global time scale multiplied into every scene's speed. */
  speed: z.number().positive().default(1),
  grain: z.number().optional(),
  scenes: z.array(Scene).min(1),
});

export type VideoSpecT = z.infer<typeof VideoSpec>;
export type SceneT = z.infer<typeof Scene>;
export type CameraT = z.infer<typeof Camera>;
export type TransitionT = z.infer<typeof Transition>;
export type BrandT = z.infer<typeof Brand>;
export type BackgroundT = z.infer<typeof Background>;
