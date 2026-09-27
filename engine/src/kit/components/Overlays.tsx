import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useKitTheme } from "../theme/ThemeProvider";
import { alpha } from "../lib/color";
import { Grain } from "./Background";

/**
 * Full-frame finishing layers drawn over every scene — the building blocks a
 * "look" (anime, VHS, film, comic…) is composed from at runtime. Pure data in the
 * spec (style.overlays), so a director can mix them without new code.
 */
export const OVERLAYS = ["halftone", "scanlines", "vignette", "vhs", "sparkles", "focuslines", "paper", "grain", "letterbox"] as const;
export type OverlayKind = (typeof OVERLAYS)[number];

const Halftone: React.FC = () => {
  const theme = useKitTheme();
  const { width } = useVideoConfig();
  const cell = Math.max(6, Math.round(width / 160));
  const ink = theme.mode === "dark" ? "#ffffff" : "#000000";
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(${alpha(ink, 0.22)} 32%, transparent 36%)`,
        backgroundSize: `${cell}px ${cell}px`,
        // Dots only toward the corners, like comic-print shading.
        maskImage: "radial-gradient(ellipse 70% 65% at 50% 50%, transparent 45%, black 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 65% at 50% 50%, transparent 45%, black 100%)",
        mixBlendMode: theme.mode === "dark" ? "screen" : "multiply",
      }}
    />
  );
};

const Scanlines: React.FC<{ strength?: number }> = ({ strength = 0.12 }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,${strength}) 0px, rgba(0,0,0,${strength}) 1px, transparent 2px, transparent 4px)`,
      mixBlendMode: "multiply",
    }}
  />
);

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,.45) 100%)" }} />
);

/** Tape look: scanlines, a slow tracking band, slight RGB fringe and jitter. */
const Vhs: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const band = ((frame * 7) % (height * 1.4)) - height * 0.2;
  const jitter = random(`vhs-${Math.floor(frame / 3)}`) > 0.93 ? (random(`j-${frame}`) - 0.5) * 8 : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${jitter}px)` }}>
      <Scanlines strength={0.16} />
      <AbsoluteFill
        style={{
          top: band,
          height: height * 0.08,
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,.07), transparent)",
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 3px 0 0 rgba(255,0,80,.10), inset -3px 0 0 rgba(0,200,255,.10)" }} />
      <Grain opacity={0.12} />
    </AbsoluteFill>
  );
};

/** Twinkling four-point stars — anime / magical-girl / y2k sparkle. */
const Sparkles: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const theme = useKitTheme();
  const t = frame / fps;
  return (
    <AbsoluteFill>
      {Array.from({ length: 14 }).map((_, i) => {
        const x = random(`sx${i}`) * width;
        const y = random(`sy${i}`) * height;
        const size = 14 + random(`ss${i}`) * 26;
        const tw = Math.max(0, Math.sin(t * (1.6 + random(`sp${i}`) * 2) + i * 1.7));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", left: x, top: y, opacity: tw, transform: `scale(${0.6 + tw * 0.5}) rotate(${t * 30}deg)` }}>
            <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill={i % 3 ? "#ffffff" : theme.accent} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

/** Manga focus lines: thin radial rays at the frame edges that flicker every few frames. */
export const FocusLines: React.FC<{ color?: string; density?: number; inner?: number }> = ({ color, density = 90, inner = 0.42 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const theme = useKitTheme();
  const ink = color ?? (theme.mode === "dark" ? "#ffffff" : "#111111");
  const seed = Math.floor(frame / 3);
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.hypot(width, height);
  const r0 = Math.min(width, height) * inner;
  const rays = Array.from({ length: density }).map((_, i) => {
    const a = (i / density) * Math.PI * 2 + (random(`fa${seed}-${i}`) - 0.5) * 0.05;
    const w = 0.004 + random(`fw${seed}-${i}`) * 0.012;
    const start = r0 * (0.85 + random(`fs${seed}-${i}`) * 0.5);
    const p = (ang: number, r: number) => `${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r}`;
    return `M${p(a - w, R)} L${p(a, start)} L${p(a + w, R)} Z`;
  });
  return (
    <AbsoluteFill>
      <svg width={width} height={height}>
        <path d={rays.join(" ")} fill={ink} opacity={0.55} />
      </svg>
    </AbsoluteFill>
  );
};

const Paper: React.FC = () => (
  <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: 0.5 }}>
    <svg width="100%" height="100%">
      <filter id="paper-fibers">
        <feTurbulence type="fractalNoise" baseFrequency="0.04 0.6" numOctaves="2" seed="7" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0.35 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-fibers)" />
    </svg>
  </AbsoluteFill>
);

const Letterbox: React.FC = () => {
  const { height } = useVideoConfig();
  const bar = Math.round(height * 0.09);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
    </AbsoluteFill>
  );
};

export const Overlays: React.FC<{ kinds?: readonly string[] }> = ({ kinds }) => {
  if (!kinds?.length) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {kinds.map((k) => {
        switch (k) {
          case "halftone":
            return <Halftone key={k} />;
          case "scanlines":
            return <Scanlines key={k} />;
          case "vignette":
            return <Vignette key={k} />;
          case "vhs":
            return <Vhs key={k} />;
          case "sparkles":
            return <Sparkles key={k} />;
          case "focuslines":
            return <FocusLines key={k} density={70} inner={0.5} />;
          case "paper":
            return <Paper key={k} />;
          case "grain":
            return <Grain key={k} opacity={0.1} />;
          case "letterbox":
            return <Letterbox key={k} />;
          default:
            return null;
        }
      })}
    </AbsoluteFill>
  );
};

/**
 * Headline treatments applied engine-wide to text set in the display font.
 * Looks that use one pick a display font distinct from the body font.
 */
export const TEXT_EFFECTS = ["none", "outline", "offset-shadow", "outline-shadow", "glow", "gradient", "chrome"] as const;
export type TextEffect = (typeof TEXT_EFFECTS)[number];

export function textEffectCss(effect: string | undefined, displayFamily: string, colors: { fg: string; primary: string; accent: string; bg: string }): string {
  if (!effect || effect === "none") return "";
  const fam = displayFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  if (!fam) return "";
  const sel = `[style*="${fam}"]`;
  const rules: Record<string, string> = {
    outline: `-webkit-text-stroke: 0.035em ${colors.fg}; paint-order: stroke fill;`,
    "offset-shadow": `text-shadow: 0.06em 0.06em 0 ${colors.primary};`,
    "outline-shadow": `-webkit-text-stroke: 0.018em ${colors.fg}; paint-order: stroke fill; text-shadow: 0.06em 0.06em 0 ${colors.primary};`,
    glow: `text-shadow: 0 0 0.12em ${colors.primary}, 0 0 0.35em ${alpha(colors.primary, 0.6)};`,
    gradient: `background: linear-gradient(180deg, ${colors.primary}, ${colors.accent}); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;`,
    chrome: `background: linear-gradient(180deg, #ffffff 0%, #c9d1d9 45%, #5b6470 50%, #e6ebf0 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; -webkit-text-stroke: 0.01em rgba(0,0,0,.35);`,
  };
  return rules[effect] ? `${sel} { ${rules[effect]} }` : "";
}
