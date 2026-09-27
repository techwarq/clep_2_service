import React from "react";
import { AbsoluteFill } from "remotion";
import { progress } from "@/kit/motion";
import { Words, DotField, Flare } from "@/kit/ui/promo";
import { C, F, W, H } from "./theme";
import { Paper, At, Lockup } from "./bits";

const serif = { font: F.serif, accentFont: F.serif, monoFont: F.mono };

const CODE: [string, string][] = [
  ["export function ", "ResearchPanel() {"],
  ["  return (", ""],
  ["    <button", ""],
  ["      data-clep=", '"ai-research"'],
  ["      onClick={", "startResearch}>"],
  ["      Start Research", ""],
  ["    </button>", ""],
];

// ── C · pivot: your code already knows ─────────────────────────────────────
export const Pivot: React.FC<{ t: number }> = ({ t }) => {
  const card = progress(t, 17.0, 0.8, "expo");
  const hl = progress(t, 18.7, 0.5, "expo");
  const out = progress(t, 20.35, 0.5, "in");
  const pull = progress(t, 20.4, 0.9, "inOut");
  return (
    <AbsoluteFill>
      <Paper />
      <DotField t={t} w={W} h={H} color={C.ink} hot={C.green} hotAt={{ x: 960, y: 700, r: 620, k: hl }} pull={pull} opacity={1 - progress(t, 21.0, 0.4)} />
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined, transform: `scale(${1 - out * 0.12})` }}>
        <At x={960} y={200}>
          <Words t={t} at={16.55} words={["Your", "code", { w: "already", accent: true }, { w: "knows", accent: true }]} size={140} color={C.ink} accentColor={C.green} {...serif} stagger={0.12} />
        </At>
        <At x={960} y={345}>
          <Words t={t} at={18.35} words={["what", "your", "feature", "does."]} size={140} color={C.ink} {...serif} stagger={0.1} />
        </At>
        <div
          style={{
            position: "absolute",
            left: 510,
            top: 480,
            width: 900,
            borderRadius: 24,
            background: "#0f1513",
            padding: "26px 0 30px",
            boxShadow: `0 50px 120px rgba(10,20,15,.28), 0 0 0 1px rgba(10,20,15,.2), 0 0 ${hl * 90}px ${C.lime}55`,
            opacity: card,
            transform: `translateY(${(1 - card) * 100}px) scale(${0.94 + card * 0.06})`,
            fontFamily: F.mono,
            fontSize: 27,
          }}
        >
          <div style={{ display: "flex", gap: 10, padding: "0 28px 18px", alignItems: "center" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
            ))}
            <span style={{ marginLeft: 16, fontSize: 19, color: "#7d8782" }}>ai-research.tsx</span>
          </div>
          {CODE.map(([a, b], i) => {
            const lk = progress(t, 17.2 + i * 0.07, 0.4, "expo");
            const hot = i === 3;
            return (
              <div key={i} style={{ position: "relative", display: "flex", height: 44, alignItems: "center", paddingLeft: 28, opacity: lk * (hot ? 1 : 1 - hl * 0.55), whiteSpace: "pre" }}>
                {hot && <div style={{ position: "absolute", inset: 0, background: `${C.lime}24`, borderLeft: `4px solid ${C.lime}`, transformOrigin: "left", transform: `scaleX(${hl})` }} />}
                <span style={{ width: 44, color: "#4c5652", position: "relative" }}>{i + 1}</span>
                <span style={{ color: hot ? "#9fd3c7" : "#c7cfcb", position: "relative" }}>{a}</span>
                <span style={{ color: hot ? C.lime : i === 0 ? "#f0c674" : "#c7cfcb", position: "relative", fontWeight: hot ? 500 : 400 }}>{b}</span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── D · meet clep ──────────────────────────────────────────────────────────
export const Meet: React.FC<{ t: number }> = ({ t }) => {
  const flare = progress(t, 20.95, 0.45, "expo") * (1 - 0.65 * progress(t, 21.5, 1.2));
  const up = progress(t, 22.15, 0.8, "expo");
  const out = progress(t, 24.85, 0.45, "in");
  const pill = progress(t, 23.3, 0.6, "overshoot");
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 14}px)` : undefined, transform: `translateY(${-out * 60}px)` }}>
      <Flare x={960} y={500 - up * 170} r={720} color={C.lime} k={flare} />
      <At x={960} y={520 - up * 190} style={{ transform: `translate(-50%,-50%) scale(${1 - up * 0.3})` }}>
        <Lockup t={t} at={20.98} size={190} />
      </At>
      <At x={960} y={515}>
        <Words t={t} at={22.35} words={["Product", "demos,"]} size={150} color={C.ink} {...serif} stagger={0.12} />
      </At>
      <At x={960} y={665}>
        <Words t={t} at={22.8} words={[{ w: "straight", accent: true }, { w: "from", accent: true }, { w: "your", accent: true }, { w: "code.", accent: true }]} size={150} color={C.ink} accentColor={C.green} {...serif} stagger={0.1} />
      </At>
      <At x={960} y={850}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: F.sans, fontSize: 28, color: C.ink, background: "#fff", borderRadius: 999, padding: "14px 30px", boxShadow: "0 16px 40px rgba(10,20,15,.1)", transform: `scale(${pill})`, opacity: Math.min(1, pill * 2) }}>
          <span style={{ width: 13, height: 13, borderRadius: "50%", background: C.green, boxShadow: `0 0 0 ${4 + Math.sin(t * 6) * 3}px ${C.green}33` }} />
          Live · Claude Code plugin
        </div>
      </At>
    </AbsoluteFill>
  );
};
