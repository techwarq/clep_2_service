import { spring, interpolate } from "remotion";

/** Spring scale+opacity entrance — the "pop" used for badges, cards, buttons. */
export function popIn(
  frame: number,
  opts: { fps: number; delay?: number; damping?: number; stiffness?: number },
) {
  const { fps, delay = 0, damping = 12, stiffness = 150 } = opts;
  const scale = spring({ frame: frame - delay, fps, config: { damping, stiffness } });
  const opacity = interpolate(frame, [delay, delay + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { scale, opacity };
}
