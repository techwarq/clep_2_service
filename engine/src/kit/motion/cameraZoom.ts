import { interpolate } from "remotion";

/** Slow push-in over a scene's whole duration — the subtle "camera" motion
 * used behind almost every scene so nothing sits perfectly static. */
export function cameraZoom(
  frame: number,
  opts: { durationInFrames: number; from?: number; to?: number },
) {
  const { durationInFrames, from = 1, to = 1.05 } = opts;
  return interpolate(frame, [0, durationInFrames], [from, to]);
}
