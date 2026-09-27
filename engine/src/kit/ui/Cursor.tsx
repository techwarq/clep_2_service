import React from "react";
import { springTrack } from "../motion/springTrack";
import { clamp01 } from "../motion/keyframes";
import { useKitTheme } from "../theme/ThemeProvider";
import { alpha } from "../lib/color";

export type CursorPoint = { t: number; x: number; y: number; click?: boolean };

/**
 * Hand-animated cursor: spring-driven path through points (px, seconds), with
 * a press-scale and ripple on every `click`. Positions are in the parent's
 * coordinate space, so drop it inside the same box as the UI it clicks.
 */
export function useCursor(points: CursorPoint[], t: number) {
  const pts = points.length ? points : [{ t: 0, x: 0, y: 0 }];
  const xs = springTrack(pts.map((p) => ({ t: p.t, v: p.x })), 14, 0.9);
  const ys = springTrack(pts.map((p) => ({ t: p.t, v: p.y })), 14, 0.9);
  const clicks = pts.filter((p) => p.click).map((p) => p.t + 0.35);
  const lastClick = [...clicks].reverse().find((c) => t >= c);
  const sinceClick = lastClick === undefined ? 99 : t - lastClick;
  const pressed = clicks.some((c) => t >= c - 0.08 && t < c + 0.1);
  return { x: xs(t), y: ys(t), sinceClick, pressed, clicked: (at: number) => clicks.some((c) => t >= c && Math.abs(c - at) < 0.6) };
}

export const Cursor: React.FC<{
  x: number;
  y: number;
  pressed?: boolean;
  sinceClick?: number;
  opacity?: number;
  scale?: number;
  variant?: "arrow" | "hand";
}> = ({ x, y, pressed, sinceClick = 99, opacity = 1, scale = 1 }) => {
  const theme = useKitTheme();
  const rp = clamp01(sinceClick / 0.45);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, pointerEvents: "none", zIndex: 50 }}>
      {sinceClick < 0.45 && (
        <div
          style={{
            position: "absolute",
            left: -30 * rp - 6,
            top: -30 * rp - 6,
            width: 60 * rp + 12,
            height: 60 * rp + 12,
            borderRadius: "50%",
            border: `2.5px solid ${alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 1 - rp)}`,
          }}
        />
      )}
      <svg
        width={30 * scale}
        height={30 * scale}
        viewBox="0 0 24 24"
        style={{
          transform: `translate(-3px,-2px) scale(${pressed ? 0.85 : 1})`,
          transformOrigin: "3px 2px",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,.3))",
        }}
      >
        <path d="M4 2 L4 19 L8.6 14.8 L11.6 21.4 L14.4 20.2 L11.4 13.7 L17.6 13.4 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
};
