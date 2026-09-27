import React from "react";
import { AbsoluteFill } from "remotion";
import { useLayout } from "@/engine/defineScene";
import { useSceneTime, useStyle } from "@/engine/SceneContext";
import { progress, clamp01, lerp } from "@/kit/motion/keyframes";
import { useKitTheme } from "@/kit/theme";
import { alpha, mix } from "@/kit/lib/color";
import { Accent } from "@/kit/ui/bits";
import { AppLogo, AppLogoRefT } from "@/kit/ui/AppLogo";

/*
 * Ways to film "the product doing the work". Same data (request → findings → payoff), different shot:
 *   terminal  a mono log streaming with timestamps; findings print in the accent
 *   sheet     a spreadsheet: rows appear, value cells fill and flash, camera pushes into the cell that lands
 *   nodes     each source (its logo) wired to the agent in the middle; wires light up, findings pop beside them
 *   document  a memo writes itself: heading, sentences, values as inline chips
 *   cards     one finding per card, big, sliding in like a carousel; the last card is the payoff
 */

export type Step = { text: string; value?: string; dir?: "up" | "down" | "none"; logo?: AppLogoRefT };
export type TraceData = { prompt: string; steps: Step[]; result?: string; resultAccent?: string; status?: string };

const arrow = (d?: string) => (d === "up" ? "▲" : d === "down" ? "▼" : "");
const clean = (s: Step) => (s.dir && s.dir !== "none" ? (s.value ?? "").replace(/^[+\-−]\s?/, "") : s.value ?? "");

/** Shared schedule: typing, then one finding per `per` seconds, then the payoff. */
function useSchedule(d: TraceData, typeCps = 34) {
  const { t, dur } = useSceneTime();
  const typeEnd = 0.2 + d.prompt.length / typeCps;
  const start = typeEnd + 0.45;
  const hold = d.result ? 1.9 : 0.3;
  const per = Math.max(0.7, Math.min(1.6, (dur - start - hold) / d.steps.length));
  const at = d.steps.map((_, i) => start + i * per);
  const resultAt = d.result ? at[at.length - 1] + per * 0.85 : Infinity;
  return { t, dur, typeEnd, start, per, at, resultAt };
}

