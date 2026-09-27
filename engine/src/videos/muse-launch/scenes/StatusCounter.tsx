import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AvatarBadge, Background, Card, CardContent } from "@/kit/components";
import { popIn, cameraZoom } from "@/kit/motion";
import { useKitTheme } from "@/kit/theme";
import { CX } from "../theme";

const ITEMS = [
  { number: "18", status: "Updated flight SFO to DEN" },
  { number: "3", status: "Cancelled unused subscriptions" },
  { number: "47", status: "Emails triaged" },
];

export const StatusCounter: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useKitTheme();
  const slice = durationInFrames / ITEMS.length;
  const zoom = cameraZoom(frame, { durationInFrames, to: 1.03 });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {ITEMS.map((item, i) => {
          const s0 = i * slice;
          const fadeOutStart = s0 + slice - 9;
          const pop = popIn(frame, { fps, delay: s0 + 2 });
          const opacity =
            interpolate(frame, [s0, s0 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
            interpolate(frame, [fadeOutStart, fadeOutStart + 6], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

          return (
            <React.Fragment key={item.number + item.status}>
              <div
                style={{
                  position: "absolute",
                  left: CX - 320,
                  top: "50%",
                  transform: "translate(-50%,-50%)",
                  opacity,
                  fontWeight: 800,
                  fontSize: 130,
                  color: "#c9ccd1",
                }}
              >
                {item.number}
              </div>
              <Card
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%,-50%) scale(${pop.scale})`,
                  opacity,
                  width: 460,
                  borderRadius: 26,
                  background: theme.primary,
                  color: theme.primaryForeground,
                  textAlign: "center",
                  border: "none",
                  boxShadow: "0 26px 54px rgba(30,60,150,.3)",
                }}
              >
                <CardContent style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <AvatarBadge size={56} pad={6} />
                  <div style={{ fontWeight: 700, fontSize: 21 }}>{item.status}</div>
                </CardContent>
              </Card>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
