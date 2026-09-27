import React from "react";
import { progress, lerp, clamp01 } from "@/kit/motion";
import { Words, Shot, ChatComposer, AgentStep, BrowserFrame, NamedCursor, cursorAt, Flare } from "@/kit/ui/promo";
import { C, F } from "../clep-launch/theme";
import { At, Lockup, ClepMark, Pill, Arrow } from "../clep-launch/bits";
import { AtlasApp, AppTimes, directedPath } from "./App";
import { L } from "./time";

const serif = { font: F.serif, accentFont: F.serif, monoFont: F.mono, color: C.ink, accentColor: C.green, dur: 1.0, stagger: 0.07 };
const GRAD = "linear-gradient(135deg,#c9b8f5 0%,#f5c4e0 55%,#b9d8f7 100%)";

const ClaudeLabel: React.FC = () => (
  <>
    <span style={{ color: "#d97757", fontSize: 26, lineHeight: 1 }}>✻</span>
    <span style={{ fontWeight: 600, color: C.ink }}>Claude Code</span>
    <span style={{ fontFamily: F.mono, fontSize: 18 }}>~/atlas</span>
  </>
);

/** A browser window holding the Atlas app, scaled to `w` px wide. */
const Window: React.FC<{ w: number; t: number; T: AppTimes; cursor?: Parameters<typeof AtlasApp>[0]["cursor"]; label?: string; cursorOpacity?: number }> = ({ w, t, T, cursor, label, cursorOpacity }) => (
  <div style={{ width: w, height: (w / 940) * 840 }}>
    <div style={{ transform: `scale(${w / 940})`, transformOrigin: "0 0" }}>
      <BrowserFrame width={940} height={840} url="localhost:3000/research" font={F.sans}>
        <AtlasApp t={t} T={T} cursor={cursor} cursorLabel={label} cursorOpacity={cursorOpacity} />
      </BrowserFrame>
    </div>
  </div>
);

// ── 9 · so we built clep ───────────────────────────────────────────────────
export const Built: React.FC<{ t: number }> = ({ t }) => {
  const b = L("built");
  const at = b.end - 0.45;
  const bloom = progress(t, b.start, 2.4, "smooth");
  return (
    <Shot t={t} a={b.start - 0.3} b={L("ask").start - 0.3} push={0.04} fin={1.0} fout={0.8}>
      <Flare x={960} y={lerp(1000, 560, bloom)} r={900} color={C.lime} k={bloom * 0.8} />
      <At x={960} y={540}>
        <Lockup t={t} at={at} size={190} />
      </At>
    </Shot>
  );
};

// ── 10–11 · ask Claude Code; clep runs it ──────────────────────────────────
const COMPOSER = { x: 385, y: 430, w: 1150, h: 222 };
const PANEL = { x: 100, y: 120, w: 720, h: 840 };
const BROWSER = { x: 880, y: 120, w: 940, h: 840 };

