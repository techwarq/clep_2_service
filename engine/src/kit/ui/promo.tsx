import React from "react";
import { progress, clamp01, rand } from "../motion/keyframes";
import { springTrack } from "../motion/springTrack";

/**
 * Motion-graphics UI primitives for launch films: product UI is *recreated*
 * (vector-sharp, simplified) instead of screen-recorded. Everything is driven
 * by `t` in seconds so a scene can be timed against voiceover onsets.
 */

// ── kinetic words ─────────────────────────────────────────────────────────
export type Word = string | { w: string; accent?: boolean; mono?: boolean; strike?: boolean };

export const Words: React.FC<{
  t: number;
  at: number;
  words: Word[];
  size: number;
  stagger?: number;
  out?: number;
  color?: string;
  accentColor?: string;
  font: string;
  accentFont?: string;
  monoFont?: string;
  monoBg?: string;
  monoColor?: string;
  align?: "center" | "left";
  style?: React.CSSProperties;
  tracking?: number;
  /** seconds each word takes to settle; launch-film pacing wants ~0.9–1.2 */
  dur?: number;
  italicAccent?: boolean;
}> = ({ t, at, words, size, stagger = 0.07, dur = 0.6, italicAccent = true, out, color = "#111", accentColor = color, font, accentFont, monoFont, monoBg = "#111", monoColor = "#fff", align = "center", style, tracking = -0.02 }) => {
  const ko = out === undefined ? 0 : progress(t, out, 0.35, "in");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "nowrap",
        width: "max-content",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "baseline",
        columnGap: size * 0.24,
        fontFamily: font,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: `${tracking}em`,
        color,
        ...style,
      }}
    >
      {words.map((wd, i) => {
        const o = typeof wd === "string" ? { w: wd } : wd;
        const k = progress(t, at + i * stagger, dur, "expo");
        const y = (1 - k) * size * (dur > 0.8 ? 0.2 : 0.45) - ko * size * 0.3;
        const blur = (1 - k) * 14 + ko * 10;
        const op = k * (1 - ko);
        const base: React.CSSProperties = {
          display: "inline-block",
          transform: `translateY(${y}px)`,
          filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
          opacity: op,
          whiteSpace: "pre",
          position: "relative",
        };
        if (o.mono)
          return (
            <span key={i} style={{ ...base, fontFamily: monoFont, fontSize: size * 0.78, background: monoBg, color: monoColor, borderRadius: size * 0.16, padding: `${size * 0.02}px ${size * 0.18}px`, letterSpacing: 0, alignSelf: "center" }}>
              {o.w}
            </span>
          );
        return (
          <span key={i} style={{ ...base, fontFamily: o.accent ? accentFont ?? font : font, fontStyle: o.accent && italicAccent ? "italic" : undefined, color: o.accent ? accentColor : undefined }}>
            {o.w}
            {o.strike && <Strike t={t} at={at + i * stagger + 0.35} color={accentColor} />}
          </span>
        );
      })}
    </div>
  );
};

const Strike: React.FC<{ t: number; at: number; color: string }> = ({ t, at, color }) => {
  const k = progress(t, at, 0.35, "out");
  return <span style={{ position: "absolute", left: -4, right: -4, top: "54%", height: 6, background: color, borderRadius: 3, transformOrigin: "left", transform: `scaleX(${k}) rotate(-2deg)` }} />;
};

