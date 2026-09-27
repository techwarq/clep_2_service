import React, { createContext, useContext } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { StylePreset } from "./styles";
import { STYLES } from "./styles";

type Ctx = { speed: number; durationInFrames: number; style: StylePreset; preroll?: number };

const SceneCtx = createContext<Ctx>({ speed: 1, durationInFrames: 90, style: STYLES["clean-saas"] });

export const SceneProvider: React.FC<Ctx & { children: React.ReactNode }> = ({ children, ...v }) => (
  <SceneCtx.Provider value={v}>{children}</SceneCtx.Provider>
);

export const useScene = () => useContext(SceneCtx);
export const useStyle = () => useContext(SceneCtx).style;

/**
 * Scene-local animation clock. Scenes animate off `t` (seconds) and `f`
 * (speed-scaled frames) instead of raw useCurrentFrame(), so a director note
 * like "slow this scene to 0.7x" is one number in the spec.
 *   dur = scene length in (scaled) seconds; left = seconds until the scene ends.
 */
export function useSceneTime() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { speed, durationInFrames, preroll = 0 } = useScene();
  // preroll: frames of head start while the incoming transition is still running, so entrance
  // animations are already landing at the cut instead of starting on an empty frame.
  const fr = frame + preroll;
  const t = (fr / fps) * speed;
  const dur = ((durationInFrames + preroll) / fps) * speed;
  return { t, f: fr * speed, fps, dur, left: dur - t, speed, frame: fr };
}