export const Directed: React.FC<{ t: number }> = ({ t }) => {
  const ask = L("ask");
  const r = L("runs");
  const w = (i: number) => r.words[i] ?? r.start + i * 1.1;
  const typeAt = ask.start + 0.35;
  const sendAt = ask.end + 0.2;
  const m = progress(t, sendAt + 0.2, 0.9, "expo");
  const T: AppTimes = { clickInput: w(3) + 0.1, typeAt: w(4), typeDur: 0.85, clickBtn: w(5) + 0.1, results: w(5) + 0.7, zoom: [w(5) - 0.15, w(5) + 1.0] };
  const bIn = progress(t, w(2), 0.9, "expo");
  const box = { x: lerp(COMPOSER.x, PANEL.x, m), y: lerp(COMPOSER.y, PANEL.y, m), w: lerp(COMPOSER.w, PANEL.w, m), h: lerp(COMPOSER.h, PANEL.h, m) };
  const step = { font: F.sans, mono: F.mono, ink: C.ink, muted: C.muted, accent: C.lime, accentInk: C.limeInk };
  return (
    <Shot t={t} a={ask.start - 0.3} b={L("editor").start - 0.3} push={0.02} fin={0.8} fout={0.6}>
      {t < sendAt + 0.2 ? (
        <div style={{ position: "absolute", left: COMPOSER.x, top: COMPOSER.y }}>
          <ChatComposer
            t={t}
            width={COMPOSER.w}
            label={<ClaudeLabel />}
            text="/clep record the AI research flow"
            placeholder="Ask Claude to…"
            typingAt={typeAt}
            typingDur={1.5}
            sendAt={sendAt}
            commands={[
              { name: "/clep", desc: "Turn a feature into a product demo" },
              { name: "/clear", desc: "Clear the conversation" },
              { name: "/compact", desc: "Summarize context" },
            ]}
            commandsFrom={typeAt + 0.05}
            commandsTo={typeAt + 0.55}
            chips={["Opus"]}
            font={F.sans}
            mono={F.mono}
            ink={C.ink}
            muted={C.muted}
            accent={C.lime}
            accentInk={C.limeInk}
          />
        </div>
      ) : (
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 30, background: "rgba(255,255,255,.9)", boxShadow: "0 40px 90px rgba(10,20,15,.14), 0 0 0 1px rgba(10,20,15,.07)", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 720, height: 840, padding: 36, opacity: clamp01((m - 0.35) / 0.5), fontFamily: F.sans }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 21, color: C.muted, paddingBottom: 22, borderBottom: "1px solid rgba(10,20,15,.08)" }}>
              <ClaudeLabel />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
              <div style={{ background: C.ink, color: "#f3f5f2", borderRadius: 22, borderTopRightRadius: 8, padding: "18px 24px", fontFamily: F.mono, fontSize: 24 }}>
                <span style={{ color: C.lime }}>/clep</span> record the AI research flow
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: 44 }}>
              <AgentStep t={t} at={w(0)} doneAt={w(1) - 0.15} title="Reading your code" sub="src/ · 214 files" {...step} />
              <AgentStep t={t} at={w(1)} doneAt={w(1) + 0.6} title="Found the feature" sub={<span style={{ color: C.green }}>data-clep="ai-research"</span>} {...step} />
              <AgentStep t={t} at={w(2)} doneAt={w(2) + 1.0} title="Running it in a real browser" sub="chromium · 1920×1080 · 60fps" {...step} />
              <AgentStep t={t} at={w(3)} doneAt={w(5) + 0.8} title="Directing the take" sub="clicks · keystrokes · zooms" {...step} />
            </div>
          </div>
        </div>
      )}
      {t >= w(2) && (
        <div style={{ position: "absolute", left: BROWSER.x, top: BROWSER.y, opacity: bIn, transform: `translateX(${(1 - bIn) * 140}px) scale(${0.94 + bIn * 0.06})`, filter: bIn < 1 ? `blur(${(1 - bIn) * 12}px)` : undefined }}>
          <Window w={BROWSER.w} t={t} T={T} cursor={directedPath(T, w(2) + 0.8)} label="clep" cursorOpacity={progress(t, w(2) + 0.6, 0.4)} />
        </div>
      )}
    </Shot>
  );
};

// ── 12 · what an editor would do ───────────────────────────────────────────
const SEGS = [3, 2, 2, 3, 2, 2, 3]; // even = action, odd = dead air

