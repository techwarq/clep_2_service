import React from "react";
import { AbsoluteFill } from "remotion";
import { progress, lerp, clamp01 } from "@/kit/motion";
import { Words, ChatComposer, AgentStep, BrowserFrame, NamedCursor, cursorAt, typed, Caret, Skel, Spinner } from "@/kit/ui/promo";
import { C, F } from "./theme";
import { At } from "./bits";

const serif = { font: F.serif, accentFont: F.serif, monoFont: F.mono };
const PROMPT = "/clep make a clip of the AI research flow";
const QUERY = "EV charging market in Europe";

export const COMPOSER = { x: 385, y: 600, w: 1150, h: 222 };
export const PANEL = { x: 100, y: 120, w: 720, h: 840 };
export const BROWSER = { x: 880, y: 120, w: 940, h: 840 };

const ClaudeLabel: React.FC = () => (
  <>
    <span style={{ color: "#d97757", fontSize: 26, lineHeight: 1 }}>✻</span>
    <span style={{ fontWeight: 600, color: C.ink }}>Claude Code</span>
    <span style={{ fontFamily: F.mono, fontSize: 18 }}>~/atlas</span>
  </>
);

// ── E + F · just ask → clep runs it ────────────────────────────────────────
export const Agent: React.FC<{ t: number }> = ({ t }) => {
  const inK = progress(t, 25.15, 0.7, "expo");
  const m = progress(t, 28.3, 0.85, "expo");
  const exitK = progress(t, 34.95, 0.5, "in");
  const cur = cursorAt(
    [
      { t: 27.35, x: 1700, y: 1060 },
      { t: 28.05, x: 1478, y: 772, click: true },
      { t: 28.9, x: 1560, y: 900 },
    ],
    t,
  );

  const box = {
    x: lerp(COMPOSER.x, PANEL.x, m),
    y: lerp(COMPOSER.y, PANEL.y, m),
    w: lerp(COMPOSER.w, PANEL.w, m),
    h: lerp(COMPOSER.h, PANEL.h, m),
  };

  return (
    <AbsoluteFill>
      {t < 28.9 && (
        <At x={960} y={220} style={{ opacity: 1 - progress(t, 28.15, 0.4, "in") }}>
          <Words t={t} at={25.35} words={["Just", "ask", { w: "Claude", accent: true }, { w: "Code.", accent: true }]} size={140} color={C.ink} accentColor={C.green} {...serif} stagger={0.1} />
        </At>
      )}

      {t < 28.3 ? (
        <div style={{ position: "absolute", left: COMPOSER.x, top: COMPOSER.y, opacity: inK, transform: `translateY(${(1 - inK) * 80}px) scale(${0.95 + inK * 0.05})` }}>
          <ChatComposer
            t={t}
            width={COMPOSER.w}
            label={<ClaudeLabel />}
            text={PROMPT}
            placeholder="Ask Claude to…"
            typingAt={25.9}
            typingDur={1.7}
            sendAt={28.05}
            commands={[
              { name: "/clep", desc: "Turn a feature into a product demo" },
              { name: "/clear", desc: "Clear the conversation" },
              { name: "/compact", desc: "Summarize context" },
            ]}
            commandsFrom={25.98}
            commandsTo={26.5}
            chips={["Opus", "auto-accept"]}
            font={F.sans}
            mono={F.mono}
            ink={C.ink}
            muted={C.muted}
            accent={C.lime}
            accentInk={C.limeInk}
          />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            borderRadius: 30,
            background: "rgba(255,255,255,.88)",
            boxShadow: "0 40px 90px rgba(10,20,15,.14), 0 0 0 1px rgba(10,20,15,.07)",
            overflow: "hidden",
            opacity: 1 - exitK,
            transform: `translateX(${-exitK * 160}px)`,
          }}
        >
          <Thread t={t} k={clamp01((m - 0.35) / 0.5)} />
        </div>
      )}

      {t < 29.2 && <NamedCursor {...cur} opacity={progress(t, 27.35, 0.3) * (1 - progress(t, 28.6, 0.3))} />}

      {t >= 30.9 && <Browser t={t} exitK={exitK} />}
    </AbsoluteFill>
  );
};

