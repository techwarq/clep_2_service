import { interpolate } from "remotion";
import { ease, EaseName } from "./easing";

/** A keyframe: [frame, value, easing INTO this key]. */
export type Key = [number, number, EaseName?];

/**
 * AE-style keyframe track: each segment gets its own easing (the curve used to
 * arrive at that key), unlike a single interpolate() call. Clamped both ends.
 *
 *   kf(frame, [[0, 0], [12, 1, "expo"], [40, 1], [52, 0, "in"]])
 */
export function kf(frame: number, keys: Key[]): number {
  if (keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (frame <= f1) {
      if (f1 === f0) return v1;
      return interpolate(frame, [f0, f1], [v0, v1], {
        easing: ease(e ?? "easy"),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }
  return keys[keys.length - 1][1];
}

/** 0→1 progress over [start, start+duration] (seconds) with easing. Durations under 1s are real — UI moves live at 0.2–0.5s. */
export function progress(frame: number, start: number, duration: number, e: EaseName = "easy") {
  return interpolate(frame, [start, start + Math.max(1e-3, duration)], [0, 1], {
    easing: ease(e),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Deterministic pseudo-random in [0,1) from a numeric seed. */
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
