import React from "react";
import { AbsoluteFill, interpolate, random } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
  TransitionTiming,
} from "@remotion/transitions";
import { linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { ease, EaseName } from "./easing";
import type { TransitionT } from "@/engine/spec";
import { FocusLines } from "../components/Overlays";

/*
 * AE-style transitions — pure CSS/SVG, render-safe, frame-exact.
 *
 * What makes them read as "After Effects" rather than "PowerPoint":
 *   - directional motion blur (an anisotropic SVG blur along the travel axis, not a uniform fog)
 *   - both shots move together, the outgoing one slower (parallax), with a settle at the end
 *   - an exposure / scale kick at the cut point to hide the seam
 *   - brand-colored graphic elements (strips, slash edge, ring) instead of plain crossfades
 * Timing uses per-type curves (cut / reveal): quick through the middle, but spread across the
 * whole move — an over-steep curve makes the move happen in 2–3 frames and read as a glitch.
 */

type P = Record<string, unknown>;
type Dir = "left" | "right" | "up" | "down";
type Colors = { primary: string; accent: string; background: string; foreground: string };
type TP<T extends P> = TransitionPresentationComponentProps<T>;

/* ---------- morph: one container carries across the cut (Replit / Linear style) ---------- */

type MorphRect = { x: number; y: number; w: number; h: number; r: number; fill: string };
type MorphProps = { from: MorphRect; to: MorphRect; background: string; border: string };

/**
 * The outgoing scene's main container (a card, an input bar, a window) becomes the incoming one's:
 * the shape tweens position/size/radius/color on the transition's expo curve while the outgoing
 * content clears in the first 35% and the incoming content resolves inside it in the last 40%;
 * the shape then hands off to the real container underneath. No hard seam anywhere.
 */
const Morph: React.FC<TP<MorphProps>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const { from, to, background, border } = passedProps;
  if (presentationDirection === "exiting") {
    const a = interpolate(p, [0, 0.35], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ background }}>
        <AbsoluteFill style={{ opacity: a, transform: `scale(${1 - 0.03 * (1 - a)})` }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const b = interpolate(p, [0.55, 0.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shape = interpolate(p, [0, 0.82, 1], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const L = (k: keyof Omit<MorphRect, "fill">) => from[k] + (to[k] - from[k]) * p;
  const fill = p < 0.5 ? from.fill : to.fill;
  const outline = fill === "transparent";
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: b }}>{children}</AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: L("x"),
          top: L("y"),
          width: L("w"),
          height: L("h"),
          borderRadius: L("r"),
          background: outline ? "transparent" : fill,
          boxShadow: outline ? `inset 0 0 0 2px ${border}` : `0 ${L("h") * 0.04}px ${L("h") * 0.12}px -${L("h") * 0.04}px rgba(10,15,30,.18)`,
          opacity: shape * (1 - b * 0.85),
        }}
      />
    </AbsoluteFill>
  );
};

const peak = (p: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, p))); // 0 → 1 → 0

