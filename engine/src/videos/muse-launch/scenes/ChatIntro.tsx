import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AvatarBadge, Background } from "@/kit/components";
import { popIn, slideIn, typeText, cameraZoom } from "@/kit/motion";
import { useKitTheme } from "@/kit/theme";

const TYPED = "Help me start training for a 10k";

export const ChatIntro: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useKitTheme();

  const pill = slideIn(frame, { delay: 6, duration: 12, distance: 10, direction: "up" });
  const typeStart = 9;
  const typeDur = 42;
  const shown = typeText(frame, TYPED, { delay: typeStart, duration: typeDur });

  const headStart = typeStart + typeDur + 15;
  const head = popIn(frame, { fps, delay: headStart });
  const zoom = cameraZoom(frame, { durationInFrames, to: 1.04 });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "62%",
            transform: `translate(-50%,-50%) translateY(${pill.y}px)`,
            opacity: pill.opacity,
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: theme.secondary,
            borderRadius: 24,
            padding: "14px 24px",
            fontSize: 22,
            fontWeight: 600,
            color: theme.secondaryForeground,
            boxShadow: "0 12px 26px rgba(20,30,60,.08)",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 24 }}>+</span>
          <span>{shown}</span>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "34%",
            transform: `translate(-50%,-50%) scale(${head.scale})`,
            opacity: head.opacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <AvatarBadge size={84} />
          <div
            style={{
              background: theme.card,
              borderRadius: 22,
              padding: "10px 24px",
              fontWeight: 800,
              fontSize: 22,
              color: theme.cardForeground,
              boxShadow: "0 16px 34px rgba(20,30,60,.15)",
            }}
          >
            Muse
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
