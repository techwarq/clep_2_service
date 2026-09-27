import { interpolate } from "remotion";

export type SlideDirection = "up" | "down" | "left" | "right";

/** Fade + short directional slide entrance — the workhorse for text/captions. */
export function slideIn(
  frame: number,
  opts: { delay?: number; duration?: number; distance?: number; direction?: SlideDirection },
) {
  const { delay = 0, duration = 10, distance = 16, direction = "up" } = opts;
  const p = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const offset = (1 - p) * distance;
  const x = direction === "left" ? offset : direction === "right" ? -offset : 0;
  const y = direction === "up" ? offset : direction === "down" ? -offset : 0;
  return { opacity: p, x, y };
}
