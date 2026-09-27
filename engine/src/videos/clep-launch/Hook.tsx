import React from "react";
import { AbsoluteFill } from "remotion";
import { progress, clamp01, kf } from "@/kit/motion";
import { Words, Scribble, NamedCursor, cursorAt, Check, Spinner } from "@/kit/ui/promo";
import { C, F, B } from "./theme";
import { Paper, Night, At } from "./bits";

const serif = { font: F.serif, accentFont: F.serif, monoFont: F.mono };

// ── A · hook: the feature shipped, the demo didn't ─────────────────────────
export const CHECKBOX = { x: 606, y: 806 };

export const Hook: React.FC<{ t: number }> = ({ t }) => {
  const p1Out = progress(t, 2.4, 0.45, "in");
  const cardIn = progress(t, 0.25, 0.8, "expo");
  const mk = progress(t, 1.45, 0.45, "overshoot");
  const merged = t >= 1.45;
  const cur = cursorAt(
    [
      { t: 0.6, x: 1780, y: 1040 },
      { t: 1.45, x: 1300, y: 612, click: true },
      { t: 2.6, x: 1420, y: 720 },
    ],
    t,
  );

  const listIn = progress(t, 2.95, 0.8, "expo");
  const push = progress(t, 5.1, 0.55, "in");

  return (
    <AbsoluteFill style={{ transformOrigin: `${CHECKBOX.x}px ${CHECKBOX.y}px`, transform: `scale(${1 + push * 1.4})` }}>
      <Paper />
      {/* part 1 */}
      {t < 2.9 && (
        <AbsoluteFill style={{ opacity: 1 - p1Out, transform: `translateY(${-p1Out * 80}px)`, filter: `blur(${p1Out * 10}px)` }}>
          <At x={960} y={330}>
            <Words t={t} at={0.55} words={["You", "shipped", { w: "the feature.", accent: true }]} size={168} color={C.ink} accentColor={C.green} {...serif} stagger={0.14} />
          </At>
          <div
            style={{
              position: "absolute",
              left: 460,
              top: 500,
              width: 1000,
              height: 210,
              background: C.card,
              borderRadius: 26,
              boxShadow: "0 40px 90px rgba(10,20,15,.14), 0 0 0 1px rgba(10,20,15,.06)",
              opacity: cardIn,
              transform: `translateY(${(1 - cardIn) * 90}px) scale(${0.92 + cardIn * 0.08})`,
              fontFamily: F.sans,
            }}
          >
            <div style={{ position: "absolute", left: 36, top: 40, width: 60, height: 60, borderRadius: "50%", background: merged ? "#8250df" : "#1f883d", display: "grid", placeItems: "center", transform: `scale(${merged ? 0.8 + mk * 0.2 : 1})` }}>
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
                <circle cx={6} cy={5} r={2.2} />
                <circle cx={6} cy={19} r={2.2} />
                <circle cx={18} cy={12} r={2.2} />
                <path d="M6 7.5 V16.5 M6 7.5 C6 12 12 12 15.8 12" />
              </svg>
            </div>
            <div style={{ position: "absolute", left: 120, top: 36, fontSize: 36, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>
              feat: AI research panel <span style={{ color: "#8a918d", fontWeight: 400 }}>#128</span>
            </div>
            <div style={{ position: "absolute", left: 120, top: 92, fontSize: 23, color: C.muted }}>
              {merged ? "Merged 14 commits into main" : "wants to merge 14 commits into main"}
            </div>
            <div style={{ position: "absolute", left: 120, top: 140, fontSize: 21, color: "#1f883d", display: "flex", gap: 10, alignItems: "center" }}>
              <Check k={1} size={24} bg="#1f883d" fg="#fff" /> All checks passed
            </div>
            <div
              style={{
                position: "absolute",
                right: 36,
                top: 73,
                width: 270,
                height: 64,
                borderRadius: 14,
                background: merged ? "#8250df" : "#1f883d",
                color: "#fff",
                fontSize: 24,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                transform: `scale(${cur.pressed ? 0.95 : merged ? 0.9 + mk * 0.1 : 1})`,
              }}
            >
              {merged ? (
                <>
                  <Check k={progress(t, 1.5, 0.35)} size={28} bg="rgba(255,255,255,.25)" fg="#fff" /> Merged
                </>
              ) : (
                "Merge pull request"
              )}
            </div>
          </div>
          <NamedCursor {...cur} opacity={progress(t, 0.6, 0.3)} />
        </AbsoluteFill>
      )}

      {/* part 2 */}
      {t >= 2.5 && (
        <AbsoluteFill>
          <At x={960} y={200}>
            <Words t={t} at={2.62} words={["But", "the", "demo?"]} size={150} color={C.ink} {...serif} stagger={0.12} />
          </At>
          <At x={960} y={352}>
            <Words t={t} at={3.8} words={["Still", "on", "your", { w: "to-do", accent: true }, { w: "list.", accent: true }]} size={150} color={C.ink} accentColor={C.green} {...serif} stagger={0.1} />
          </At>
          <div
            style={{
              position: "absolute",
              left: 550,
              top: 540,
              width: 820,
              background: C.card,
              borderRadius: 26,
              padding: "30px 40px 26px",
              boxShadow: "0 40px 90px rgba(10,20,15,.14), 0 0 0 1px rgba(10,20,15,.06)",
              opacity: listIn,
              transform: `translateY(${(1 - listIn) * 110}px) rotate(${(1 - listIn) * 3}deg)`,
              fontFamily: F.sans,
            }}
          >
            <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.12em", color: "#8a918d", marginBottom: 14 }}>LAUNCH CHECKLIST</div>
            {[
              { label: "Ship the AI research panel", done: 3.3 },
              { label: "Write the changelog", done: 3.55 },
              { label: "Record the demo", done: undefined },
            ].map((row, i) => {
              const dk = row.done ? progress(t, row.done, 0.3, "out") : 0;
              const last = i === 2;
              const wig = last ? Math.sin(t * 38) * 4 * clamp01(1 - Math.abs(t - 4.45) / 0.3) : 0;
              return (
                <div key={row.label} style={{ position: "relative", height: 72, display: "flex", alignItems: "center", gap: 22, borderTop: i ? "1px solid rgba(10,20,15,.07)" : undefined }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, border: `2.5px solid ${dk > 0 ? C.ink : "#b7bdb9"}`, background: dk > 0 ? C.ink : "transparent", display: "grid", placeItems: "center", transform: `rotate(${wig}deg)` }}>
                    {dk > 0 && (
                      <svg width={22} height={22} viewBox="0 0 24 24">
                        <path d="M5 12.5 L10 17 L19 7" fill="none" stroke={C.lime} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - dk} />
                      </svg>
                    )}
                  </div>
                  <div style={{ position: "relative", fontSize: 32, fontWeight: last ? 700 : 500, color: dk > 0 ? "#9aa19d" : C.ink }}>
                    {row.label}
                    {dk > 0 && <span style={{ position: "absolute", left: 0, top: "52%", height: 2.5, width: `${dk * 100}%`, background: "#9aa19d" }} />}
                    {last && (
                      <div style={{ position: "absolute", left: -84, top: -24 }}>
                        <Scribble t={t} at={4.25} w={440} h={96} color={C.green} kind="circle" dur={0.6} stroke={5} />
                      </div>
                    )}
                  </div>
                  {last && (
                    <div style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 18, color: "#b3261e", background: "#fde8e6", borderRadius: 999, padding: "6px 14px", opacity: progress(t, 4.6, 0.3) }}>
                      overdue · 3 releases
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ── B · problem: the grind, on a hard beat ─────────────────────────────────
const BEATS = [
  { w: "Record.", at: B.record },
  { w: "Retake.", at: B.retake },
  { w: "Zoom.", at: B.zoom },
  { w: "Crop.", at: B.crop },
  { w: "Export.", at: B.export },
];

export const Grind: React.FC<{ t: number }> = ({ t }) => {
  const beat = [...BEATS].reverse().findIndex((b) => t >= b.at);
  const idx = beat === -1 ? -1 : BEATS.length - 1 - beat;
  const inBeats = t >= B.record && t < 12.35;
  return (
    <AbsoluteFill>
      <Night />
      {t < B.record && <EditorGrind t={t} />}
      {inBeats && idx >= 0 && <BeatCard t={t} i={idx} />}
      {inBeats && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, display: "flex", justifyContent: "center", gap: 18 }}>
          {BEATS.map((b, i) => (
            <div key={b.w} style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: "0.08em", padding: "10px 20px", borderRadius: 999, color: i === idx ? C.limeInk : i < idx ? "#7d8782" : "#3b4541", background: i === idx ? C.lime : "rgba(255,255,255,.05)" }}>
              {b.w.replace(".", "").toUpperCase()}
            </div>
          ))}
        </div>
      )}
      {t >= 12.35 && <AllAgain t={t} />}
    </AbsoluteFill>
  );
};

const EditorGrind: React.FC<{ t: number }> = ({ t }) => {
  const k = progress(t, 5.45, 0.7, "expo");
  const sec = Math.max(0, t - 5.4) * 9;
  const ph = 0.5 + 0.42 * Math.sin((t - 5.4) * 2.6);
  const zk = 0.5 + 0.5 * Math.sin((t - 5.4) * 3.1);
  return (
    <AbsoluteFill>
      <At x={960} y={190}>
        <Words t={t} at={5.75} words={["Every", "demo.", "The", "same", { w: "grind.", accent: true }]} size={130} color="#f3f5f2" accentColor={C.lime} {...serif} stagger={0.12} />
      </At>
      <div style={{ position: "absolute", left: 310, top: 330, width: 1300, height: 620, borderRadius: 24, background: "#141b18", boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 50px 120px rgba(0,0,0,.5)", opacity: k, transform: `translateY(${(1 - k) * 80}px) scale(${0.94 + k * 0.06})`, overflow: "hidden" }}>
        <div style={{ height: 54, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.06)", fontFamily: F.mono, fontSize: 19, color: "#9aa39e" }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: C.red, opacity: Math.floor(t * 3) % 2 ? 1 : 0.35 }} />
          REC {`00:${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`}
          <span style={{ marginLeft: "auto" }}>demo_final_v7_REAL.mov</span>
        </div>
        <div style={{ position: "absolute", left: 40, top: 80, width: 1220, height: 330, borderRadius: 14, background: "#e9ece9", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + zk * 0.5})`, transformOrigin: "64% 60%" }}>
            <div style={{ position: "absolute", left: 40, top: 30, width: 200, height: 270, borderRadius: 10, background: "#dfe3df" }} />
            <div style={{ position: "absolute", left: 280, top: 40, width: 480, height: 26, borderRadius: 8, background: "#cfd4d0" }} />
            <div style={{ position: "absolute", left: 280, top: 90, width: 820, height: 64, borderRadius: 12, background: "#fff" }} />
            <div style={{ position: "absolute", left: 280, top: 180, width: 220, height: 56, borderRadius: 12, background: C.indigo }} />
          </div>
          <div style={{ position: "absolute", left: `${48 - zk * 14}%`, top: `${38 - zk * 10}%`, width: `${36 + zk * 28}%`, height: `${40 + zk * 30}%`, border: `3px dashed ${C.lime}`, borderRadius: 8 }} />
        </div>
        {[0, 1, 2].map((r) => (
          <div key={r} style={{ position: "absolute", left: 40, top: 440 + r * 52, width: 1220, height: 40, borderRadius: 8, background: "rgba(255,255,255,.03)" }}>
            {[0, 1, 2, 3, 4].map((c) => {
              const x = ((c * 23 + r * 11) % 90) + 2;
              const w = 8 + ((c * 7 + r * 5) % 12);
              return <div key={c} style={{ position: "absolute", left: `${x}%`, width: `${w}%`, top: 5, bottom: 5, borderRadius: 6, background: r === 0 ? "#3d6b52" : r === 1 ? "#4a4f7a" : "#6b5a3a", opacity: 0.9 }} />;
            })}
          </div>
        ))}
        <div style={{ position: "absolute", left: 40 + ph * 1220, top: 428, width: 3, height: 170, background: C.lime, boxShadow: `0 0 12px ${C.lime}` }} />
      </div>
    </AbsoluteFill>
  );
};

const BeatCard: React.FC<{ t: number; i: number }> = ({ t, i }) => {
  const b = BEATS[i];
  const lt = t - b.at;
  const s = kf(lt, [
    [0, 1.25],
    [0.22, 0.97, "expo"],
    [0.4, 1, "easy"],
  ]);
  const blur = Math.max(0, 1 - lt / 0.14) * 16;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 230, top: 540, transform: `translateY(-55%) scale(${s})`, transformOrigin: "left center", filter: blur ? `blur(${blur}px)` : undefined, fontFamily: F.serif, fontSize: 300, color: "#f3f5f2", letterSpacing: "-0.03em" }}>
        {b.w}
      </div>
      <div style={{ position: "absolute", left: 1170, top: 280, width: 520, height: 440, transform: `scale(${s})` }}>
        <Micro t={t} lt={lt} i={i} />
      </div>
    </AbsoluteFill>
  );
};

const Micro: React.FC<{ t: number; lt: number; i: number }> = ({ t, lt, i }) => {
  const panel: React.CSSProperties = { position: "absolute", inset: 0, borderRadius: 28, background: "#141b18", boxShadow: "0 0 0 1px rgba(255,255,255,.08)", overflow: "hidden" };
  if (i === 0) {
    const ring = (lt * 1.6) % 1;
    return (
      <div style={panel}>
        <At x={260} y={190}>
          <div style={{ position: "relative", width: 170, height: 170 }}>
            <div style={{ position: "absolute", inset: -ring * 60, borderRadius: "50%", border: `3px solid ${C.red}`, opacity: 1 - ring }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.red, boxShadow: `0 0 60px ${C.red}88` }} />
          </div>
        </At>
        <At x={260} y={350}>
          <div style={{ fontFamily: F.mono, fontSize: 34, color: "#f3f5f2" }}>REC 00:00:{String(Math.floor(lt * 9) % 60).padStart(2, "0")}</div>
        </At>
      </div>
    );
  }
  if (i === 1) {
    const n = 4 + Math.min(4, Math.floor(lt / 0.16));
    return (
      <div style={panel}>
        <At x={260} y={150}>
          <div style={{ fontFamily: F.mono, fontSize: 26, letterSpacing: "0.2em", color: "#7d8782" }}>TAKE</div>
        </At>
        <At x={260} y={270}>
          <div style={{ fontFamily: F.mono, fontSize: 190, color: C.lime, lineHeight: 1 }}>{String(n).padStart(2, "0")}</div>
        </At>
      </div>
    );
  }
  if (i === 2) {
    const z = progress(lt, 0.05, 0.6, "expo");
    return (
      <div style={panel}>
        <div style={{ position: "absolute", inset: 30, borderRadius: 16, background: "#e9ece9", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + z * 1.2})`, transformOrigin: "30% 72%" }}>
            <div style={{ position: "absolute", left: 30, top: 30, width: 260, height: 22, borderRadius: 7, background: "#cfd4d0" }} />
            <div style={{ position: "absolute", left: 30, top: 80, width: 400, height: 60, borderRadius: 12, background: "#fff" }} />
            <div style={{ position: "absolute", left: 30, top: 170, width: 190, height: 54, borderRadius: 12, background: C.indigo }} />
            <div style={{ position: "absolute", left: 30, top: 260, width: 400, height: 90, borderRadius: 12, background: "#dfe3df" }} />
          </div>
        </div>
        <div style={{ position: "absolute", right: 40, bottom: 36, fontFamily: F.mono, fontSize: 28, color: C.ink, background: C.lime, borderRadius: 10, padding: "4px 14px" }}>{Math.round(100 + z * 120)}%</div>
      </div>
    );
  }
  if (i === 3) {
    const c = progress(lt, 0.05, 0.5, "expo");
    const ins = 40 + c * 70;
    const L = (x: number, y: number, r: number) => <div style={{ position: "absolute", left: x - 4, top: y - 4, width: 46, height: 46, borderLeft: `8px solid ${C.lime}`, borderTop: `8px solid ${C.lime}`, transform: `rotate(${r}deg)`, transformOrigin: "4px 4px" }} />;
    return (
      <div style={panel}>
        <div style={{ position: "absolute", inset: 40, borderRadius: 12, background: "linear-gradient(135deg,#c9b8f5,#f5c4e0 60%,#b9d8f7)" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 ${ins}px rgba(11,16,14,.72)` }} />
        {L(ins, ins, 0)}
        {L(520 - ins, ins, 90)}
        {L(520 - ins, 440 - ins, 180)}
        {L(ins, 440 - ins, 270)}
      </div>
    );
  }
  const pk = kf(lt, [
    [0, 0],
    [0.45, 0.93, "expo"],
    [0.8, 0.99, "out"],
  ]);
  return (
    <div style={panel}>
      <div style={{ position: "absolute", left: 50, top: 150, display: "flex", alignItems: "center", gap: 18, fontFamily: F.sans, fontSize: 30, color: "#f3f5f2" }}>
        <Spinner t={t} size={34} color={C.lime} /> Exporting… <span style={{ fontFamily: F.mono, color: C.lime }}>{Math.round(pk * 100)}%</span>
      </div>
      <div style={{ position: "absolute", left: 50, right: 50, top: 230, height: 18, borderRadius: 9, background: "rgba(255,255,255,.08)" }}>
        <div style={{ width: `${pk * 100}%`, height: "100%", borderRadius: 9, background: C.lime }} />
      </div>
      <div style={{ position: "absolute", left: 50, top: 290, fontFamily: F.mono, fontSize: 22, color: "#7d8782" }}>about 12 minutes remaining</div>
    </div>
  );
};

const RING = "RECORD · RETAKE · ZOOM · CROP · EXPORT · ";

const AllAgain: React.FC<{ t: number }> = ({ t }) => {
  const k = progress(t, 12.35, 0.6, "expo");
  const change = progress(t, 13.05, 0.55, "expo");
  const stamp = kf(t, [
    [13.45, 0],
    [13.62, 1.12, "expo"],
    [13.8, 1, "easy"],
  ]);
  const part1Out = progress(t, 13.85, 0.4, "in");
  const r = progress(t, 13.95, 0.7, "expo");
  const collapse = progress(t, 15.7, 0.35, "in");
  const spin = (t - 13.95) * 40 + Math.max(0, t - 13.95) ** 2.2 * 35;
  const cur = cursorAt(
    [
      { t: 12.6, x: 700, y: 520 },
      { t: 13.05, x: 170, y: 240, click: true },
      { t: 13.65, x: 600, y: 368 },
    ],
    t,
  );
  return (
    <AbsoluteFill>
      {part1Out < 1 && (
        <AbsoluteFill style={{ opacity: 1 - part1Out, filter: `blur(${part1Out * 10}px)` }}>
          <At x={960} y={170}>
            <Words t={t} at={12.5} words={["Then", "your", "UI", { w: "changes.", accent: true }]} size={130} color="#f3f5f2" accentColor={C.lime} {...serif} stagger={0.1} />
          </At>
          {/* app card: the button moves + restyles */}
          <div style={{ position: "absolute", left: 300, top: 360, width: 760, height: 460, borderRadius: 26, background: "#f4f6f4", opacity: k, transform: `translateY(${(1 - k) * 60}px)`, overflow: "hidden", fontFamily: F.sans }}>
            <div style={{ position: "absolute", left: 40, top: 40, width: 280, height: 26, borderRadius: 8, background: "#cfd4d0" }} />
            <div style={{ position: "absolute", left: 40, top: 96, width: 680, height: 72, borderRadius: 14, background: "#fff", boxShadow: "0 0 0 1.5px #dde1de" }} />
            <div
              style={{
                position: "absolute",
                left: 40 + change * 420,
                top: 206 + change * 128,
                width: 260 + change * 20,
                height: 68,
                borderRadius: 14 + change * 20,
                background: change > 0.5 ? C.ink : C.indigo,
                color: change > 0.5 ? C.lime : "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              {change > 0.5 ? "Run research ↗" : "Start Research"}
            </div>
            <div style={{ position: "absolute", left: 40, top: 206 + (1 - change) * 110, width: 380, height: 90, borderRadius: 14, background: "#e3e7e4", opacity: 0.4 + change * 0.6 }} />
            <NamedCursor {...cur} opacity={1} />
          </div>
          {/* the demo you already exported */}
          <div style={{ position: "absolute", left: 1130, top: 420, width: 520, height: 330, borderRadius: 22, background: "#1a221e", boxShadow: "0 0 0 1px rgba(255,255,255,.08)", opacity: k, transform: `translateY(${(1 - k) * 90}px)` }}>
            <div style={{ position: "absolute", inset: 24, bottom: 70, borderRadius: 12, background: "linear-gradient(135deg,#d8dce0,#eef0ee)", display: "grid", placeItems: "center" }}>
              <svg width={70} height={70} viewBox="0 0 24 24">
                <circle cx={12} cy={12} r={11} fill="rgba(0,0,0,.55)" />
                <path d="M10 8 L16 12 L10 16 Z" fill="#fff" />
              </svg>
            </div>
            <div style={{ position: "absolute", left: 28, bottom: 22, fontFamily: F.mono, fontSize: 22, color: "#9aa39e" }}>demo-v3-final.mp4</div>
            {t >= 13.45 && (
              <At x={260} y={140}>
                <div style={{ transform: `rotate(-9deg) scale(${stamp})`, fontFamily: F.mono, fontWeight: 500, fontSize: 56, letterSpacing: "0.12em", color: C.red, border: `5px solid ${C.red}`, borderRadius: 12, padding: "6px 22px", background: "rgba(20,10,10,.55)" }}>
                  OUTDATED
                </div>
              </At>
            )}
          </div>
        </AbsoluteFill>
      )}
      {t >= 13.9 && (
        <AbsoluteFill style={{ transform: `scale(${1 - collapse})`, opacity: 1 - collapse * 0.3 }}>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: r }}>
            <defs>
              <path id="ring" d="M960,540 m-360,0 a360,360 0 1,1 720,0 a360,360 0 1,1 -720,0" />
            </defs>
            <g transform={`rotate(${spin} 960 540) translate(960 540) scale(${0.7 + r * 0.3}) translate(-960 -540)`}>
              <text fontFamily={F.mono} fontSize={41} fill={C.lime} letterSpacing={6}>
                <textPath href="#ring">{RING + RING}</textPath>
              </text>
            </g>
          </svg>
          <At x={960} y={470}>
            <Words t={t} at={14.0} words={["You", "do", "it"]} size={130} color="#f3f5f2" {...serif} stagger={0.08} />
          </At>
          <At x={960} y={610}>
            <Words t={t} at={14.3} words={[{ w: "all", accent: true }, { w: "again.", accent: true }]} size={130} color="#f3f5f2" accentColor={C.lime} {...serif} stagger={0.1} />
          </At>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
