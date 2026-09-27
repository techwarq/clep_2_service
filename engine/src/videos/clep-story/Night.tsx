import React from "react";
import { AbsoluteFill } from "remotion";
import { progress, clamp01 } from "@/kit/motion";
import { Words, Shot, BrowserFrame, NamedCursor, cursorAt, Caret } from "@/kit/ui/promo";
import { C, F } from "../clep-launch/theme";
import { At } from "../clep-launch/bits";
import { AtlasApp } from "./App";
import { L } from "./time";

const INK = "#e9ece9";
const DIM = "#7f8984";
const cap = { font: F.serif, accentFont: F.serif, monoFont: F.mono, color: INK, accentColor: C.lime, dur: 1.1, stagger: 0.07 };

export const NightSky: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(1400px 900px at 50% -10%, #17202b 0%, #0b0f12 55%, #070909 100%)" }} />
);

// ── 1 · cold open ──────────────────────────────────────────────────────────
export const ColdOpen: React.FC<{ t: number }> = ({ t }) => {
  const m = L("moment");
  return (
    <Shot t={t} a={0} b={L("late").start - 0.35} fin={1.2} fout={0.8} push={0.05}>
      <At x={960} y={540} style={{ opacity: 1 - progress(t, m.start - 0.2, 0.4) }}>
        <Caret t={t} color={INK} h={64} />
      </At>
      <At x={960} y={480}>
        <Words t={t} at={m.start} words={["Every", "product", "has", "a", "moment"]} size={92} {...cap} />
      </At>
      <At x={960} y={600}>
        <Words t={t} at={m.words[1] ?? m.start + 1.3} words={["where", "it", "has", "to", { w: "show", accent: true }, { w: "itself.", accent: true }]} size={92} {...cap} />
      </At>
    </Shot>
  );
};

// ── 2 · it's usually late ──────────────────────────────────────────────────
export const Late: React.FC<{ t: number }> = ({ t }) => {
  const a = L("late").start - 0.35;
  const flip = progress(t, L("late").start + 0.5, 0.45, "expo");
  const digit = (from: string, to: string) => (
    <span style={{ position: "relative", display: "inline-block", overflow: "hidden", height: "1em", verticalAlign: "top" }}>
      <span style={{ display: "block", transform: `translateY(${-flip * 100}%)` }}>{from}</span>
      <span style={{ display: "block", transform: `translateY(${-flip * 100}%)` }}>{to}</span>
    </span>
  );
  return (
    <Shot t={t} a={a} b={L("works").start - 0.3} push={0.06} fin={0.9}>
      <At x={960} y={330}>
        <div style={{ fontFamily: F.sans, fontSize: 38, fontWeight: 500, color: DIM, letterSpacing: "0.02em" }}>Friday, March 13</div>
      </At>
      <At x={960} y={540}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 300, color: INK, letterSpacing: "-0.05em", lineHeight: 1, display: "flex", alignItems: "baseline", textShadow: "0 0 80px rgba(160,190,255,.18)" }}>
          11:4{digit("7", "8")}
          <span style={{ fontSize: 80, marginLeft: 26, color: DIM, letterSpacing: 0 }}>PM</span>
        </div>
      </At>
    </Shot>
  );
};

// ── 3 · the feature works, the launch is tomorrow ──────────────────────────
const TERM = [
  { c: "$ npm test", k: "cmd" },
  { c: "✓ 142 passed", k: "ok" },
  { c: "$ git push origin main", k: "cmd" },
  { c: "✓ deployed to production", k: "ok" },
];

