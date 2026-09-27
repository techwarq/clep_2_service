import { interpolate } from "remotion";

/** Exit animation: slides sideways and fades out, staggered per-item — used
 * for notification stacks / dismissable cards. */
export function peelAway(
  frame: number,
  opts: { start: number; duration?: number; distance?: number; direction?: "left" | "right" },
) {
  const { start, duration = 12, distance = 220, direction = "right" } = opts;
  const p = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = (direction === "right" ? 1 : -1) * distance * p;
  return { opacity: 1 - p, x };
}