/** Motion blur along one axis. Renders an inline SVG filter + applies it to its children. */
const MotionBlur: React.FC<{ id: string; x: number; y: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  id,
  x,
  y,
  style,
  children,
}) => {
  const on = x > 0.3 || y > 0.3;
  return (
    <AbsoluteFill style={{ ...style, filter: on ? `url(#${id})` : style?.filter }}>
      {on && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${x.toFixed(1)} ${y.toFixed(1)}`} edgeMode="duplicate" />
          </filter>
        </svg>
      )}
      {children}
    </AbsoluteFill>
  );
};

const axis = (d: Dir) => ({
  horizontal: d === "left" || d === "right",
  sign: d === "right" || d === "down" ? -1 : 1,
});

/** Whip pan: both shots travel together with heavy directional blur and a small scale kick. */
const Whip: React.FC<TP<{ dir: Dir }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const { horizontal, sign } = axis(passedProps.dir);
  const entering = presentationDirection === "entering";
  const off = entering ? (1 - p) * 100 * sign : -p * 100 * sign;
  const blur = peak(p) * 60;
  const scale = 1 + peak(p) * 0.06;
  return (
    <MotionBlur
      id={`whip-${presentationDirection}-${passedProps.dir}`}
      x={horizontal ? blur : 0}
      y={horizontal ? 0 : blur}
      style={{ transform: `${horizontal ? `translateX(${off}%)` : `translateY(${off}%)`} scale(${scale})` }}
    >
      {children}
    </MotionBlur>
  );
};

/** Parallax push: incoming slides over, outgoing drifts a third as far and darkens; blur only while fast. */
const Push: React.FC<TP<{ dir: Dir }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const { horizontal, sign } = axis(passedProps.dir);
  const entering = presentationDirection === "entering";
  const off = entering ? (1 - p) * 100 * sign : -p * 35 * sign;
  const blur = peak(p) * (entering ? 26 : 10);
  return (
    <AbsoluteFill style={{ zIndex: entering ? 1 : 0 }}>
      <MotionBlur
        id={`push-${presentationDirection}-${passedProps.dir}`}
        x={horizontal ? blur : 0}
        y={horizontal ? 0 : blur}
        style={{
          transform: horizontal ? `translateX(${off}%)` : `translateY(${off}%)`,
          boxShadow: entering ? "0 0 80px 10px rgba(0,0,0,.35)" : undefined,
        }}
      >
        {children}
      </MotionBlur>
      {!entering && <AbsoluteFill style={{ background: "#000", opacity: p * 0.45, pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

/** Zoom-through: fly into the outgoing shot (zoom blur + exposure spike), land on the incoming one. */
const ZoomThrough: React.FC<TP<P>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const scale = entering ? interpolate(p, [0, 1], [0.7, 1]) : interpolate(p, [0, 1], [1, 2.4]);
  const opacity = entering ? interpolate(p, [0.35, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const blur = entering ? (1 - p) * 16 : p * 22;
  // A small exposure lift only: at 1.6× a light brand ground clips to pure white for a few frames.
  const bright = 1 + peak(p) * 0.18;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, opacity, filter: `blur(${blur}px) brightness(${bright})`, zIndex: entering ? 1 : 0 }}>
      {children}
    </AbsoluteFill>
  );
};

/** Blur dissolve with drift — the premium crossfade (both shots keep moving through it). */
const BlurDissolve: React.FC<TP<P>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const opacity = entering ? interpolate(p, [0.15, 0.85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const blur = entering ? (1 - p) * 22 : p * 22;
  const scale = entering ? 1.06 - 0.06 * p : 1 + 0.05 * p;
  return <AbsoluteFill style={{ opacity, filter: `blur(${blur}px)`, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};

/** Staggered brand-color strips sweep across, covering the cut, then pull off the other side. */
const Strips: React.FC<TP<{ colors: Colors; dir: Dir; count: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const entering = presentationDirection === "entering";
  const { horizontal } = axis(passedProps.dir);
  const n = passedProps.count;
  const palette = [passedProps.colors.primary, passedProps.colors.accent, passedProps.colors.foreground];
  const bars = Array.from({ length: n }).map((_, i) => {
    const d = (i / n) * 0.25; // stagger
    const inP = Math.min(1, Math.max(0, (p - d) / 0.45));
    const outP = Math.min(1, Math.max(0, (p - 0.5 - d) / 0.45));
    const cover = ease("expoInOut")(inP);
    const leave = ease("expoInOut")(outP);
    const from = -100 + cover * 100 + leave * 100; // -100 (off left) → 0 (covering) → 100 (off right)
    const size = 100 / n;
    const style: React.CSSProperties = horizontal
      ? { position: "absolute", top: `${i * size}%`, height: `${size + 0.2}%`, left: 0, width: "100%", transform: `translateX(${from}%)` }
      : { position: "absolute", left: `${i * size}%`, width: `${size + 0.2}%`, top: 0, height: "100%", transform: `translateY(${from}%)` };
    return <div key={i} style={{ ...style, background: palette[i % palette.length] }} />;
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: entering ? (p >= 0.5 ? 1 : 0) : p < 0.5 ? 1 : 0 }}>{children}</AbsoluteFill>
      {entering && <AbsoluteFill style={{ pointerEvents: "none" }}>{bars}</AbsoluteFill>}
    </AbsoluteFill>
  );
};

/** Diagonal slash: an angled wipe with a bright edge stripe; the outgoing shot kicks the other way. */
const Slash: React.FC<TP<{ colors: Colors; width: number; height: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const entering = presentationDirection === "entering";
  const { width: W, height: H } = passedProps;
  const slant = H * 0.36; // horizontal offset between the top and bottom of the cut
  const x = interpolate(p, [0, 1], [-slant - 40, W + slant + 40]);
  if (!entering) {
    return <AbsoluteFill style={{ transform: `translateX(${-p * 6}%) scale(${1 + p * 0.04})` }}>{children}</AbsoluteFill>;
  }
  const poly = `polygon(0px 0px, ${x + slant}px 0px, ${x}px ${H}px, 0px ${H}px)`;
  const edge = (w: number, c: string, o = 0) => (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <line x1={x + slant + o} y1={0} x2={x + o} y2={H} stroke={c} strokeWidth={w} />
    </svg>
  );
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: poly, WebkitClipPath: poly, transform: `translateX(${(1 - p) * 4}%)` }}>{children}</AbsoluteFill>
      {p > 0.02 && p < 0.98 && (
        <>
          {edge(26, passedProps.colors.primary, 10)}
          {edge(8, "#ffffff")}
        </>
      )}
    </AbsoluteFill>
  );
};

/** Glitch: slice offsets, RGB fringe bars and a jittered hard cut — for tech, cyberpunk, VHS. */
const Glitch: React.FC<TP<{ colors: Colors }>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const visible = entering ? p >= 0.5 : p < 0.5;
  const amt = peak(p);
  const seed = Math.floor(p * 12);
  const jx = (random(`gx${seed}`) - 0.5) * 60 * amt;
  const skew = (random(`gs${seed}`) - 0.5) * 8 * amt;
  const bands = Array.from({ length: 7 }).map((_, i) => {
    const top = random(`gb${seed}-${i}`) * 100;
    const h = 2 + random(`gh${seed}-${i}`) * 7;
    const dx = (random(`gd${seed}-${i}`) - 0.5) * 18 * amt;
    const c = i % 2 ? "rgba(255,0,90,.55)" : "rgba(0,230,255,.55)";
    return <div key={i} style={{ position: "absolute", left: `${dx}%`, top: `${top}%`, width: "100%", height: `${h}%`, background: c, mixBlendMode: "screen" }} />;
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: visible ? 1 : 0, transform: `translateX(${jx}px) skewX(${skew}deg)`, filter: `contrast(${1 + amt * 0.5}) saturate(${1 + amt})` }}>
        {children}
      </AbsoluteFill>
      {entering && amt > 0.15 && <AbsoluteFill style={{ pointerEvents: "none" }}>{bands}</AbsoluteFill>}
    </AbsoluteFill>
  );
};

/** Light leak: the outgoing shot over-exposes into a warm bloom; the incoming one comes down out of it. */
const LightLeak: React.FC<TP<{ colors: Colors }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const entering = presentationDirection === "entering";
  const visible = entering ? p >= 0.5 : p < 0.5;
  const b = peak(p);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: visible ? 1 : 0, filter: `brightness(${1 + b * 1.6}) saturate(${1 - b * 0.3})`, transform: `scale(${1 + b * 0.03})` }}>
        {children}
      </AbsoluteFill>
      {entering && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: Math.pow(b, 1.4),
            mixBlendMode: "screen",
            background: `radial-gradient(ellipse 70% 60% at ${30 + p * 40}% 40%, #ffffff 0%, ${passedProps.colors.accent} 35%, ${passedProps.colors.primary} 60%, transparent 80%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/** Dip to brand color: out to a solid brand frame, back in. */
const Dip: React.FC<TP<{ colors: Colors }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const entering = presentationDirection === "entering";
  const visible = entering ? p >= 0.5 : p < 0.5;
  const cover = peak(p);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: visible ? 1 : 0, transform: `scale(${1 + cover * 0.04})` }}>{children}</AbsoluteFill>
      {entering && <AbsoluteFill style={{ background: passedProps.colors.primary, opacity: Math.min(1, cover * 1.25) }} />}
    </AbsoluteFill>
  );
};

