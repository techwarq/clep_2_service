import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { progress } from "@/kit/motion";
import { Grain, Vignette } from "@/kit/ui/promo";
import { Paper } from "../clep-launch/bits";
import { NightSky, ColdOpen, Late, Works, NoDemo, Perform, Knows } from "./Night";
import { Built, Directed, Editor, Back, Showing, Sign } from "./Day";
import { L, FPS, DURATION } from "./time";

export const STORY_FPS = FPS;
export const STORY_DURATION = Math.round(DURATION * FPS);

// Clep launch film, told as a story: a late night, a launch tomorrow, a demo
// that doesn't exist — then dawn, and the product that shows itself. Night
// half on near-black, day half on the brand's paper; the cut between them is
// the line "So we built clep." Every shot is timed from timeline.json.
export const ClepStory: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const dawn = progress(t, L("built").start - 0.2, 2.2, "smooth");
  return (
    <AbsoluteFill>
      <NightSky />
      {dawn > 0 && (
        <AbsoluteFill style={{ opacity: dawn }}>
          <Paper />
        </AbsoluteFill>
      )}
      <ColdOpen t={t} />
      <Late t={t} />
      <Works t={t} />
      <NoDemo t={t} />
      <Perform t={t} />
      <Knows t={t} />
      <Built t={t} />
      <Directed t={t} />
      <Editor t={t} />
      <Back t={t} />
      <Showing t={t} />
      <Sign t={t} end={DURATION} />
      <Vignette k={1 - dawn * 0.75} />
      <Grain frame={frame} opacity={0.07 - dawn * 0.03} />
    </AbsoluteFill>
  );
};