const Thread: React.FC<{ t: number; k: number }> = ({ t, k }) => {
  const step = { font: F.sans, mono: F.mono, ink: C.ink, muted: C.muted, accent: C.lime, accentInk: C.limeInk };
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 720, height: 840, padding: 36, opacity: k, fontFamily: F.sans }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 21, color: C.muted, paddingBottom: 22, borderBottom: "1px solid rgba(10,20,15,.08)" }}>
        <ClaudeLabel />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28, transform: `translateY(${(1 - k) * 60}px)` }}>
        <div style={{ maxWidth: 560, background: C.ink, color: "#f3f5f2", borderRadius: 22, borderTopRightRadius: 8, padding: "18px 24px", fontFamily: F.mono, fontSize: 24, lineHeight: 1.45 }}>
          <span style={{ color: C.lime }}>/clep</span> make a clip of the AI research flow
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: 44 }}>
        <AgentStep t={t} at={29.25} doneAt={30.2} title="Scanning your codebase" sub={<>found <span style={{ color: C.green }}>data-clep="ai-research"</span></>} {...step} />
        <AgentStep t={t} at={30.9} doneAt={31.8} title="Opening a real browser" sub="chromium · 1920×1080 · 60fps" {...step} />
        <AgentStep t={t} at={32.9} doneAt={33.7} title="Directing every click" sub="2 clicks · 1 prompt · 2 zooms" {...step} />
        <AgentStep t={t} at={34.1} title="Cutting the film" sub="edit · grade · music" {...step} />
      </div>
      <div style={{ position: "absolute", left: 36, right: 36, bottom: 32, height: 70, borderRadius: 18, border: "1.5px solid rgba(10,20,15,.1)", display: "flex", alignItems: "center", padding: "0 22px", fontSize: 22, color: "#9aa19d" }}>
        Reply to Claude…
      </div>
    </div>
  );
};

const Browser: React.FC<{ t: number; exitK: number }> = ({ t, exitK }) => {
  const k = progress(t, 30.95, 0.8, "expo");
  const rec = progress(t, 31.5, 0.4, "overshoot");
  return (
    <div
      style={{
        position: "absolute",
        left: BROWSER.x,
        top: BROWSER.y,
        opacity: k * (1 - exitK),
        transform: `translateX(${(1 - k) * 140}px) scale(${0.94 + k * 0.06})`,
        filter: k < 1 ? `blur(${(1 - k) * 12}px)` : undefined,
      }}
    >
      <BrowserFrame
        width={BROWSER.w}
        height={BROWSER.h}
        url="localhost:3000/research"
        font={F.sans}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.limeInk, background: C.lime, borderRadius: 999, padding: "5px 12px", transform: `scale(${rec})` }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.red, opacity: Math.floor(t * 2.5) % 2 ? 1 : 0.4 }} />
            clep · REC
          </div>
        }
      >
        <ResearchApp t={t} live />
      </BrowserFrame>
    </div>
  );
};

