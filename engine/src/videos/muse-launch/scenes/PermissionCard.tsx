import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AvatarBadge, Background, Button, Card, CardContent, ShimmerButton } from "@/kit/components";
import { popIn, cameraZoom } from "@/kit/motion";
import { useKitTheme } from "@/kit/theme";

const ITEMS = [
  { name: "Explorer Backpack", meta: "Home Store — $34" },
  { name: "Washable Glue", meta: "Home Store — $1.50" },
];

const Row: React.FC<{ name: string; meta: string }> = ({ name, meta }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0" }}>
    <div style={{ width: 44, height: 44, borderRadius: 10, background: "#eef1f5", flex: "none" }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{name}</div>
      <div style={{ fontSize: 12, color: "#8b8f96" }}>{meta}</div>
    </div>
  </div>
);

const Divider = () => <div style={{ height: 1, background: "rgba(0,0,0,.07)", margin: "10px 0" }} />;

export const PermissionCard: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const theme = useKitTheme();
  const zoom = cameraZoom(frame, { durationInFrames, to: 1.03 });

  const cardOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardScale = interpolate(frame, [0, 12, 24, 36], [0.9, 0.94, 0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const perm = popIn(frame, { fps: 30, delay: 9 });

  const btnDelay = 21;
  const denyOpacity = interpolate(frame, [btnDelay, btnDelay + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const allowOpacity = interpolate(frame, [btnDelay + 2, btnDelay + 11], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Card
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%,-50%) scale(${cardScale})`,
            opacity: cardOpacity,
            width: 420,
            borderRadius: 26,
            boxShadow: "0 34px 74px rgba(20,30,60,.22)",
          }}
        >
          <CardContent>
            {ITEMS.map((it) => (
              <Row key={it.name} name={it.name} meta={it.meta} />
            ))}
            <Divider />
            <Row name="Credit card •••• 1234" meta="" />
            <Divider />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 19 }}>
              <span>Estimated total</span>
              <span>$47.80</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
              <Button
                variant="secondary"
                style={{ flex: 1, height: 50, borderRadius: 25, fontSize: 15, opacity: denyOpacity }}
              >
                Deny
              </Button>
              <div style={{ flex: 1, opacity: allowOpacity }}>
                <ShimmerButton borderRadius="25px" className="h-[50px] w-full text-[15px] font-bold">
                  Allow
                </ShimmerButton>
              </div>
            </div>
          </CardContent>
        </Card>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(50% - 220px)",
            transform: `translate(-50%,0) scale(${perm.scale})`,
            opacity: perm.opacity,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: theme.card,
            borderRadius: 20,
            padding: "10px 18px 10px 12px",
            boxShadow: "0 22px 44px rgba(20,30,60,.22)",
          }}
        >
          <AvatarBadge size={40} pad={5} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: theme.cardForeground }}>Muse</div>
            <div style={{ fontSize: 12, color: theme.mutedForeground, display: "flex", alignItems: "center", gap: 4 }}>
              <span>🔒</span>
              <span>Waiting for permission</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
