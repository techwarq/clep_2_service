import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { useKitTheme } from "../theme/ThemeProvider";
import { alpha, mix } from "../lib/color";
import { FocusLines } from "./Overlays";

export type BackgroundKind =
  | "flat"
  | "gradient"
  | "blobs"
  | "grid"
  | "dots"
  | "spotlight"
  | "paper"
  | "aurora"
  | "noise"
  | "image"
  | "mesh"
  | "speedlines"
  | "sunburst"
  | "halftone"
  | "hairlines"
  | "haze";

const BLOB_POSITIONS: [number, number, number][] = [
  [0.08, 0.12, 520],
  [0.86, 0.7, 620],
  [0.5, 0.95, 460],
];

/**
 * Scene backdrop library. Every kind derives its colors from the active
 * KitTheme, so the same spec re-skins cleanly for any brand. Slow built-in
 * drift keeps nothing perfectly static (the AE "never a dead frame" rule).
 */
export const Background: React.FC<{
  kind?: BackgroundKind;
  /** Legacy prop: blobs={false} = flat gradient. */
  blobs?: boolean;
  src?: string;
  dim?: number;
  colors?: string[];
  angle?: number;
}> = ({ kind, blobs = true, src, dim = 0.35, colors, angle = 135 }) => {
  const theme = useKitTheme();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const k: BackgroundKind = kind ?? (blobs ? "blobs" : "gradient");
  const t = frame / fps;
  const bg = theme.background;
  const fg = theme.foreground;
  const dark = theme.mode === "dark";
  const grad = colors?.length
    ? `linear-gradient(${angle}deg, ${colors.join(", ")})`
    : `linear-gradient(160deg, ${bg}, ${theme.bgGradientTo ?? bg})`;

  switch (k) {
    case "speedlines":
      // Manga focus lines around a calm center — the anime "impact" backdrop.
      return (
        <AbsoluteFill style={{ background: bg }}>
          <FocusLines inner={0.34} density={110} color={dark ? "#ffffff" : mix(fg, theme.primary, 0.15)} />
        </AbsoluteFill>
      );
    case "sunburst": {
      const rays = 24;
      const stops = Array.from({ length: rays })
        .map((_, i) => {
          const a = (360 / rays) * i;
          const c = i % 2 ? mix(bg, theme.primary, dark ? 0.35 : 0.22) : bg;
          return `${c} ${a}deg ${a + 360 / rays}deg`;
        })
        .join(", ");
      return (
        <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: Math.hypot(width, height) * 1.1,
              height: Math.hypot(width, height) * 1.1,
              transform: `translate(-50%, -50%) rotate(${t * 6}deg)`,
              background: `conic-gradient(${stops})`,
            }}
          />
          <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${bg} 18%, transparent 60%)` }} />
        </AbsoluteFill>
      );
    }
    case "halftone": {
      const cell = Math.max(8, Math.round(width / 110));
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(${alpha(theme.primary, dark ? 0.5 : 0.35)} 30%, transparent 34%)`,
              backgroundSize: `${cell}px ${cell}px`,
              backgroundPosition: `${(t * 5) % cell}px 0px`,
              maskImage: "linear-gradient(135deg, black 0%, transparent 55%, black 100%)",
              WebkitMaskImage: "linear-gradient(135deg, black 0%, transparent 55%, black 100%)",
            }}
          />
        </AbsoluteFill>
      );
    }
    case "flat":
      return <AbsoluteFill style={{ background: bg }} />;
    case "hairlines": {
      // Editorial column rules (Talo, Linear, T:0): a few 1px verticals + one horizontal, barely there.
      const rule = alpha(fg.startsWith("#") ? fg : "#000000", dark ? 0.09 : 0.08);
      const cols = [0.12, 0.38, 0.62, 0.88];
      return (
        <AbsoluteFill style={{ background: bg }}>
          {cols.map((x, i) => (
            <div key={i} style={{ position: "absolute", left: Math.round(width * x), top: 0, bottom: 0, width: 1, background: rule }} />
          ))}
          <div style={{ position: "absolute", top: Math.round(height * 0.12), left: 0, right: 0, height: 1, background: rule }} />
        </AbsoluteFill>
      );
    }
    case "haze":
      // One soft glow of the brand color bleeding in from the top edge (Clep's lime haze), drifting slowly.
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse 70% 45% at ${50 + Math.sin(t * 0.2) * 6}% -8%, ${alpha(
                theme.primary.startsWith("#") ? theme.primary : "#888888",
                dark ? 0.28 : 0.32,
              )}, transparent 72%)`,
            }}
          />
        </AbsoluteFill>
      );
    case "gradient":
      return <AbsoluteFill style={{ background: grad }} />;
    case "blobs":
      return (
        <AbsoluteFill style={{ background: grad }}>
          {BLOB_POSITIONS.map(([fx, fy, size], i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: size,
                height: size,
                left: width * fx - size / 2 + Math.sin(t * 0.4 + i) * 30,
                top: height * fy - size / 2 + Math.cos(t * 0.3 + i) * 24,
                borderRadius: "50%",
                filter: "blur(50px)",
                background: dark
                  ? `radial-gradient(circle, ${alpha(theme.primary, 0.35)}, transparent 70%)`
                  : "radial-gradient(circle, rgba(255,255,255,.95), rgba(255,255,255,0) 70%)",
              }}
            />
          ))}
        </AbsoluteFill>
      );
    case "grid":
    case "dots": {
      const cell = Math.round(width / 24);
      const line = alpha(fg.startsWith("#") ? fg : "#000000", dark ? 0.07 : 0.055);
      const pattern =
        k === "grid"
          ? `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`
          : `radial-gradient(${alpha(fg.startsWith("#") ? fg : "#000000", dark ? 0.16 : 0.12)} 1.4px, transparent 1.6px)`;
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill
            style={{
              backgroundImage: pattern,
              backgroundSize: `${cell}px ${cell}px`,
              backgroundPosition: `${(t * 6) % cell}px ${(t * 4) % cell}px`,
              maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 30%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 30%, transparent 100%)",
            }}
          />
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${alpha(theme.primary, dark ? 0.18 : 0.08)}, transparent 70%)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "spotlight":
      return (
        <AbsoluteFill style={{ background: bg }}>
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse 55% 60% at ${50 + Math.sin(t * 0.25) * 4}% 38%, ${mix(
                bg,
                dark ? "#ffffff" : theme.primary,
                dark ? 0.1 : 0.08,
              )}, transparent 70%)`,
            }}
          />
          <AbsoluteFill
            style={{ background: `radial-gradient(ellipse 40% 30% at 50% 110%, ${alpha(theme.primary, 0.22)}, transparent 70%)` }}
          />
        </AbsoluteFill>
      );
    case "aurora":
      return (
        <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
          {[theme.primary, theme.accent, mix(theme.primary, "#ffffff", 0.4)].map((c, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: width * 0.7,
                height: height * 0.7,
                left: width * (0.1 + i * 0.25) + Math.sin(t * 0.35 + i * 2) * 120,
                top: height * (0.05 + (i % 2) * 0.35) + Math.cos(t * 0.28 + i) * 80,
                borderRadius: "50%",
                filter: "blur(120px)",
                opacity: dark ? 0.45 : 0.3,
                background: c,
              }}
            />
          ))}
        </AbsoluteFill>
      );
    case "paper":
      return (
        <AbsoluteFill style={{ background: dark ? bg : mix(bg, "#F1EADF", 0.7) }}>
          <Grain opacity={0.1} />
        </AbsoluteFill>
      );
    case "noise":
      return (
        <AbsoluteFill style={{ background: grad }}>
          <Grain opacity={0.08} />
        </AbsoluteFill>
      );
    case "mesh": {
      // Soft multi-point gradient that slowly breathes — the pastel launch backdrop.
      // Default mesh = the scene's own background tinted by the brand, so text contrast holds in every tone.
      const cs = colors?.length
        ? colors
        : [bg, mix(bg, theme.primary, 0.45), mix(bg, theme.accent, 0.28), mix(bg, dark ? "#000000" : "#ffffff", 0.35)];
      const pts: [number, number][] = [[15, 20], [85, 25], [30, 85], [80, 80]];
      return (
        <AbsoluteFill
          style={{
            background: cs[0],
            backgroundImage: cs
              .map((c, i) => {
                const [x, y] = pts[i % pts.length];
                return `radial-gradient(60% 70% at ${x + Math.sin(t * 0.3 + i) * 6}% ${y + Math.cos(t * 0.25 + i) * 6}%, ${c}, transparent 70%)`;
              })
              .join(", "),
          }}
        >
          <Grain opacity={0.05} />
        </AbsoluteFill>
      );
    }
    case "image":
      return (
        <AbsoluteFill style={{ background: bg }}>
          {src && <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          <AbsoluteFill style={{ background: alpha(dark ? "#000000" : "#ffffff", dim) }} />
        </AbsoluteFill>
      );
  }
};

/** Deterministic animated film grain (SVG turbulence, seed advances per frame). */
export const Grain: React.FC<{ opacity?: number; animated?: boolean }> = ({ opacity = 0.06, animated = true }) => {
  const frame = useCurrentFrame();
  const seed = animated ? Math.floor(frame / 2) % 50 : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