export const Editor: React.FC<{ t: number }> = ({ t }) => {
  const e = L("editor");
  const w = (i: number) => e.words[i] ?? e.start + i * 1.5;
  const cut = progress(t, w(2) + 0.15, 1.0, "expoInOut");
  const grade = progress(t, w(4) + 0.1, 0.9, "inOut");
  const replay = t - (w(2) + 0.1);
  const T: AppTimes = { clickInput: 0.4, typeAt: 0.6, typeDur: 0.8, clickBtn: 1.8, results: 2.3, zoom: [w(3) - w(2) - 0.2, w(3) - w(2) + 1.8] };
  const ph = clamp01((t - (w(0) - 0.3)) / (e.end - w(0) + 0.6));
  const chips = [
    { at: w(2), label: "Dead air cut" },
    { at: w(3), label: "Following the action" },
    { at: w(4), label: "Graded" },
  ];
  return (
    <Shot t={t} a={e.start - 0.3} b={L("back").start - 0.35} push={0.03} fin={0.8} fout={0.7}>
      <div style={{ position: "absolute", left: 410, top: 70, width: 1100, height: 620, borderRadius: 26, overflow: "hidden", boxShadow: "0 50px 120px rgba(10,20,15,.2), 0 0 0 1px rgba(10,20,15,.08)" }}>
        <div style={{ position: "absolute", inset: 0, background: GRAD, filter: `saturate(${0.35 + grade * 0.65}) brightness(${0.95 + grade * 0.05})` }} />
        <div style={{ position: "absolute", left: 250, top: 40, filter: `saturate(${0.35 + grade * 0.65}) contrast(${0.9 + grade * 0.1})` }}>
          <Window w={600} t={replay} T={T} cursor={directedPath(T, -0.3)} />
        </div>
        {grade > 0 && grade < 1 && <div style={{ position: "absolute", top: 0, bottom: 0, width: 260, left: lerp(-300, 1140, grade), background: "linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0))" }} />}
      </div>
      {/* chips */}
      <div style={{ position: "absolute", left: 410, top: 725, display: "flex", gap: 14 }}>
        {chips.map((c) => {
          const k = progress(t, c.at, 0.6, "overshoot");
          return (
            <div key={c.label} style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 26, color: C.ink, background: "#fff", borderRadius: 999, padding: "12px 24px", boxShadow: "0 12px 30px rgba(10,20,15,.1)", opacity: clamp01(k * 2), transform: `translateY(${(1 - k) * 20}px) scale(${0.85 + k * 0.15})` }}>
              <span style={{ color: C.green, marginRight: 10 }}>✓</span>
              {c.label}
            </div>
          );
        })}
      </div>
      {/* timeline */}
      <div style={{ position: "absolute", left: 410, top: 830, width: 1100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 22, color: C.muted, marginBottom: 14 }}>
          <span>ai-research.mp4</span>
          <span>
            {cut < 0.5 ? "raw" : "cut"} · 0:{String(Math.round(lerp(47, 18, cut))).padStart(2, "0")}
          </span>
        </div>
        <div style={{ position: "relative", display: "flex", gap: 6 * (1 - cut) + 4, height: 64 }}>
          {SEGS.map((s, i) => {
            const dead = i % 2 === 1;
            const grow = dead ? s * (1 - cut) : s;
            return (
              <div
                key={i}
                style={{
                  flexGrow: grow,
                  flexBasis: 0,
                  minWidth: 0,
                  borderRadius: 10,
                  background: dead ? "repeating-linear-gradient(135deg,#d6d9d7 0 8px,#e3e5e4 8px 16px)" : C.lime,
                  opacity: dead ? 1 - cut : 1,
                  boxShadow: dead ? undefined : "inset 0 0 0 1.5px rgba(16,21,5,.12)",
                }}
              />
            );
          })}
          <div style={{ position: "absolute", left: `${ph * 100}%`, top: -10, bottom: -10, width: 3, background: C.ink, borderRadius: 2 }} />
        </div>
      </div>
    </Shot>
  );
};

// ── 13 · when you come back ────────────────────────────────────────────────
const TOAST = { x: 1230, y: 60, w: 630, h: 150 };

export const Back: React.FC<{ t: number }> = ({ t }) => {
  const bk = L("back");
  const tick = clamp01((t - (bk.start - 0.2)) / 1.1);
  const min = 48 + Math.floor(tick * 9);
  const toast = progress(t, bk.words[1] ?? bk.start + 0.9, 0.7, "expo");
  const clickAt = bk.end + 0.35;
  const cur = cursorAt(
    [
      { t: bk.start + 0.6, x: 1200, y: 760 },
      { t: clickAt, x: TOAST.x + 300, y: TOAST.y + 80, click: true },
    ],
    t,
  );
  return (
    <Shot t={t} a={bk.start - 0.35} b={L("showing").start - 0.3} push={0.03} fin={0.8} fout={0.25}>
      <At x={960} y={330}>
        <div style={{ fontFamily: F.sans, fontSize: 38, fontWeight: 500, color: C.muted }}>Friday, March 13</div>
      </At>
      <At x={960} y={540}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 300, color: C.ink, letterSpacing: "-0.05em", lineHeight: 1 }}>
          11:{min}
          <span style={{ fontSize: 80, marginLeft: 26, color: C.muted, letterSpacing: 0 }}>PM</span>
        </div>
      </At>
      <div
        style={{
          position: "absolute",
          left: TOAST.x,
          top: TOAST.y,
          width: TOAST.w,
          height: TOAST.h,
          borderRadius: 26,
          background: "rgba(255,255,255,.9)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 30px 70px rgba(10,20,15,.18), 0 0 0 1px rgba(10,20,15,.06)",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 22px",
          opacity: toast,
          transform: `translateX(${(1 - toast) * 520}px)`,
          fontFamily: F.sans,
        }}
      >
        <ClepMark size={76} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 31, fontWeight: 700, color: C.ink }}>Your demo is ready</div>
          <div style={{ fontSize: 23, color: C.muted, marginTop: 6 }}>ai-research.mp4 · 1080p60</div>
        </div>
        <div style={{ width: 140, height: 80, borderRadius: 12, background: GRAD }} />
      </div>
      <NamedCursor {...cur} opacity={progress(t, bk.start + 0.4, 0.4)} />
    </Shot>
  );
};

