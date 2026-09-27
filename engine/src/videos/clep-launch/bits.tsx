import React from "react";
import { AbsoluteFill } from "remotion";
import { progress } from "@/kit/motion";
import { C, F } from "./theme";

export const Paper: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(900px 600px at 8% 0%, rgba(200,245,66,.20), rgba(200,245,66,0) 70%),
        radial-gradient(900px 700px at 100% 8%, rgba(150,200,190,.18), rgba(150,200,190,0) 70%), ${C.paper}`,
    }}
  />
);

export const Night: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at 50% 40%, #16201c, ${C.night} 70%)` }} />
);

/** The clep mark: black rounded square with a C arc that draws on. */
export const ClepMark: React.FC<{ size: number; draw?: number }> = ({ size, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 512 512">
    <rect width={512} height={512} rx={116} fill="#0a0a0a" />
    <path d="M375.5 155.7 A156 156 0 1 0 375.5 356.3" fill="none" stroke="#fff" strokeWidth={88} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
  </svg>
);

export const Lockup: React.FC<{ t: number; at: number; size: number }> = ({ t, at, size }) => {
  const m = progress(t, at, 0.7, "overshoot");
  const d = progress(t, at + 0.1, 0.6, "expo");
  const w = progress(t, at + 0.3, 0.6, "expo");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22 }}>
      <div style={{ transform: `scale(${m}) rotate(${(1 - m) * -40}deg)`, opacity: Math.min(1, m * 2) }}>
        <ClepMark size={size} draw={d} />
      </div>
      <div style={{ overflow: "hidden", paddingRight: 8 }}>
        <div style={{ fontFamily: F.poppins, fontWeight: 600, fontSize: size * 0.95, letterSpacing: "-0.03em", color: C.ink, transform: `translateX(${(1 - w) * -size * 1.4}px)`, opacity: w, lineHeight: 1.1 }}>clep</div>
      </div>
    </div>
  );
};

/** Pill button in the site's style. */
export const Pill: React.FC<{ children: React.ReactNode; size?: number; pressed?: number; style?: React.CSSProperties }> = ({ children, size = 34, pressed = 0, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.4,
      fontFamily: F.sans,
      fontWeight: 600,
      fontSize: size,
      color: C.limeInk,
      background: C.lime,
      borderRadius: 999,
      padding: `${size * 0.62}px ${size * 1.2}px`,
      boxShadow: `0 ${18 - pressed * 12}px 40px rgba(160,210,40,.45)`,
      transform: `scale(${1 - pressed * 0.06})`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Arrow: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 12 H19 M13 6 L19 12 L13 18" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Absolute box centred on (x, y). */
export const At: React.FC<{ x: number; y: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, children, style }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", ...style }}>{children}</div>
);
