import type { SceneT, TransitionT, VideoSpecT } from "./spec";
import { resolveStyle } from "./styles";

export type TimelineEntry = {
  scene: SceneT;
  index: number;
  /** Absolute start frame in the final video. */
  from: number;
  frames: number;
  /** Transition into the NEXT scene (frames 0 = hard cut). */
  transition: Partial<TransitionT> & { frames: number };
};

/**
 * Single source of truth for timing, shared by calculateMetadata, SpecVideo
 * and the director's still/storyboard renderer. Transitions overlap adjacent
 * scenes, so they're clamped to half the shorter neighbour.
 */
export function buildTimeline(spec: VideoSpecT, fps: number) {
  const style = resolveStyle(spec.style, spec.styleOverrides);
  const entries: TimelineEntry[] = [];
  let cursor = 0;
  spec.scenes.forEach((scene, i) => {
    const frames = Math.max(1, Math.round(scene.duration * fps));
    const next = spec.scenes[i + 1];
    const tr = { ...style.transition, ...(scene.transition ?? {}) };
    let tFrames = 0;
    if (next && tr.type && tr.type !== "cut") {
      const nextFrames = Math.round(next.duration * fps);
      tFrames = Math.max(1, Math.min(Math.round((tr.duration ?? 0.4) * fps), Math.floor(Math.min(frames, nextFrames) / 2)));
    }
    entries.push({ scene, index: i, from: cursor, frames, transition: { ...tr, frames: tFrames } });
    cursor += frames - tFrames;
  });
  const last = entries[entries.length - 1];
  const total = last ? last.from + last.frames : 1;
  return { entries, total, style };
}