export const Works: React.FC<{ t: number }> = ({ t }) => {
  const w = L("works");
  const cal = progress(t, w.start + 1.15, 0.9, "expo");
  const glass: React.CSSProperties = { position: "absolute", borderRadius: 24, background: "rgba(22,28,26,.86)", boxShadow: "0 0 0 1px rgba(255,255,255,.07), 0 40px 100px rgba(0,0,0,.5)" };
  return (
    <Shot t={t} a={w.start - 0.3} b={L("nodemo").start - 0.25} push={0.04}>
      <div style={{ ...glass, left: 250, top: 330, width: 780, height: 420, padding: "34px 40px", fontFamily: F.mono, fontSize: 30 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c, opacity: 0.8 }} />
          ))}
        </div>
        {TERM.map((l, i) => {
          const k = progress(t, w.start + 0.1 + i * 0.28, 0.35, "out");
          return (
            <div key={i} style={{ height: 62, color: l.k === "ok" ? C.lime : INK, opacity: k, transform: `translateY(${(1 - k) * 8}px)` }}>
              {l.c}
            </div>
          );
        })}
      </div>
      <div style={{ ...glass, left: 1100, top: 300, width: 560, height: 480, padding: 36, fontFamily: F.sans, opacity: cal, transform: `translateY(${(1 - cal) * 60}px)` }}>
        <div style={{ fontSize: 24, color: DIM, fontWeight: 600, letterSpacing: "0.06em" }}>SATURDAY</div>
        <div style={{ fontSize: 76, color: INK, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 4 }}>14</div>
        {[{ h: "8 AM" }, { h: "9 AM", ev: true }, { h: "10 AM" }].map((r) => (
          <div key={r.h} style={{ display: "flex", gap: 20, alignItems: "center", height: 84, borderTop: "1px solid rgba(255,255,255,.07)" }}>
            <span style={{ width: 80, fontSize: 21, color: DIM }}>{r.h}</span>
            {r.ev && (
              <div style={{ flex: 1, borderRadius: 14, background: `${C.lime}22`, borderLeft: `5px solid ${C.lime}`, padding: "10px 18px" }}>
                <div style={{ fontSize: 27, fontWeight: 600, color: INK }}>Launch</div>
                <div style={{ fontSize: 20, color: DIM }}>Product Hunt · X · Hacker News</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Shot>
  );
};

// ── 4 · the demo doesn't exist ─────────────────────────────────────────────
export const NoDemo: React.FC<{ t: number }> = ({ t }) => {
  const n = L("nodemo");
  const k = progress(t, n.start + 0.2, 1.0, "expo");
  const cur = cursorAt(
    [
      { t: n.start + 0.2, x: 1260, y: 820 },
      { t: n.start + 1.2, x: 1010, y: 610 },
      { t: n.end + 0.6, x: 1030, y: 640 },
    ],
    t,
  );
  return (
    <Shot t={t} a={n.start - 0.25} b={L("perform").start - 0.3} push={0.08} fin={0.8}>
      <At x={960} y={480}>
        <div style={{ width: 250, height: 310, borderRadius: 26, border: "3px dashed #4a534f", display: "grid", placeItems: "center", opacity: k, transform: `scale(${0.94 + k * 0.06})` }}>
          <svg width={90} height={90} viewBox="0 0 24 24">
            <path d="M8 6 L18 12 L8 18 Z" fill="none" stroke="#4a534f" strokeWidth={1.6} strokeLinejoin="round" />
          </svg>
        </div>
      </At>
      <At x={960} y={700}>
        <div style={{ fontFamily: F.mono, fontSize: 34, color: INK, opacity: k }}>launch-demo.mp4</div>
      </At>
      <At x={960} y={752}>
        <div style={{ fontFamily: F.sans, fontSize: 26, color: DIM, opacity: progress(t, n.start + 0.9, 0.8) }}>Zero bytes</div>
      </At>
      <NamedCursor {...cur} opacity={progress(t, n.start + 0.3, 0.6)} />
    </Shot>
  );
};

// ── 5–6 · performing your own product, again and again ─────────────────────
const FRAME = { x: 310, y: 150, w: 1300, h: 800, sx: 1300 / 940 };

export const Perform: React.FC<{ t: number }> = ({ t }) => {
  const p = L("perform");
  const again = L("again");
  const again2 = L("again2");
  const end = L("knows").start - 0.5;
  // take boundaries
  const takes = [p.start - 0.3, again.start, again2.start, again2.start + 0.45, again2.start + 0.7, again2.start + 0.9, again2.start + 1.08];
  let take = 0;
  takes.forEach((s, i) => {
    if (t >= s) take = i;
  });
  const ts = takes[take];
  const speed = take === 0 ? 1 : take < 3 ? 2.4 : 5;
  const lt = (t - ts) * speed; // local time within a take
  // a hesitant manual take: wanders, misclicks the sidebar, finally finds the input
  const manual = [
    { t: 0, x: 780, y: 470 },
    { t: 0.9, x: 600, y: 420 },
    { t: 1.6, x: 120, y: 150, click: true },
    { t: 2.4, x: 420, y: 330 },
    { t: 3.1, x: 470, y: 196, click: true },
    { t: 4.2, x: 520, y: 240 },
  ];
  const cur = cursorAt(manual, lt);
  const flash = clamp01(1 - Math.abs(lt - 1.6) / 0.18);
  const slate = progress(t, ts, 0.25, "overshoot");
  const dimOut = progress(t, end - 0.6, 0.6, "in");
  const spot = { x: FRAME.x + cur.x * FRAME.sx, y: FRAME.y + (58 + cur.y) * FRAME.sx };
  const sec = Math.max(0, t - p.start) + take * 11;
  return (
    <Shot t={t} a={p.start - 0.3} b={end} push={0.03} fin={0.6} fout={0.3}>
      <div style={{ position: "absolute", left: FRAME.x, top: FRAME.y }}>
        <div style={{ transform: `scale(${FRAME.sx})`, transformOrigin: "0 0" }}>
          <BrowserFrame width={940} height={FRAME.h / FRAME.sx} url="localhost:3000/research" font={F.sans}>
            <AtlasApp t={0} T={{ clickInput: 99, typeAt: 99, typeDur: 1, clickBtn: 99, results: 99 }} />
            <div style={{ position: "absolute", inset: 0, background: `rgba(255,60,50,${flash * 0.12})` }} />
            <NamedCursor {...cur} />
          </BrowserFrame>
        </div>
      </div>
      {/* spotlight: the stage is dark except where you're performing */}
      <AbsoluteFill style={{ background: `radial-gradient(circle 400px at ${spot.x}px ${spot.y}px, rgba(7,9,9,0) 0%, rgba(7,9,9,.22) 55%, rgba(7,9,9,.66) 100%)` }} />
      {/* recorder HUD */}
      <At x={960} y={92}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: F.sans, fontSize: 26, color: INK, background: "rgba(22,28,26,.92)", borderRadius: 999, padding: "14px 28px", boxShadow: "0 0 0 1px rgba(255,255,255,.08)" }}>
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: C.red, opacity: Math.floor(t * 2) % 2 ? 1 : 0.35 }} />
          Recording
          <span style={{ fontFamily: F.mono, color: DIM }}>
            00:{String(Math.floor(sec / 60)).padStart(2, "0")}:{String(Math.floor(sec % 60)).padStart(2, "0")}
          </span>
          <span style={{ width: 18, height: 18, borderRadius: 4, background: INK, marginLeft: 6 }} />
        </div>
      </At>
      {take > 0 && (
        <div style={{ position: "absolute", left: 120, top: 70, fontFamily: F.mono, fontSize: 30, letterSpacing: "0.14em", color: C.limeInk, background: C.lime, borderRadius: 12, padding: "10px 22px", transform: `scale(${slate})`, transformOrigin: "left center" }}>
          TAKE {take + 1}
        </div>
      )}
      <AbsoluteFill style={{ background: "#070909", opacity: dimOut * 0.9 }} />
    </Shot>
  );
};

