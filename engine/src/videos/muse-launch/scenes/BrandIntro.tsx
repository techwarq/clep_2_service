import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "@/kit/components";
import { popIn, slideIn, cameraZoom } from "@/kit/motion";
import { useKitTheme } from "@/kit/theme";

export const BrandIntro: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useKitTheme();

  const badge = popIn(frame, { fps, delay: 3 });
  const headline = slideIn(frame, { delay: 13, duration: 15, distance: 10, direction: "up" });
  const sub = slideIn(frame, { delay: 24, duration: 12, distance: 0 });
  const zoom = cameraZoom(frame, { durationInFrames });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "38%",
            transform: `translate(-50%,-50%) scale(${badge.scale})`,
            width: 120,
            height: 120,
            borderRadius: 30,
            background: "#fff",
            boxShadow: "0 24px 54px rgba(20,30,60,.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 54, color: theme.primary, transform: "skewX(-6deg)" }}>M</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "58%",
            transform: `translate(-50%,-50%) translateY(${headline.y}px)`,
            width: 1100,
            textAlign: "center",
            opacity: headline.opacity,
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: "-0.02em",
            color: theme.foreground,
          }}
        >
          AI that keeps you up-to-date
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "70%",
            transform: "translateX(-50%)",
            opacity: sub.opacity,
            color: theme.mutedForeground,
            fontWeight: 600,
            fontSize: 18,
          }}
        >
          from Meta
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
