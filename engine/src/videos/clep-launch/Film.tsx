import React from "react";
import { AbsoluteFill } from "remotion";
import { progress, lerp, clamp01 } from "@/kit/motion";
import { Words, BrowserFrame, NamedCursor, cursorAt, Flare } from "@/kit/ui/promo";
import { C, F, B } from "./theme";
import { At, Lockup, Pill, Arrow } from "./bits";
import { ResearchApp, BROWSER } from "./Agent";

const serif = { font: F.serif, accentFont: F.serif, monoFont: F.mono };
const PL = { x: 300, y: 250, w: 1320, h: 760 };
const GRAD = "linear-gradient(135deg,#c9b8f5 0%,#f5c4e0 55%,#b9d8f7 100%)";

// ── G · a finished film ────────────────────────────────────────────────────
export const Output: React.FC<{ t: number }> = ({ t }) => {
  const g = progress(t, 35.0, 0.85, "expo");
  const car = progress(t, 39.85, 0.9, "expo");
  const out = progress(t, 40.85, 0.4, "in");
  const rect = { x: lerp(BROWSER.x, PL.x, g), y: lerp(BROWSER.y, PL.y, g), w: lerp(BROWSER.w, PL.w, g), h: lerp(BROWSER.h, PL.h, g) };
  const push = progress(t, 35.8, 3.8, "smooth");
  const winScale = lerp(1, 0.8 + push * 0.06, g);
  const gk = progress(t, B.graded, 0.6, "inOut");
  const play = clamp01((t - 35.4) / 5.5);
  const drift = (t - 39.85) * 110;
  const slot0 = { x: 170 - drift * car, y: 560 };
  const cs = lerp(1, 520 / PL.w, car);
  const cx = lerp(PL.x + PL.w / 2, slot0.x + 260, car);
  const cy = lerp(PL.y + PL.h / 2, slot0.y, car);

  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined, transform: `translateX(${-out * 120}px)` }}>
      <At x={960} y={130} style={{ opacity: 1 - progress(t, 39.8, 0.3, "in") }}>
        <Words t={t} at={35.55} words={["A", { w: "finished", accent: true }, { w: "film.", accent: true }]} size={130} color={C.ink} accentColor={C.green} {...serif} stagger={0.12} />
      </At>
      {t >= 39.9 && (
        <At x={960} y={200}>
          <Words t={t} at={39.95} words={["Every", "feature.", "One", { w: "command.", accent: true }]} size={130} color={C.ink} accentColor={C.green} {...serif} stagger={0.08} />
        </At>
      )}

      {/* the player (morphed from the live browser) */}
      <div style={{ position: "absolute", left: cx - rect.w / 2, top: cy - rect.h / 2, width: rect.w, height: rect.h, transform: `scale(${cs})` }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: lerp(22, 28, g), overflow: "hidden", boxShadow: "0 50px 120px rgba(10,20,15,.22), 0 0 0 1px rgba(10,20,15,.08)", background: C.ink }}>
          <div style={{ position: "absolute", inset: 0, background: GRAD, opacity: g, filter: `saturate(${0.5 + gk * 0.5}) brightness(${0.94 + gk * 0.06})` }} />
          <div
            style={{
              position: "absolute",
              left: rect.w / 2 - BROWSER.w / 2,
              top: rect.h / 2 - BROWSER.h / 2 - g * 24,
              transform: `scale(${winScale})`,
              filter: `saturate(${lerp(1, 0.55 + gk * 0.45, g)}) contrast(${lerp(1, 0.94 + gk * 0.08, g)})`,
            }}
          >
            <BrowserFrame width={BROWSER.w} height={BROWSER.h} url="localhost:3000/research" font={F.sans}>
              <ResearchApp t={35.2} />
            </BrowserFrame>
          </div>
          {/* grade sweep */}
          {t > B.graded && t < B.graded + 0.8 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, width: 260, left: lerp(-300, rect.w + 40, gk), background: "linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0))" }} />
          )}
          {/* player chrome */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 86, background: "linear-gradient(0deg,rgba(8,12,10,.78),rgba(8,12,10,0))", opacity: g * (1 - car), display: "flex", alignItems: "center", gap: 22, padding: "0 30px" }}>
            <svg width={28} height={28} viewBox="0 0 24 24">
              <path d="M7 5 L19 12 L7 19 Z" fill="#fff" />
            </svg>
            <span style={{ fontFamily: F.mono, fontSize: 19, color: "#fff" }}>0:{String(Math.floor(play * 18)).padStart(2, "0")} / 0:18</span>
            <div style={{ position: "relative", flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,.25)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${play * 100}%`, borderRadius: 4, background: C.lime }} />
              {[0.2, 0.47, 0.74].map((p, i) => {
                const ck = progress(t, B.edited + i * 0.08, 0.35, "overshoot");
                return <div key={p} style={{ position: "absolute", left: `${p * 100}%`, top: -9, width: 3, height: 26, background: "#fff", transform: `scaleY(${ck})`, opacity: clamp01(ck) }} />;
              })}
              {[0.32, 0.6].map((p) => (
                <div key={p} style={{ position: "absolute", left: `${p * 100}%`, top: -7, width: 22, height: 22, background: C.lime, transform: `translateX(-50%) rotate(45deg) scale(${progress(t, 36.2, 0.4, "overshoot")})`, borderRadius: 3 }} />
              ))}
              <div style={{ position: "absolute", left: `${play * 100}%`, top: -8, width: 24, height: 24, borderRadius: "50%", background: "#fff", transform: "translateX(-50%)" }} />
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 19, color: "#fff" }}>ai-research.mp4</span>
          </div>
        </div>
        {car > 0.5 && <CardLabel text="/clep ai-research" k={progress(t, 40.2, 0.4)} h={rect.h} scale={1 / cs} />}
      </div>

      {/* what came back */}
      {car < 1 &&
        [
          { at: B.edited, label: "Edited", icon: "✂" },
          { at: B.graded, label: "Graded", icon: "◐" },
          { at: B.hd, label: "1080p60", icon: "", lime: true },
        ].map((c, i) => {
          const k = progress(t, c.at, 0.55, "overshoot");
          return (
            <div
              key={c.label}
              style={{
                position: "absolute",
                left: PL.x + PL.w - 90,
                top: 360 + i * 110,
                opacity: clamp01(k * 2) * (1 - car),
                transform: `translateX(${(1 - k) * 120}px) scale(${0.8 + k * 0.2})`,
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontFamily: c.lime ? F.mono : F.sans,
                fontWeight: 600,
                fontSize: 34,
                color: c.lime ? C.limeInk : C.ink,
                background: c.lime ? C.lime : "#fff",
                borderRadius: 999,
                padding: "16px 30px",
                boxShadow: "0 20px 44px rgba(10,20,15,.16)",
              }}
            >
              {c.icon && <span style={{ color: C.green }}>{c.icon}</span>}
              {c.label}
            </div>
          );
        })}

      {/* carousel: every feature */}
      {t >= 39.85 &&
        CARDS.map((c, i) => {
          const k = progress(t, 39.95 + i * 0.12, 0.8, "expo");
          const x = 170 + (i + 1) * 580 - drift + (1 - k) * 500;
          return (
            <div key={c.label} style={{ position: "absolute", left: x, top: 560 - 146, width: 520, height: 293, opacity: k, transform: `perspective(1400px) rotateY(${(1 - k) * -25}deg)` }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 22, overflow: "hidden", background: c.grad, boxShadow: "0 30px 70px rgba(10,20,15,.18)" }}>
                <div style={{ position: "absolute", left: 50, right: 50, top: 34, bottom: 0, borderRadius: "14px 14px 0 0", background: "#fff", overflow: "hidden" }}>
                  <c.Thumb />
                </div>
              </div>
              <CardLabel text={c.label} k={progress(t, 40.3 + i * 0.1, 0.4)} h={293} scale={1} />
            </div>
          );
        })}
    </AbsoluteFill>
  );
};

const CardLabel: React.FC<{ text: string; k: number; h: number; scale: number }> = ({ text, k, h, scale }) => (
  <div style={{ position: "absolute", left: 0, top: h + 26 * scale, fontFamily: F.mono, fontSize: 26 * scale, color: C.ink, opacity: k, transform: `translateY(${(1 - k) * 10 * scale}px)` }}>
    <span style={{ color: C.green }}>/clep</span>
    {text.replace("/clep", "")}
  </div>
);

const line = (w: number | string, h = 12, bg = "#e4e7e5"): React.CSSProperties => ({ width: w, height: h, borderRadius: h / 2, background: bg });

const DocThumb: React.FC = () => (
  <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
    <div style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 26, color: "#111" }}>
      PDF in. <span style={{ fontFamily: F.serif, fontStyle: "italic", fontWeight: 400 }}>Doc</span> out.
    </div>
    <div style={line(220, 8)} />
    <div style={{ width: 300, height: 100, borderRadius: 12, border: "2px dashed #cfd4d0", display: "grid", placeItems: "center" }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: C.lime }} />
    </div>
    <div style={{ width: 300, height: 26, borderRadius: 8, background: C.lime }} />
  </div>
);

const DashThumb: React.FC = () => (
  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", gap: 12 }}>
      {["$48.2k", "1,284", "3.9%"].map((v) => (
        <div key={v} style={{ flex: 1, borderRadius: 10, background: "#f3f4f8", padding: "10px 12px" }}>
          <div style={line(40, 7)} />
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 20, marginTop: 6, color: "#111" }}>{v}</div>
        </div>
      ))}
    </div>
    <svg width={320} height={110} viewBox="0 0 320 110">
      <path d="M0 95 C40 90 60 60 100 66 S160 30 200 40 S260 12 320 8" fill="none" stroke="#4f46e5" strokeWidth={4} strokeLinecap="round" />
      <path d="M0 95 C40 90 60 60 100 66 S160 30 200 40 S260 12 320 8 V110 H0 Z" fill="#4f46e522" />
    </svg>
  </div>
);

const CheckoutThumb: React.FC = () => (
  <div style={{ padding: "24px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 22, color: "#111" }}>Checkout</div>
    {[0, 1].map((i) => (
      <div key={i} style={{ height: 34, borderRadius: 8, boxShadow: "0 0 0 1.5px #e4e7e5", display: "flex", alignItems: "center", padding: "0 12px" }}>
        <div style={line(i ? 90 : 170, 9)} />
      </div>
    ))}
    <div style={{ height: 38, borderRadius: 10, background: "#111", color: "#fff", fontFamily: F.sans, fontWeight: 600, fontSize: 17, display: "grid", placeItems: "center" }}>Pay $49.00</div>
  </div>
);

const CARDS = [
  { label: "/clep doc-convert", grad: "linear-gradient(135deg,#d7c8fb,#f7cde3)", Thumb: DocThumb },
  { label: "/clep dashboard", grad: "linear-gradient(135deg,#c4e3f7,#d9d3fb)", Thumb: DashThumb },
  { label: "/clep checkout", grad: "linear-gradient(135deg,#e6f5c2,#c6ecd9)", Thumb: CheckoutThumb },
];

// ── H · build it, clep it, share it ────────────────────────────────────────
export const Close: React.FC<{ t: number }> = ({ t }) => {
  const settle = progress(t, 43.85, 0.8, "expo");
  const pill = progress(t, 44.4, 0.6, "overshoot");
  const cur = cursorAt(
    [
      { t: 44.9, x: 1560, y: 1060 },
      { t: 45.6, x: 1010, y: 760, click: true },
      { t: 46.8, x: 1130, y: 880 },
    ],
    t,
  );
  const press = clamp01(1 - Math.abs(t - 45.6) / 0.12);
  const flare = progress(t, 43.9, 1.2) * 0.45;
  const size = 150;
  return (
    <AbsoluteFill>
      <Flare x={960} y={300} r={700} color={C.lime} k={flare} />
      <At x={960} y={290}>
        {t >= 43.9 && <Lockup t={t} at={43.95} size={120} />}
      </At>
      <At x={960} y={lerp(540, 510, settle)}>
        <div style={{ display: "flex", gap: size * 0.3, alignItems: "baseline", whiteSpace: "nowrap" }}>
          <Words t={t} at={B.build} words={["Build", "it."]} size={size} color={C.ink} {...serif} stagger={0.1} />
          <Words t={t} at={B.clepIt} words={[{ w: "/clep", mono: true }, "it."]} size={size} color={C.ink} {...serif} monoBg={C.ink} monoColor={C.lime} stagger={0.1} />
          <Words t={t} at={B.shareIt} words={[{ w: "Share", accent: true }, { w: "it.", accent: true }]} size={size} color={C.ink} accentColor={C.green} {...serif} stagger={0.1} />
        </div>
      </At>
      <At x={960} y={740}>
        <div style={{ transform: `scale(${pill})`, opacity: clamp01(pill * 2) }}>
          <Pill size={38} pressed={press}>
            Ask for invite <Arrow size={36} color={C.limeInk} />
          </Pill>
        </div>
      </At>
      <At x={960} y={865}>
        <div style={{ fontFamily: F.mono, fontSize: 32, color: C.muted, opacity: progress(t, 44.8, 0.5), letterSpacing: "0.02em" }}>clep.abstraklabs.com</div>
      </At>
      <NamedCursor {...cur} opacity={progress(t, 44.9, 0.3) * (1 - progress(t, 46.9, 0.4))} />
    </AbsoluteFill>
  );
};
