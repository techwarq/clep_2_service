import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "@/kit/components";
import { staggerWords, cameraZoom } from "@/kit/motion";
import { useKitTheme } from "@/kit/theme";

const LINES = ["A new kind", "of AI"];

export const BrandHeadline: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const theme = useKitTheme();
  const zoom = cameraZoom(frame, { durationInFrames, to: 1.04 });

  let t = 5;
  const lines = LINES.map((line) => {
    const words = staggerWords(frame, line, { startDelay: t });
    t += words.length * 6 + 5;
    return words;
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ transform: `scale(${zoom})`, alignItems: "center", justifyContent: "center" }}>
        <div style={{ padding: "0 200px", textAlign: "center" }}>
          {lines.map((words, li) => (
            <div
              key={li}
              style={{ fontWeight: 800, fontSize: 64, lineHeight: 1.16, letterSpacing: "-0.02em", color: theme.foreground }}
            >
              {words.map(({ word, opacity, y }, wi) => (
                <span key={wi} style={{ display: "inline-block", opacity, transform: `translateY(${y}px)` }}>
                  {word}&nbsp;
                </span>
              ))}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
