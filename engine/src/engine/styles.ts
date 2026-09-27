import type { EaseName } from "@/kit/motion/easing";
import type { BackgroundT, CameraT, TransitionT } from "./spec";

/**
 * Style presets = the "reference video" layer. Naming a style beats
 * describing one: each preset encodes the pacing, type treatment, camera
 * language and transitions of a recognizable launch-video look, so the
 * director picks "kinetic-bold" instead of guessing at "make it energetic".
 *
 * `references` are the real-world looks each preset is tuned to — the LLM is
 * told to map a user's reference video (whatships.com etc.) onto the closest
 * preset, then use styleOverrides for the rest.
 */
export type StylePreset = {
  label: string;
  description: string;
  references: string[];
  /** Forces the palette mode regardless of brand ("dark keynote" on a light brand). */
  mode?: "light" | "dark";
  background: BackgroundT;
  transition: Pick<TransitionT, "type" | "duration"> & Partial<TransitionT>;
  camera: Partial<CameraT>;
  ease: EaseName;
  /** Default title animation for kinetic text scenes. */
  titleAnim: "mask" | "words" | "chars" | "slam" | "scramble" | "blur" | "stream" | "pullout" | "build";
  uppercase: boolean;
  /** Headline letter-spacing (em). */
  tracking: number;
  /** Headline weight. */
  weight: number;
  /** Multiplier on headline size. */
  typeScale: number;
  /** Typical scene length range in seconds — pacing guidance for the director. */
  sceneSeconds: [number, number];
  grain: number;
  /** Stagger between items/words (s). */
  stagger: number;
  /** Full-frame finishing layers (kit/components/Overlays): halftone, scanlines, vhs, sparkles, focuslines… */
  overlays?: string[];
  /** Headline treatment for display-font text: outline, offset-shadow, outline-shadow, glow, gradient, chrome. */
  textEffect?: string;
  /** Display font width vs a normal sans (1 = Inter-like; Dela Gothic ≈ 1.35) — every text fit uses it. */
  fontWidth?: number;
  /** The family of transitions an editor would use for this look, varied cut to cut (first = signature). */
  transitionSet?: string[];
  /** Accent words get a hand-drawn underline that writes on once they land. */
  accentMark?: boolean;
};