// ── 7–8 · your code already knows; why are you acting it out? ──────────────
const CODE: [string, string][] = [
  ["export function ", "ResearchPanel() {"],
  ["  return (", ""],
  ["    <button", ""],
  ["      data-clep=", '"ai-research"'],
  ["      onClick={", "startResearch}>"],
  ["      Start Research", ""],
  ["    </button>", ""],
  ["  )", ""],
  ["}", ""],
];

export const Knows: React.FC<{ t: number }> = ({ t }) => {
  const k = L("knows");
  const why = L("why");
  const hl = progress(t, k.start + 1.5, 0.8, "expo");
  const down = progress(t, why.start - 0.1, 1.0, "smooth");
  const cur = cursorAt(
    [
      { t: why.start - 0.5, x: 960, y: 600 },
      { t: why.start + 0.6, x: 960, y: 560 },
      { t: why.end + 0.4, x: 972, y: 572 },
    ],
    t,
  );
  return (
    <Shot t={t} a={k.start - 0.5} b={L("built").start - 0.35} push={0.03} fin={0.9} fout={0.8}>
      <At x={960} y={170} style={{ opacity: 1 - down }}>
        <Words t={t} at={k.start} words={["Your", "code", { w: "already", accent: true }, { w: "knows.", accent: true }]} size={96} {...cap} />
      </At>
      <div
        style={{
          position: "absolute",
          left: 440,
          top: 290,
          width: 1040,
          borderRadius: 26,
          background: "rgba(18,24,22,.92)",
          padding: "30px 0",
          boxShadow: `0 0 0 1px rgba(255,255,255,.07), 0 50px 120px rgba(0,0,0,.5), 0 0 ${hl * 120}px ${C.lime}22`,
          fontFamily: F.mono,
          fontSize: 29,
          opacity: 1 - down * 0.85,
          transform: `translateY(${down * 260}px) scale(${1 - down * 0.1})`,
          filter: down > 0.01 ? `blur(${down * 6}px)` : undefined,
        }}
      >
        {CODE.map(([a, b], i) => {
          const lk = progress(t, k.start - 0.2 + i * 0.11, 0.6, "expo");
          const hot = i === 3;
          return (
            <div key={i} style={{ position: "relative", display: "flex", height: 50, alignItems: "center", paddingLeft: 34, whiteSpace: "pre", opacity: lk * (hot ? 1 : 1 - hl * 0.6) }}>
              {hot && <div style={{ position: "absolute", inset: 0, background: `${C.lime}1f`, borderLeft: `4px solid ${C.lime}`, transformOrigin: "left", transform: `scaleX(${hl})` }} />}
              <span style={{ width: 50, color: "#46504c", position: "relative" }}>{i + 1}</span>
              <span style={{ color: hot ? "#9fd3c7" : "#c7cfcb", position: "relative" }}>{a}</span>
              <span style={{ color: hot ? C.lime : i === 0 ? "#f0c674" : "#c7cfcb", position: "relative" }}>{b}</span>
            </div>
          );
        })}
      </div>
      {t > why.start - 0.6 && (
        <>
          <At x={960} y={330}>
            <Words t={t} at={why.start} words={["So", "why", "are", { w: "you", accent: true }, "the", "one"]} size={96} {...cap} />
          </At>
          <At x={960} y={450}>
            <Words t={t} at={why.start + 1.0} words={["acting", "it", "out?"]} size={96} {...cap} />
          </At>
          <NamedCursor {...cur} size={64} opacity={progress(t, why.start - 0.4, 0.6) * (1 - progress(t, why.end + 0.2, 0.6))} />
        </>
      )}
    </Shot>
  );
};