const Payoff: React.FC<{ d: TraceData; at: number; size: number }> = ({ d, at, size }) => {
  const { t } = useSceneTime();
  const theme = useKitTheme();
  const style = useStyle();
  if (!d.result || t < at) return null;
  const k = progress(t, at, 0.6, "expo");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: alpha(theme.background.startsWith("#") ? theme.background : "#ffffff", 0.9 * k) }}>
      <div style={{ fontFamily: theme.fontDisplay, fontSize: size, fontWeight: theme.displayWeight ?? style.weight, letterSpacing: `${style.tracking}em`, color: theme.foreground, textAlign: "center", lineHeight: 1.05, maxWidth: "84%", opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
        <Accent text={d.result} accent={d.resultAccent} />
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- terminal */

export const TraceTerminal: React.FC<{ d: TraceData }> = ({ d }) => {
  const { t, typeEnd, at, resultAt } = useSchedule(d, 40);
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const size = Math.min(40 * u, (width * 0.8) / 46);
  // The terminal is always dark: findings print in a bright tint of the brand accent so they read on black.
  const green = mix(theme.accent.startsWith("#") ? theme.accent : "#7ee787", "#ffffff", 0.35);
  const typed = d.prompt.slice(0, Math.max(0, Math.floor((t - 0.2) * 40)));
  const lines = at.filter((a) => t >= a).length;
  const stamp = (i: number) => `00:0${Math.min(9, 1 + i)}.${String(137 * (i + 3)).slice(-3)}`;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: width * 0.8, height: height * 0.72, borderRadius: 22 * u, background: "#0c0d0f", boxShadow: `0 ${40 * u}px ${90 * u}px -${40 * u}px rgba(0,0,0,.55)`, overflow: "hidden", transform: `scale(${lerp(0.98, 1.03, clamp01(t / 8))})` }}>
        <div style={{ display: "flex", gap: 10 * u, padding: `${18 * u}px ${22 * u}px`, borderBottom: "1px solid #1d1f23" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 14 * u, height: 14 * u, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{ padding: `${30 * u}px ${36 * u}px`, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: size, lineHeight: 1.7, color: "#e6e6e6" }}>
          <div>
            <span style={{ color: green }}>❯</span> {typed}
            {t < typeEnd + 0.2 && <span style={{ opacity: Math.floor(t * 2.4) % 2 ? 0 : 1 }}>▍</span>}
          </div>
          {t > typeEnd + 0.2 && <div style={{ color: "#7c8088" }}>{d.status ?? "investigating"}{".".repeat(1 + (Math.floor(t * 3) % 3))}</div>}
          {d.steps.map((s, i) =>
            t >= at[i] ? (
              <div key={i} style={{ opacity: progress(t, at[i], 0.15, "out") }}>
                <span style={{ color: "#5b5f66" }}>[{stamp(i)}]</span> {s.text.slice(0, Math.floor((t - at[i]) * 60))}
                {s.value && t > at[i] + s.text.length / 60 + 0.1 && (
                  <span style={{ color: green, fontWeight: 700 }}>
                    {"  "}
                    {arrow(s.dir)} {clean(s)}
                  </span>
                )}
              </div>
            ) : null,
          )}
          {lines === d.steps.length && t < resultAt && <div style={{ color: green }}>✓ done</div>}
        </div>
      </div>
      <Payoff d={d} at={resultAt} size={112 * u} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- sheet */

export const TraceSheet: React.FC<{ d: TraceData }> = ({ d }) => {
  const { t, at, per, resultAt } = useSchedule(d);
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const rowH = 96 * u;
  const cols = [width * 0.06, width * 0.5, width * 0.22];
  const gridW = cols.reduce((a, b) => a + b, 0);
  const active = Math.max(0, at.filter((a) => t >= a).length - 1);
  // camera: push toward the row that's filling
  const zoom = lerp(1, 1.18, progress(t, at[0] ?? 0, 1, "expo"));
  const focusY = 110 * u + active * rowH + rowH / 2;
  const line = mix(theme.foreground, theme.background, 0.84);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", left: (width - gridW) / 2, top: height * 0.5 - focusY * zoom, width: gridW, transform: `scale(${zoom})`, transformOrigin: `50% 0`, fontFamily: theme.fontBody, color: theme.foreground }}>
        <div style={{ display: "flex", height: 110 * u, alignItems: "flex-end", paddingBottom: 14 * u, fontSize: 24 * u, color: theme.mutedForeground, fontWeight: 600, borderBottom: `2px solid ${line}` }}>
          <div style={{ width: cols[0] }} />
          <div style={{ width: cols[1] }}>{d.prompt.length > 48 ? "Finding" : d.prompt}</div>
          <div style={{ width: cols[2], textAlign: "right" }}>Value</div>
        </div>
        {d.steps.map((s, i) => {
          const k = progress(t, at[i], 0.3, "out");
          const fill = progress(t, at[i] + per * 0.35, 0.25, "overshoot");
          const flash = clamp01(1 - (t - at[i] - per * 0.35) / 0.8) * (t > at[i] + per * 0.35 ? 1 : 0);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", height: rowH, borderBottom: `1px solid ${line}`, opacity: t >= at[i] ? 1 : 0.18 }}>
              <div style={{ width: cols[0], fontSize: 22 * u, color: theme.mutedForeground, fontVariantNumeric: "tabular-nums" }}>{i + 2}</div>
              <div style={{ width: cols[1], fontSize: 40 * u, fontWeight: 600, display: "flex", gap: 16 * u, alignItems: "center", opacity: k }}>
                {s.logo && <AppLogo logo={s.logo} size={46 * u} />}
                {s.text}
              </div>
              <div style={{ width: cols[2], textAlign: "right", fontSize: 44 * u, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: theme.accentText }}>
                <span style={{ display: "inline-block", padding: `${4 * u}px ${14 * u}px`, borderRadius: 8 * u, background: alpha(theme.accent.startsWith("#") ? theme.accent : "#3B6FE0", 0.22 * flash), transform: `scale(${lerp(0.6, 1, fill)})`, opacity: fill }}>
                  {arrow(s.dir)} {clean(s)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Payoff d={d} at={resultAt} size={112 * u} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- nodes */

export const TraceNodes: React.FC<{ d: TraceData }> = ({ d }) => {
  const { t, at, resultAt } = useSchedule(d);
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const cx = width / 2, cy = height / 2;
  const R = Math.min(width, height) * 0.36;
  const hub = 150 * u;
  const n = d.steps.length;
  const pos = d.steps.map((_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.3;
    return [cx + Math.cos(a) * R * 1.35, cy + Math.sin(a) * R] as const;
  });
  const hubIn = progress(t, 0, 0.6, "overshoot");
  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {pos.map(([x, y], i) => {
          const k = progress(t, at[i] - 0.3, 0.5, "inOut");
          return (
            <line key={i} x1={cx} y1={cy} x2={lerp(cx, x, k)} y2={lerp(cy, y, k)} stroke={t >= at[i] ? theme.accentText : mix(theme.foreground, theme.background, 0.8)} strokeWidth={3 * u} strokeDasharray={t >= at[i] ? undefined : `${8 * u} ${8 * u}`} />
          );
        })}
      </svg>
      {/* the agent: the brand's own mark in the middle */}
      <div style={{ position: "absolute", left: cx - hub / 2, top: cy - hub / 2, width: hub, height: hub, borderRadius: "50%", background: theme.foreground, color: theme.background, display: "grid", placeItems: "center", fontFamily: theme.fontDisplay, fontSize: 30 * u, fontWeight: 700, transform: `scale(${hubIn * (1 + 0.04 * Math.sin(t * 5))})`, boxShadow: `0 0 0 ${14 * u}px ${alpha(theme.accent.startsWith("#") ? theme.accent : "#3B6FE0", 0.18)}` }}>
        {theme.name}
      </div>
      {d.steps.map((s, i) => {
        const [x, y] = pos[i];
        const k = progress(t, at[i], 0.35, "overshoot");
        const right = x > cx;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, transform: `translate(${right ? 0 : -100}%, -50%) scale(${lerp(0.7, 1, k)})`, transformOrigin: right ? "0 50%" : "100% 50%", opacity: clamp01(k * 1.5), display: "flex", flexDirection: right ? "row" : "row-reverse", alignItems: "center", gap: 18 * u, fontFamily: theme.fontBody }}>
            <AppLogo logo={s.logo} name={s.text} size={78 * u} />
            <div style={{ textAlign: right ? "left" : "right" }}>
              <div style={{ fontSize: 30 * u, fontWeight: 600, color: theme.foreground }}>{s.text}</div>
              {s.value && <div style={{ fontSize: 44 * u, fontWeight: 750, color: theme.accentText, fontVariantNumeric: "tabular-nums" }}>{arrow(s.dir)} {clean(s)}</div>}
            </div>
          </div>
        );
      })}
      <Payoff d={d} at={resultAt} size={112 * u} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- document */

export const TraceDocument: React.FC<{ d: TraceData }> = ({ d }) => {
  const { t, at, resultAt } = useSchedule(d, 60);
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const pageW = Math.min(width * 0.64, 1200 * u);
  const scroll = Math.max(0, at.filter((a) => t >= a).length - 3) * 74 * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", overflow: "hidden" }}>
      <div style={{ marginTop: height * 0.1, width: pageW, minHeight: height * 1.1, background: theme.card, borderRadius: 14 * u, boxShadow: `0 ${30 * u}px ${80 * u}px -${30 * u}px ${alpha("#0A0F1E", 0.3)}`, padding: `${70 * u}px ${80 * u}px`, boxSizing: "border-box", color: theme.cardForeground, transform: `translateY(${-scroll}px) rotate(${lerp(-1.2, 0, progress(t, 0, 1, "expo"))}deg)` }}>
        <div style={{ fontFamily: theme.fontBody, fontSize: 18 * u, letterSpacing: "0.14em", color: theme.mutedForeground, fontWeight: 600 }}>{(theme.name || "REPORT").toUpperCase()} · MEMO</div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 72 * u, fontWeight: theme.displayWeight ?? style.weight, letterSpacing: `${style.tracking}em`, margin: `${18 * u}px 0 ${30 * u}px`, lineHeight: 1.08 }}>
          {d.prompt.slice(0, Math.floor((t - 0.2) * 60)).replace(/^./, (c) => c.toUpperCase())}
        </div>
        {d.steps.map((s, i) => {
          if (t < at[i]) return null;
          const shown = s.text.slice(0, Math.floor((t - at[i]) * 55));
          const chip = progress(t, at[i] + s.text.length / 55 + 0.05, 0.3, "overshoot");
          return (
            <p key={i} style={{ fontFamily: theme.fontBody, fontSize: 44 * u, lineHeight: 1.4, margin: `0 0 ${24 * u}px` }}>
              <span style={{ color: theme.mutedForeground }}>{i + 1}. </span>
              {shown}
              {s.value && (
                <span style={{ display: "inline-block", marginLeft: 12 * u, padding: `${2 * u}px ${14 * u}px`, borderRadius: 999, background: alpha(theme.accent.startsWith("#") ? theme.accent : "#3B6FE0", 0.18), color: theme.accentText, fontWeight: 700, transform: `scale(${chip})`, opacity: chip }}>
                  {arrow(s.dir)} {clean(s)}
                </span>
              )}
            </p>
          );
        })}
      </div>
      <Payoff d={d} at={resultAt} size={112 * u} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- cards */

export const TraceCards: React.FC<{ d: TraceData }> = ({ d }) => {
  const { t, at, resultAt } = useSchedule(d);
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const cardW = width * 0.46, gap = 50 * u;
  const idx = at.filter((a) => t >= a).length - 1;
  // carousel position eases to the newest card
  let x = 0;
  at.forEach((a, i) => { if (i > 0) x += progress(t, a - 0.1, 0.55, "expo") * (cardW + gap); });
  const typed = d.prompt.slice(0, Math.max(0, Math.floor((t - 0.2) * 34)));
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", top: height * 0.1, width: "100%", textAlign: "center", fontFamily: theme.fontBody, fontSize: 34 * u, color: theme.mutedForeground }}>
        “{typed}”
      </div>
      <div style={{ position: "absolute", top: height * 0.24, left: (width - cardW) / 2 - x, display: "flex", gap }}>
        {d.steps.map((s, i) => {
          const k = progress(t, at[i], 0.45, "expo");
          const focus = i === Math.max(0, idx) ? 1 : 0.45;
          return (
            <div key={i} style={{ width: cardW, height: height * 0.56, flex: "none", borderRadius: 34 * u, background: i === idx ? theme.foreground : theme.card, color: i === idx ? theme.background : theme.cardForeground, padding: 56 * u, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", opacity: t >= at[i] ? focus : 0.12, transform: `translateY(${(1 - k) * 40 * u}px)`, boxShadow: `0 ${30 * u}px ${70 * u}px -${30 * u}px ${alpha("#0A0F1E", 0.35)}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 * u, fontFamily: theme.fontBody, fontSize: 30 * u, fontWeight: 600 }}>
                <AppLogo logo={s.logo} name={s.text} size={60 * u} />
                <span style={{ opacity: 0.7 }}>0{i + 1}</span>
              </div>
              <div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 60 * u, fontWeight: theme.displayWeight ?? style.weight, letterSpacing: `${style.tracking}em`, lineHeight: 1.05 }}>{s.text}</div>
                {s.value && <div style={{ fontFamily: theme.fontBody, fontSize: 88 * u, fontWeight: 750, marginTop: 16 * u, color: i === idx ? theme.accent : theme.accentText, fontVariantNumeric: "tabular-nums" }}>{arrow(s.dir)} {clean(s)}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <Payoff d={d} at={resultAt} size={112 * u} />
    </AbsoluteFill>
  );
};
