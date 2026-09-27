import { interpolate } from "remotion";

/** Deterministic character-typing reveal — a pure function of frame, so it's
 * scrub/render-safe (unlike a real "typing" DOM effect driven by timers). */
export function typeText(
  frame: number,
  text: string,
  opts: { delay?: number; duration?: number },
) {
  const { delay = 0, duration = 20 } = opts;
  const chars = Math.round(
    interpolate(frame, [delay, delay + duration], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return text.slice(0, chars);
}
