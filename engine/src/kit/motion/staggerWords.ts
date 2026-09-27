import { interpolate } from "remotion";

/** Word-by-word reveal for headlines. Returns one entry per word with its own
 * opacity/y so the caller just maps and renders <span>s. */
export function staggerWords(
  frame: number,
  text: string,
  opts: { startDelay?: number; perWordFrames?: number; riseFrames?: number } = {},
) {
  const { startDelay = 0, perWordFrames = 6, riseFrames = 10 } = opts;
  return text.split(" ").map((word, i) => {
    const delay = startDelay + i * perWordFrames;
    const opacity = interpolate(frame, [delay, delay + riseFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const y = interpolate(frame, [delay, delay + riseFrames], [22, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { word, opacity, y };
  });
}