// ── hand-drawn marks ──────────────────────────────────────────────────────
export const Scribble: React.FC<{ t: number; at: number; w: number; h: number; color: string; kind?: "underline" | "circle"; dur?: number; stroke?: number }> = ({
  t,
  at,
  w,
  h,
  color,
  kind = "underline",
  dur = 0.5,
  stroke = 6,
}) => {
  const k = progress(t, at, dur, "out");
  const d =
    kind === "underline"
      ? `M4 ${h * 0.6} C ${w * 0.25} ${h * 0.2}, ${w * 0.55} ${h * 0.95}, ${w - 4} ${h * 0.35}`
      : `M${w * 0.52} ${h * 0.06} C ${w * 0.95} ${h * 0.02}, ${w * 1.0} ${h * 0.9}, ${w * 0.5} ${h * 0.95} C ${w * 0.02} ${h * 0.98}, ${w * 0.0} ${h * 0.1}, ${w * 0.56} ${h * 0.12}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", overflow: "visible", pointerEvents: "none" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} />
    </svg>
  );
};

// ── dot matrix ────────────────────────────────────────────────────────────
/** Halftone dot grid with a travelling wave; `pull` (0–1) drags every dot to (cx, cy). */
export const DotField: React.FC<{
  t: number;
  w: number;
  h: number;
  gap?: number;
  color: string;
  hot?: string;
  hotAt?: { x: number; y: number; r: number; k: number };
  pull?: number;
  cx?: number;
  cy?: number;
  opacity?: number;
}> = ({ t, w, h, gap = 34, color, hot, hotAt, pull = 0, cx = w / 2, cy = h / 2, opacity = 1 }) => {
  const dots: React.ReactNode[] = [];
  const cols = Math.ceil(w / gap) + 1;
  const rows = Math.ceil(h / gap) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * gap + ((r % 2) * gap) / 2;
      const y0 = r * gap;
      const dx = x0 - cx;
      const dy = y0 - cy;
      const dist = Math.hypot(dx, dy);
      const wave = 0.5 + 0.5 * Math.sin(dist / 90 - t * 3.2);
      let rad = 1.2 + wave * 2.6;
      let fill = color;
      let a = 0.18 + wave * 0.35;
      if (hotAt && hot) {
        const hd = Math.hypot(x0 - hotAt.x, y0 - hotAt.y);
        const hk = clamp01(1 - hd / hotAt.r) * hotAt.k;
        if (hk > 0.02) {
          rad += hk * 3.5;
          a = a + hk * 0.7;
          fill = hot;
        }
      }
      const delay = rand(r * 131 + c) * 0.25;
      const pk = clamp01((pull - delay) / (1 - 0.25));
      const e = pk * pk * (3 - 2 * pk);
      const x = x0 + (cx - x0) * e;
      const y = y0 + (cy - y0) * e;
      dots.push(<circle key={r * cols + c} cx={x} cy={y} r={rad * (1 - e * 0.6)} fill={fill} opacity={Math.min(1, a) * opacity} />);
    }
  }
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      {dots}
    </svg>
  );
};

export const Flare: React.FC<{ x: number; y: number; r: number; color: string; k: number }> = ({ x, y, r, color, k }) => (
  <div
    style={{
      position: "absolute",
      left: x - r,
      top: y - r,
      width: r * 2,
      height: r * 2,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, ${color}88 25%, ${color}00 68%)`,
      opacity: k,
      transform: `scale(${0.4 + k * 0.6})`,
      pointerEvents: "none",
    }}
  />
);

// ── cursor ────────────────────────────────────────────────────────────────
export type CursorKey = { t: number; x: number; y: number; click?: boolean };

/** Spring-eased cursor path; a key with `click` presses exactly at its `t`. */
export function cursorAt(keys: CursorKey[], t: number) {
  const xs = springTrack(keys.map((k) => ({ t: k.t - 0.45, v: k.x })), 11, 0.92);
  const ys = springTrack(keys.map((k) => ({ t: k.t - 0.45, v: k.y })), 11, 0.92);
  const clicks = keys.filter((k) => k.click).map((k) => k.t);
  const last = [...clicks].reverse().find((c) => t >= c);
  return { x: xs(t), y: ys(t), pressed: clicks.some((c) => t >= c - 0.07 && t < c + 0.09), sinceClick: last === undefined ? 99 : t - last };
}

export const NamedCursor: React.FC<{ x: number; y: number; pressed?: boolean; sinceClick?: number; label?: string; color?: string; labelColor?: string; opacity?: number; size?: number }> = ({
  x,
  y,
  pressed,
  sinceClick = 99,
  label,
  color = "#111",
  labelColor = "#fff",
  opacity = 1,
  size = 34,
}) => {
  const rp = clamp01(sinceClick / 0.5);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, pointerEvents: "none", zIndex: 60 }}>
      {sinceClick < 0.5 && (
        <div
          style={{
            position: "absolute",
            left: -36 * rp - 8,
            top: -36 * rp - 8,
            width: 72 * rp + 16,
            height: 72 * rp + 16,
            borderRadius: "50%",
            border: `3px solid ${color}`,
            opacity: 1 - rp,
          }}
        />
      )}
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `translate(-3px,-2px) scale(${pressed ? 0.82 : 1})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.28))" }}>
        <path d="M3 2 L3 19 L7.6 14.6 L10.6 21.4 L13.6 20.1 L10.7 13.5 L17 13.5 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
      {label && (
        <div style={{ position: "absolute", left: size * 0.62, top: size * 0.78, background: color, color: labelColor, fontSize: size * 0.5, fontWeight: 600, padding: `${size * 0.1}px ${size * 0.3}px`, borderRadius: size * 0.4, whiteSpace: "nowrap", boxShadow: "0 6px 14px rgba(0,0,0,.18)" }}>
          {label}
        </div>
      )}
    </div>
  );
};

// ── status glyphs ─────────────────────────────────────────────────────────
export const Spinner: React.FC<{ t: number; size: number; color: string }> = ({ t, size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${t * 540}deg)` }}>
    <circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={3} />
    <path d="M12 3 A9 9 0 0 1 21 12" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
  </svg>
);