export const STYLES: Record<string, StylePreset> = {
  "clean-saas": {
    label: "Clean SaaS launch",
    description:
      "Bright, precise, product-first. Subtle grid, soft shadows, real UI in focus. Smooth push-ins, blur/fade transitions, expo easing, word-by-word mask reveals.",
    references: ["Linear launch videos", "Vercel Ship", "Raycast", "Notion feature drops"],
    background: { kind: "grid" },
    transition: { type: "blur", duration: 0.45 },
    camera: { move: "push_in", amount: 0.05 },
    ease: "expo",
    titleAnim: "mask",
    uppercase: false,
    tracking: -0.035,
    weight: 700,
    typeScale: 1,
    sceneSeconds: [2.2, 4.5],
    grain: 0,
    stagger: 0.06,
    transitionSet: ["zoom", "push", "blur", "strips"],
  },
  "dark-keynote": {
    label: "Dark keynote",
    description:
      "Apple-event cinematic. Near-black with a soft spotlight, huge tight type, slow elegant camera drifts, long blur dissolves, generous holds.",
    references: ["Apple product films", "OpenAI launch films", "Arc browser"],
    mode: "dark",
    background: { kind: "spotlight" },
    transition: { type: "blur", duration: 0.7 },
    camera: { move: "push_in", amount: 0.07, ease: "smooth" },
    ease: "smooth",
    titleAnim: "blur",
    uppercase: false,
    tracking: -0.045,
    weight: 600,
    typeScale: 1.15,
    sceneSeconds: [3, 5.5],
    grain: 0.04,
    stagger: 0.09,
    transitionSet: ["blur", "zoom", "dip"],
  },
  "kinetic-bold": {
    label: "Kinetic bold",
    description:
      "High-energy social cut. Hard cuts and whip pans on the beat, slammed uppercase type, rapid word flashes, punch-in zooms, flat high-contrast color blocks.",
    references: ["Figma Config promos", "Nike-style kinetic type", "YC launch reels", "Gumroad"],
    background: { kind: "flat" },
    transition: { type: "cut", duration: 0 },
    camera: { move: "punch_in", amount: 0.06 },
    ease: "snappy",
    titleAnim: "slam",
    uppercase: true,
    tracking: -0.02,
    weight: 800,
    typeScale: 1.2,
    sceneSeconds: [1.2, 3],
    grain: 0,
    stagger: 0.035,
    transitionSet: ["whip", "slash", "strips", "glitch"],
  },
  "editorial-paper": {
    label: "Editorial paper",
    description:
      "Magazine / whiteboard explainer. Warm paper grain, big serif display type, ink-black and one rust accent, hard cuts, minimal camera.",
    references: ["Stripe Press", "The Browser Company explainers", "Every.to"],
    mode: "light",
    background: { kind: "paper" },
    transition: { type: "cut", duration: 0 },
    camera: { move: "drift", amount: 0.02 },
    ease: "out",
    titleAnim: "words",
    uppercase: false,
    tracking: -0.02,
    weight: 600,
    typeScale: 1.05,
    sceneSeconds: [2.5, 4.5],
    grain: 0.08,
    stagger: 0.07,
    transitionSet: ["push", "dip", "cut"],
  },
  "neon-tech": {
    label: "Neon dev-tool",
    description:
      "Dark terminal aesthetic for dev tools and AI infra. Dot grid, glowing accent, mono labels, scramble text, whip transitions, code and terminal scenes.",
    references: ["Supabase Launch Week", "Warp", "Cursor", "Resend"],
    mode: "dark",
    background: { kind: "dots" },
    transition: { type: "whip", duration: 0.35 },
    camera: { move: "push_in", amount: 0.06 },
    ease: "expo",
    titleAnim: "scramble",
    uppercase: false,
    tracking: -0.03,
    weight: 700,
    typeScale: 1,
    sceneSeconds: [1.8, 3.8],
    grain: 0.03,
    stagger: 0.04,
    transitionSet: ["glitch", "whip", "zoom"],
  },
  "soft-brand": {
    label: "Soft consumer brand",
    description:
      "Friendly consumer-app look. Airy gradient with blurred blobs, rounded cards, springy pop-ins, gray chat/notification bubbles, gentle zooms.",
    references: ["Meta Muse site", "Headspace", "Duolingo", "iOS feature videos"],
    mode: "light",
    background: { kind: "blobs" },
    transition: { type: "fade", duration: 0.4 },
    camera: { move: "push_in", amount: 0.04 },
    ease: "overshoot",
    titleAnim: "words",
    uppercase: false,
    tracking: -0.025,
    weight: 800,
    typeScale: 1,
    sceneSeconds: [2.5, 4.5],
    grain: 0,
    stagger: 0.07,
    transitionSet: ["push", "circle", "blur"],
  },
  // Measured from launch films that did 0.5–5M views on X (T:0, Listen, Aside, Wonder): one flat ground
  // in the brand's color, big type that arrives a word at a time, long shots that move inside
  // themselves, hard cuts and pushes instead of dissolves.
  "story-film": {
    label: "Story film",
    description:
      "Founder-launch film. Flat brand-colored ground, no gradients or blobs. Text is the narrator: big type, words arriving one at a time, accent words underlined by a hand-drawn stroke. The product works in long, slowly pushing shots. Hard cuts and pushes, no dissolves.",
    references: ["T:0 launch", "Listen Labs $100M", "Aside browser", "Wonder", "Browserbase"],
    background: { kind: "flat" },
    transition: { type: "cut", duration: 0 },
    camera: { move: "push_in", amount: 0.035, ease: "smooth" },
    ease: "expo",
    titleAnim: "stream",
    uppercase: false,
    tracking: -0.035,
    weight: 600,
    typeScale: 1.1,
    sceneSeconds: [3, 7],
    grain: 0,
    stagger: 0.16,
    transitionSet: ["cut", "morph", "push", "zoom"],
    accentMark: true,
  },
};

// Anime launch trailer: slammed outlined type, focus lines, impact frames, halftone print, camera shake.
STYLES["anime"] = {
  label: "Anime",
  description:
    "Anime opening / manga panel energy. Speed-line backdrops, impact-frame cuts, slammed outlined type with hard offset shadows, halftone print texture, sparkles, punch-ins with shake.",
  references: ["anime OP title cards", "shonen manga panels", "Studio Trigger trailers"],
  mode: "light",
  background: { kind: "speedlines" },
  transition: { type: "impact", duration: 0.35 },
  camera: { move: "punch_in", amount: 0.08, shake: 3 },
  ease: "snappy",
  titleAnim: "slam",
  uppercase: true,
  tracking: -0.01,
  weight: 900,
  typeScale: 1.15,
  sceneSeconds: [1.2, 2.8],
  grain: 0,
  stagger: 0.03,
  overlays: ["halftone", "sparkles"],
  textEffect: "outline-shadow",
  fontWidth: 1.35,
  transitionSet: ["slash", "impact", "whip", "zoom"],
};

export const STYLE_NAMES = Object.keys(STYLES);

export function resolveStyle(name: string, overrides?: Record<string, unknown>): StylePreset {
  const base = STYLES[name] ?? STYLES["clean-saas"];
  return { ...base, ...(overrides as Partial<StylePreset>) };
}