// ── 14 · your product, showing itself ──────────────────────────────────────
export const Showing: React.FC<{ t: number }> = ({ t }) => {
  const s = L("showing");
  const a = s.start - 0.3;
  const g = progress(t, a, 1.0, "expo");
  const rect = { x: lerp(TOAST.x + TOAST.w - 162, 250, g), y: lerp(TOAST.y + 35, 90, g), w: lerp(140, 1420, g), h: lerp(80, 800, g) };
  const T: AppTimes = { clickInput: 0.5, typeAt: 0.7, typeDur: 0.8, clickBtn: 1.8, results: 2.3, zoom: [1.6, 3.0] };
  const lt = t - (a + 0.6);
  const ws = rect.w / 1420;
  return (
    <Shot t={t} a={a} b={L("sign").start - 0.4} push={0.05} fin={0} fout={0.8}>
      <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 26 * ws + 8, overflow: "hidden", boxShadow: "0 60px 140px rgba(10,20,15,.24), 0 0 0 1px rgba(10,20,15,.08)" }}>
        <div style={{ position: "absolute", inset: 0, background: GRAD }} />
        <div style={{ position: "absolute", left: 290 * ws, top: 50 * ws, transform: `scale(${ws})`, transformOrigin: "0 0" }}>
          <Window w={840} t={lt} T={T} cursor={directedPath(T, -0.3)} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70 * ws, background: "linear-gradient(0deg,rgba(8,12,10,.6),rgba(8,12,10,0))", display: "flex", alignItems: "center", padding: `0 ${28 * ws}px` }}>
          <div style={{ position: "relative", flex: 1, height: 7 * ws, borderRadius: 4, background: "rgba(255,255,255,.3)" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${clamp01(lt / 4.2) * 100}%`, borderRadius: 4, background: C.lime }} />
          </div>
        </div>
      </div>
    </Shot>
  );
};

// ── 15 · sign-off ──────────────────────────────────────────────────────────
export const Sign: React.FC<{ t: number; end: number }> = ({ t, end }) => {
  const s = L("sign");
  const lock = s.words[0] ?? s.start;
  const tag = s.words[2] ?? s.start + 0.7;
  const beta = s.end + 0.5;
  return (
    <Shot t={t} a={s.start - 0.45} b={end + 1} push={0.025} fin={0.9} fout={0}>
      <Flare x={960} y={400} r={760} color={C.lime} k={progress(t, lock, 2.0) * 0.4} />
      <At x={960} y={400}>
        <Lockup t={t} at={lock - 0.1} size={150} />
      </At>
      <At x={960} y={580}>
        <Words t={t} at={tag} words={["Product", "demos,", { w: "straight", accent: true }, { w: "from", accent: true }, { w: "your", accent: true }, { w: "code.", accent: true }]} size={92} {...serif} />
      </At>
      <At x={960} y={740}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: progress(t, beta, 0.9), transform: `translateY(${(1 - progress(t, beta, 0.9, "expo")) * 16}px)` }}>
          <Pill size={28}>
            Ask for invite <Arrow size={26} color={C.limeInk} />
          </Pill>
          <span style={{ fontFamily: F.mono, fontSize: 28, color: C.muted }}>clep.abstraklabs.com</span>
        </div>
      </At>
    </Shot>
  );
};