/** The user's app ("Atlas" research), recreated — neutral indigo so it reads as theirs, not clep's. */
export const ResearchApp: React.FC<{ t: number; live?: boolean }> = ({ t, live }) => {
  const zk = live ? progress(t, 32.95, 0.55, "smooth") * (1 - progress(t, 34.3, 0.7, "smooth")) : 0;
  const cur = cursorAt(
    [
      { t: 31.35, x: 820, y: 700 },
      { t: 31.95, x: 460, y: 196, click: true },
      { t: 32.95, x: 470, y: 210 },
      { t: 33.25, x: 362, y: 290, click: true },
      { t: 34.5, x: 640, y: 560 },
    ],
    t,
  );
  const focus = t >= 31.95;
  const q = typed(QUERY, t, 32.05, 0.8);
  const pressed = t >= 33.25;
  const pk = clamp01(1 - Math.abs(t - 33.25) / 0.12);
  const loading = t >= 33.3 && t < 33.8;
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: "362px 290px", transform: `scale(${1 + zk * 0.45})`, fontFamily: F.sans, background: "#fbfbfc" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 190, background: "#f1f2f6", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 22, color: "#1e1b4b" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: C.indigo }} /> Atlas
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ marginTop: i ? 16 : 40, height: 14, width: 110 - i * 14, borderRadius: 7, background: i === 0 ? "#c7c9f5" : "#dcdee6" }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 240, top: 44, fontSize: 40, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>Research</div>
      <div style={{ position: "absolute", left: 240, top: 100, fontSize: 21, color: "#6b7280" }}>Ask a question — get a sourced brief.</div>
      <div style={{ position: "absolute", left: 240, top: 160, width: 640, height: 74, borderRadius: 14, background: "#fff", boxShadow: focus ? `0 0 0 3px ${C.indigo}55, 0 0 0 1.5px ${C.indigo}` : "0 0 0 1.5px #dfe1e8", display: "flex", alignItems: "center", padding: "0 22px", fontSize: 25, color: "#111" }}>
        {q ? q : <span style={{ color: "#a0a4b0" }}>What do you want to research?</span>}
        {focus && t < 33.2 && <Caret t={t} color={C.indigo} h={30} solid={t < 32.9} />}
      </div>
      <div style={{ position: "absolute", left: 240, top: 258, width: 244, height: 64, borderRadius: 14, background: C.indigo, color: "#fff", fontSize: 23, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transform: `scale(${1 - pk * 0.06})`, boxShadow: `0 10px 24px ${C.indigo}44` }}>
        {loading ? (
          <>
            <Spinner t={t} size={24} color="#fff" /> Researching…
          </>
        ) : (
          "Start Research"
        )}
      </div>
      <div style={{ position: "absolute", left: 240, top: 360, width: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        {pressed &&
          [0, 1, 2].map((i) => {
            const rk = progress(t, 33.8 + i * 0.2, 0.5, "expo");
            if (t < 33.8)
              return (
                <div key={i} style={{ height: 112, borderRadius: 16, background: "#fff", boxShadow: "0 0 0 1.5px #eceef2", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                  <Skel t={t} w="60%" h={18} />
                  <Skel t={t} w="90%" h={14} />
                </div>
              );
            return <ResultCard key={i} i={i} k={rk} />;
          })}
      </div>
      {live && <NamedCursor {...cur} label="clep" color={C.lime} labelColor={C.limeInk} opacity={progress(t, 31.35, 0.3)} />}
    </div>
  );
};

const RESULTS = [
  { title: "Europe's EV charging market to reach €41B by 2030", src: "Market brief", bars: [0.3, 0.45, 0.6, 0.78, 1] },
  { title: "Fast-charging points grew 48% year over year", src: "Industry report" },
  { title: "Top operators: Ionity, Allego, Fastned", src: "Competitor scan" },
];

const ResultCard: React.FC<{ i: number; k: number }> = ({ i, k }) => {
  const r = RESULTS[i];
  return (
    <div style={{ height: 112, borderRadius: 16, background: "#fff", boxShadow: "0 0 0 1.5px #eceef2, 0 8px 20px rgba(20,20,60,.05)", padding: "18px 22px", display: "flex", gap: 18, alignItems: "center", opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.indigo, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.src}</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#111", marginTop: 8, lineHeight: 1.25 }}>{r.title}</div>
      </div>
      {r.bars && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
          {r.bars.map((b, j) => (
            <div key={j} style={{ width: 16, height: 70 * b * k, borderRadius: 4, background: j === 4 ? C.indigo : "#c7c9f5" }} />
          ))}
        </div>
      )}
    </div>
  );
};
