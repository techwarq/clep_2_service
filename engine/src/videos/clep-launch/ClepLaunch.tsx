import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { progress } from "@/kit/motion";
import { Paper } from "./bits";
import { Hook, Grind, CHECKBOX } from "./Hook";
import { Pivot, Meet } from "./Reveal";
import { Agent } from "./Agent";
import { Output, Close } from "./Film";
import { FPS, DURATION } from "./theme";

export const CLEP_FPS = FPS;
export const CLEP_DURATION = Math.round(DURATION * FPS);

/** Circular mask reveal growing from (x, y). */
const Iris: React.FC<{ t: number; at: number; dur: number; x: number; y: number; children: React.ReactNode }> = ({ t, at, dur, x, y, children }) => {
  const k = progress(t, at, dur, "expoInOut");
  return <AbsoluteFill style={{ clipPath: k >= 1 ? undefined : `circle(${k * 2300}px at ${x}px ${y}px)` }}>{children}</AbsoluteFill>;
};

// Clep launch film — every shot is recreated UI (no screen recordings), timed
// to the voiceover in timeline.json. Scenes overlap so transitions are
// morphs, irises and pushes rather than hard cuts.
export const ClepLaunch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const on = (a: number, b: number) => t >= a && t < b;
  return (
    <AbsoluteFill>
      <Paper />
      {on(0, 5.7) && <Hook t={t} />}
      {on(5.15, 16.5) && (
        <Iris t={t} at={5.15} dur={0.5} x={CHECKBOX.x} y={CHECKBOX.y}>
          <Grind t={t} />
        </Iris>
      )}
      {on(16.0, 21.5) && (
        <Iris t={t} at={16.0} dur={0.5} x={960} y={540}>
          <Pivot t={t} />
        </Iris>
      )}
      {on(20.9, 25.35) && <Meet t={t} />}
      {on(25.1, 35.5) && <Agent t={t} />}
      {on(34.95, 41.3) && <Output t={t} />}
      {on(41.0, 48.1) && <Close t={t} />}
    </AbsoluteFill>
  );
};
