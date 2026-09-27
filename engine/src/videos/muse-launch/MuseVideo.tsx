import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ThemeProvider } from "@/kit/theme";
import { fontFamily } from "../../loadFont";
import { museTheme } from "./theme";
import { BrandIntro } from "./scenes/BrandIntro";
import { BrandHeadline } from "./scenes/BrandHeadline";
import { ChatIntro } from "./scenes/ChatIntro";
import { NoticeStack } from "./scenes/NoticeStack";
import { StatusCounter } from "./scenes/StatusCounter";
import { PermissionCard } from "./scenes/PermissionCard";
import { EndCard } from "./scenes/EndCard";

// One concrete video: the Muse brand launch spot, built entirely from
// src/kit/*. Scene order/durations here ARE the storyboard — edit these
// numbers directly rather than routing through a JSON spec (this video is
// hardcoded; the kit it's built from is what's reusable).
export const SCENES = [
  { name: "brand-intro", duration: 90, Component: BrandIntro },
  { name: "headline", duration: 75, Component: BrandHeadline },
  { name: "chat-intro", duration: 105, Component: ChatIntro },
  { name: "notice-stack", duration: 126, Component: NoticeStack },
  { name: "status-counter", duration: 150, Component: StatusCounter },
  { name: "permission-card", duration: 126, Component: PermissionCard },
  { name: "end-card", duration: 146, Component: EndCard },
] as const;

export const TOTAL_DURATION = SCENES.reduce((sum, s) => sum + s.duration, 0);

export const MuseVideo: React.FC = () => {
  let from = 0;
  return (
    <ThemeProvider theme={museTheme}>
      <AbsoluteFill style={{ fontFamily }}>
        {SCENES.map((scene) => {
          const el = (
            <Sequence key={scene.name} name={scene.name} from={from} durationInFrames={scene.duration}>
              <scene.Component durationInFrames={scene.duration} />
            </Sequence>
          );
          from += scene.duration;
          return el;
        })}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
