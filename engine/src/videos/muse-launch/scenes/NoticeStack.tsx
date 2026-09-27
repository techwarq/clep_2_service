import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "@/kit/components";
import { popIn, peelAway, typeText } from "@/kit/motion";
import { useKitTheme } from "@/kit/theme";
import { CX, CY } from "../theme";

const CAPTION_LINES = ["Too many tabs.", "Too many tasks."];
const NOTIFICATIONS = ["Calendar clash", "Unpaid bill", "47 emails", "Reservation problem"];
const DEVICE_CX = CX + 260;

export const NoticeStack: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useKitTheme();
  const peelStart = durationInFrames * 0.7;

  return (
    <AbsoluteFill>
      <Background />
      <div style={{ position: "absolute", left: 260, top: "50%", transform: "translateY(-50%)" }}>
        <div style={{ fontWeight: 700, fontSize: 30, color: theme.mutedForeground }}>
          {typeText(frame, CAPTION_LINES[0], { delay: 5, duration: 26 })}
        </div>
        <div style={{ fontWeight: 700, fontSize: 30, color: theme.foreground }}>
          {typeText(frame, CAPTION_LINES[1], { delay: 38, duration: 26 })}
        </div>
      </div>

      {NOTIFICATIONS.map((note, i) => {
        const pop = popIn(frame, { fps, delay: 6 + i * 7 });
        const peel = peelAway(frame, { start: peelStart + i * 2 });

        return (
          <div
            key={note}
            style={{
              position: "absolute",
              left: DEVICE_CX,
              top: CY - 140 + i * 74,
              transform: `translate(-50%,0) scale(${pop.scale}) translateX(${peel.x}px)`,
              opacity: pop.opacity * peel.opacity,
              background: theme.secondary,
              borderRadius: 24,
              padding: "14px 22px",
              fontWeight: 600,
              fontSize: 18,
              color: theme.secondaryForeground,
              boxShadow: "0 10px 24px rgba(20,30,60,.08)",
            }}
          >
            {note}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