/** Circle reveal from the center with a brand-color ring riding the edge. */
const Circle: React.FC<TP<{ colors: Colors; width: number; height: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const entering = presentationDirection === "entering";
  const R = Math.hypot(passedProps.width, passedProps.height) / 2 + 40;
  const r = p * R;
  if (!entering) return <AbsoluteFill style={{ transform: `scale(${1 - p * 0.06})`, filter: `brightness(${1 - p * 0.35})` }}>{children}</AbsoluteFill>;
  const clip = `circle(${r}px at 50% 50%)`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip, transform: `scale(${1.08 - p * 0.08})` }}>{children}</AbsoluteFill>
      {p > 0.01 && p < 0.99 && (
        <svg width={passedProps.width} height={passedProps.height} style={{ position: "absolute", inset: 0 }}>
          <circle cx={passedProps.width / 2} cy={passedProps.height / 2} r={r} fill="none" stroke={passedProps.colors.primary} strokeWidth={18 * (1 - p) + 4} />
        </svg>
      )}
    </AbsoluteFill>
  );
};

/** Impact frame (anime/manga): the cut lands on a solid ink frame full of focus lines, then a shake. */
const Impact: React.FC<TP<{ color: string }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const entering = presentationDirection === "entering";
  const visible = entering ? p >= 0.5 : p < 0.5;
  const hit = peak(p);
  const shake = entering && p > 0.6 ? (random(`imp${Math.floor(p * 20)}`) - 0.5) * 22 * (1 - p) * 2 : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: visible ? 1 : 0, transform: `translate(${shake}px, ${-shake * 0.6}px) scale(${1 + hit * 0.08})` }}>{children}</AbsoluteFill>
      {entering && hit > 0.4 && (
        <AbsoluteFill style={{ background: passedProps.color }}>
          <FocusLines color="#ffffff" inner={0.18} density={120} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const make = <T extends P>(component: React.FC<TP<T>>, props: T): TransitionPresentation<P> =>
  ({ component, props }) as unknown as TransitionPresentation<P>;

const slideDir = (d: Dir) => (({ left: "from-right", right: "from-left", up: "from-bottom", down: "from-top" }) as const)[d];

/* ---------- spec → Remotion ---------- */

/** Per-type default length (s) and curve when the spec doesn't say. */
const DEFAULTS: Record<string, { duration: number; ease: EaseName }> = {
  whip: { duration: 0.5, ease: "cut" },
  push: { duration: 0.6, ease: "cut" },
  slide: { duration: 0.6, ease: "cut" },
  zoom: { duration: 0.6, ease: "cut" },
  blur: { duration: 0.6, ease: "inOut" },
  strips: { duration: 0.85, ease: "reveal" },
  slash: { duration: 0.6, ease: "reveal" },
  glitch: { duration: 0.35, ease: "inOut" },
  flash: { duration: 0.55, ease: "inOut" },
  leak: { duration: 0.6, ease: "inOut" },
  dip: { duration: 0.55, ease: "inOut" },
  circle: { duration: 0.7, ease: "reveal" },
  impact: { duration: 0.4, ease: "inOut" },
  morph: { duration: 0.75, ease: "expoInOut" },
};

export function toTiming(t: Partial<TransitionT>, fps: number): TransitionTiming {
  const d = DEFAULTS[t.type ?? "blur"] ?? { duration: 0.5, ease: "cut" as EaseName };
  const frames = Math.max(1, Math.round((t.duration ?? d.duration) * fps));
  return linearTiming({ durationInFrames: frames, easing: ease((t.ease as EaseName) ?? d.ease) });
}

export type MorphEnds = { from: MorphRect; to: MorphRect; background: string; border: string };

export function toPresentation(
  t: Partial<TransitionT>,
  size: { width: number; height: number },
  colors: Colors | string = "#ffffff",
  morph?: MorphEnds,
): TransitionPresentation<P> {
  const c: Colors =
    typeof colors === "string" ? { primary: colors, accent: colors, background: "#000000", foreground: "#ffffff" } : colors;
  const dir = (t.direction ?? "left") as Dir;
  switch (t.type) {
    case "morph":
      if (morph) return make(Morph, morph);
      return make(BlurDissolve, {}); // no containers on either side to carry — dissolve instead
    case "fade":
      return fade() as unknown as TransitionPresentation<P>;
    case "slide":
    case "push":
      return make(Push, { dir });
    case "wipe":
      return wipe({ direction: slideDir(dir) }) as unknown as TransitionPresentation<P>;
    case "flip":
      return flip({ direction: slideDir(dir) }) as unknown as TransitionPresentation<P>;
    case "iris":
      return iris(size) as unknown as TransitionPresentation<P>;
    case "clock":
      return clockWipe(size) as unknown as TransitionPresentation<P>;
    case "whip":
      return make(Whip, { dir });
    case "zoom":
      return make(ZoomThrough, {});
    case "strips":
      return make(Strips, { colors: c, dir, count: 5 });
    case "slash":
      return make(Slash, { colors: c, width: size.width, height: size.height });
    case "glitch":
      return make(Glitch, { colors: c });
    case "flash":
    case "leak":
      return make(LightLeak, { colors: c });
    case "dip":
      return make(Dip, { colors: c });
    case "circle":
      return make(Circle, { colors: c, width: size.width, height: size.height });
    case "impact":
      return make(Impact, { color: "#0b0b0b" });
    case "blur":
    default:
      return make(BlurDissolve, {});
  }
}