export const Check: React.FC<{ k: number; size: number; bg: string; fg: string }> = ({ k, size, bg, fg }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `scale(${0.6 + 0.4 * Math.min(1, k * 1.2)})` }}>
    <circle cx={12} cy={12} r={11} fill={bg} opacity={clamp01(k * 2)} />
    <path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke={fg} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} />
  </svg>
);

/** One row of an agent's progress log: pending → running (spinner) → done (drawn check). */
export const AgentStep: React.FC<{
  t: number;
  at: number;
  doneAt?: number;
  title: string;
  sub?: React.ReactNode;
  font: string;
  mono: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
}> = ({ t, at, doneAt, title, sub, font, mono, ink, muted, accent, accentInk }) => {
  const k = progress(t, at, 0.5, "expo");
  if (k <= 0) return null;
  const done = doneAt !== undefined && t >= doneAt;
  const dk = doneAt === undefined ? 0 : progress(t, doneAt, 0.35, "out");
  const sk = progress(t, (doneAt ?? at + 0.4) - 0.1, 0.45, "expo");
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", opacity: k, transform: `translateY(${(1 - k) * 24}px)`, filter: `blur(${(1 - k) * 8}px)` }}>
      <div style={{ width: 34, height: 34, flex: "none", display: "grid", placeItems: "center", marginTop: 2 }}>
        {done ? <Check k={dk} size={34} bg={accent} fg={accentInk} /> : <Spinner t={t} size={30} color={ink} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: font, fontSize: 30, fontWeight: 600, color: ink, letterSpacing: "-0.01em" }}>{title}</div>
        {sub && (
          <div style={{ fontFamily: mono, fontSize: 21, color: muted, opacity: sk, transform: `translateY(${(1 - sk) * 10}px)` }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};

// ── typed text ────────────────────────────────────────────────────────────
export function typed(text: string, t: number, at: number, dur: number) {
  const k = clamp01((t - at) / dur);
  return text.slice(0, Math.round(k * text.length));
}

export const Caret: React.FC<{ t: number; color: string; h: number; solid?: boolean }> = ({ t, color, h, solid }) => (
  <span style={{ display: "inline-block", width: 3, height: h, background: color, marginLeft: 3, verticalAlign: "middle", opacity: solid || Math.floor(t * 2.2) % 2 === 0 ? 1 : 0 }} />
);

// ── chat composer ─────────────────────────────────────────────────────────
/**
 * A chat / command composer (Claude Code, ChatGPT, Cursor-style): header label,
 * typed prompt with caret, optional slash-command popover, and a send button that
 * depresses on `sendAt`. Width/height are the resting box; everything else is t-driven.
 */
export const ChatComposer: React.FC<{
  t: number;
  width: number;
  label: React.ReactNode;
  text: string;
  placeholder?: string;
  typingAt: number;
  typingDur: number;
  sendAt?: number;
  commands?: { name: string; desc: string }[];
  commandsFrom?: number;
  commandsTo?: number;
  font: string;
  mono: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  card?: string;
  chips?: string[];
}> = ({ t, width, label, text, placeholder = "Ask anything…", typingAt, typingDur, sendAt, commands, commandsFrom = 0, commandsTo = 0, font, mono, ink, muted, accent, accentInk, card = "rgba(255,255,255,.86)", chips = [] }) => {
  const shown = typed(text, t, typingAt, typingDur);
  const sent = sendAt !== undefined && t >= sendAt;
  const pressK = sendAt === undefined ? 0 : clamp01(1 - Math.abs(t - sendAt) / 0.12);
  const popK = commands ? progress(t, commandsFrom, 0.25, "expo") * (1 - progress(t, commandsTo, 0.2, "in")) : 0;
  const slash = shown.startsWith("/") ? shown.split(" ")[0] : "";
  const rest = slash ? shown.slice(slash.length) : shown;
  return (
    <div style={{ position: "relative", width }}>
      {commands && popK > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: 28,
            bottom: "100%",
            marginBottom: 14,
            width: 560,
            background: "#fff",
            borderRadius: 18,
            padding: 10,
            boxShadow: "0 24px 60px rgba(10,20,15,.18), 0 0 0 1px rgba(10,20,15,.06)",
            opacity: popK,
            transform: `translateY(${(1 - popK) * 16}px) scale(${0.96 + popK * 0.04})`,
            transformOrigin: "bottom left",
          }}
        >
          {commands.map((c, i) => (
            <div key={c.name} style={{ display: "flex", gap: 18, alignItems: "baseline", padding: "12px 16px", borderRadius: 12, background: i === 0 ? `${accent}66` : "transparent" }}>
              <span style={{ fontFamily: mono, fontSize: 24, color: ink, fontWeight: 500 }}>{c.name}</span>
              <span style={{ fontFamily: font, fontSize: 20, color: muted }}>{c.desc}</span>
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          background: card,
          backdropFilter: "blur(24px)",
          borderRadius: 30,
          padding: "26px 30px 22px",
          boxShadow: "0 40px 90px rgba(10,20,15,.16), 0 0 0 1px rgba(10,20,15,.07)",
        }}
      >
        <div style={{ fontFamily: font, fontSize: 20, color: muted, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>{label}</div>
        <div style={{ fontFamily: font, fontSize: 38, color: ink, minHeight: 52, letterSpacing: "-0.01em", whiteSpace: "pre" }}>
          {shown.length === 0 && !sent ? (
            <span style={{ color: muted, opacity: 0.6 }}>
              <Caret t={t} color={ink} h={40} />
              {placeholder}
            </span>
          ) : (
            <>
              {slash && <span style={{ fontFamily: mono, background: ink, color: accent, borderRadius: 10, padding: "2px 12px", fontSize: 34 }}>{slash}</span>}
              {rest}
              {!sent && <Caret t={t} color={ink} h={40} solid={t < typingAt + typingDur} />}
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {chips.map((c) => (
              <span key={c} style={{ fontFamily: font, fontSize: 19, color: muted, border: "1.5px solid rgba(10,20,15,.12)", borderRadius: 999, padding: "6px 16px" }}>
                {c}
              </span>
            ))}
          </div>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: shown.length ? accent : "rgba(10,20,15,.08)",
              display: "grid",
              placeItems: "center",
              transform: `scale(${1 - pressK * 0.14})`,
              boxShadow: shown.length ? `0 0 0 ${pressK * 14}px ${accent}55` : undefined,
            }}
          >
            <svg width={28} height={28} viewBox="0 0 24 24">
              <path d="M12 19 V5 M5.5 11.5 L12 5 L18.5 11.5" fill="none" stroke={shown.length ? accentInk : muted} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── browser frame ─────────────────────────────────────────────────────────
export const BrowserFrame: React.FC<{ width: number; height: number; url: string; font: string; right?: React.ReactNode; children: React.ReactNode; radius?: number }> = ({ width, height, url, font, right, children, radius = 22 }) => (
  <div style={{ width, height, borderRadius: radius, background: "#fff", overflow: "hidden", boxShadow: "0 50px 110px rgba(10,20,15,.2), 0 0 0 1px rgba(10,20,15,.08)", display: "flex", flexDirection: "column" }}>
    <div style={{ height: 58, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: "1px solid rgba(10,20,15,.07)", background: "#fafafa" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
      ))}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: font, fontSize: 18, color: "#6b716e", background: "#eef0ee", borderRadius: 10, padding: "6px 60px" }}>{url}</div>
      </div>
      <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end" }}>{right}</div>
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
  </div>
);

/** Grey skeleton line with a shimmer sweep. */
export const Skel: React.FC<{ t: number; w: number | string; h?: number; r?: number; tone?: string }> = ({ t, w, h = 16, r = 8, tone = "#e9ecea" }) => {
  const x = ((t * 1.4) % 1) * 300 - 100;
  return <div style={{ width: w, height: h, borderRadius: r, background: `linear-gradient(90deg, ${tone} ${x - 30}%, #f7f8f7 ${x}%, ${tone} ${x + 30}%)` }} />;
};

// ── film language ─────────────────────────────────────────────────────────
/**
 * One shot of a launch film: soft fade/blur in and out plus a slow push. Returns
 * null outside [a, b] so off-screen shots cost nothing.
 */
export const Shot: React.FC<{ t: number; a: number; b: number; fin?: number; fout?: number; push?: number; origin?: string; children: React.ReactNode }> = ({
  t,
  a,
  b,
  fin = 0.7,
  fout = 0.7,
  push = 0.035,
  origin = "50% 50%",
  children,
}) => {
  if (t < a || t >= b) return null;
  const i = fin > 0 ? progress(t, a, fin, "smooth") : 1;
  const o = fout > 0 ? progress(t, b - fout, fout, "smooth") : 0;
  const blur = (1 - i) * 10 + o * 10;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: i * (1 - o), transform: `scale(${1 + push * ((t - a) / (b - a))})`, transformOrigin: origin, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
      {children}
    </div>
  );
};

/** Animated film grain (re-seeded every frame) — sits on top of everything. */
export const Grain: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 0.06 }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={frame % 24} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);

export const Vignette: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: k, background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%)" }} />
);
