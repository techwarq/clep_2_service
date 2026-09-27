import { Easing } from "remotion";

/**
 * One easing vocabulary shared by Remotion interpolate() and GSAP tweens, so
 * a spec / director note like `"ease": "expo"` means the same curve no matter
 * which animation system a scene uses. The bezier values are the curves motion
 * designers actually dial into After Effects' graph editor.
 */
export const EASE_BEZIER = {
  linear: [0, 0, 1, 1],
  easy: [0.33, 0, 0.67, 1], // AE "Easy Ease" (F9)
  out: [0.215, 0.61, 0.355, 1], // cubic out
  in: [0.55, 0.055, 0.675, 0.19],
  inOut: [0.645, 0.045, 0.355, 1],
  expo: [0.16, 1, 0.3, 1], // fast start, long settle — the "premium" UI feel
  expoInOut: [0.87, 0, 0.13, 1],
  snappy: [0.7, 0, 0.2, 1], // hard accelerate, hard brake — whip pans, slams
  cut: [0.6, 0.02, 0.25, 1], // transitions: quick through the middle but spread over the whole move (no 3-frame blip)
  reveal: [0.55, 0.05, 0.35, 1], // wipes / masks: even, readable sweep
  smooth: [0.45, 0, 0.1, 1], // camera moves
  overshoot: [0.34, 1.56, 0.64, 1], // back-out, pops past target then settles
  anticipate: [0.36, 0, 0.66, -0.56], // back-in, dips before leaving
} as const;

export type EaseName = keyof typeof EASE_BEZIER;
export const EASE_NAMES = Object.keys(EASE_BEZIER) as EaseName[];

export function ease(name: EaseName = "easy") {
  const [a, b, c, d] = EASE_BEZIER[name] ?? EASE_BEZIER.easy;
  return Easing.bezier(a, b, c, d);
}

/** GSAP ease string for the same curve (registered via CustomEase in gsap.ts). */
export function gsapEase(name: EaseName = "easy") {
  return name === "linear" ? "none" : `kit.${name}`;
}
