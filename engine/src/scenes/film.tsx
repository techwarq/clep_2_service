import React from "react";
import { AbsoluteFill, OffthreadVideo } from "remotion";
import { asset } from "@/engine/brandTheme";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";
import { useSceneTime, useStyle } from "@/engine/SceneContext";
import { progress, clamp01, lerp } from "@/kit/motion/keyframes";
import { useKitTheme } from "@/kit/theme";
import { mix } from "@/kit/lib/color";
import { Accent, Icon } from "@/kit/ui/bits";
import { AppLogo, AppLogoRef } from "@/kit/ui/AppLogo";
import { TraceCards, TraceDocument, TraceNodes, TraceSheet, TraceTerminal } from "./variants/trace";

/*
 * Scenes measured from founder launch films (T:0, Aside, Listen, Wonder) rather than from UI kits:
 * the product's work is the shot, the type is big, and the camera follows whatever is changing.
 */

/* ------------------------------------------------------------------ */
/* agent_trace                                                          */
/* ------------------------------------------------------------------ */

const StepT = z.object({
  text: z.string().describe("What the agent found, ≤ 48 chars: 'Amazon fees'"),
  value: z.string().optional().describe("The finding's number, ≤ 16 chars: '+27%', '$6,210'"),
  dir: z.enum(["up", "down", "none"]).default("none").describe("Arrow next to the value."),
  logo: AppLogoRef.optional().describe("Logo of the tool this finding came from (Shopify, Amazon…)."),
});

const AgentTraceProps = z.object({
  prompt: z.string().describe("What the user types, lowercase and plain, ≤ 80 chars."),
  steps: z.array(StepT).min(2).max(6).describe("The investigation, one finding per step."),
  result: z.string().optional().describe("The payoff the steps collapse into, ≤ 40 chars: 'Profit −19%. $12,430.'"),
  resultAccent: z.string().optional().describe("Exact substring of result to color."),
  status: z.string().optional().describe("Working label under the prompt, ≤ 32 chars. Defaults to 'Investigating'."),
  variant: z
    .enum(["rows", "terminal", "sheet", "nodes", "document", "cards"])
    .default("rows")
    .describe("rows = input bar + streaming rows · terminal = mono log · sheet = spreadsheet filling, camera pushes in · nodes = source logos wired to the agent · document = memo writing itself · cards = one big finding card at a time"),
});

// Timing, in seconds. Typing is fast enough to read, steps arrive at reading pace.
const CHARS_PER_S = 34;
const WORD_EVERY = 0.075;

/** Words of `text` revealed up to time t (starting at t0), newest words tinted then settling to ink. */
const Streamed: React.FC<{ text: string; t: number; t0: number; ink: string; tint: string }> = ({ text, t, t0, ink, tint }) => {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => {
        const at = t0 + i * WORD_EVERY;
        const a = clamp01((t - at) / 0.12);
        const settle = clamp01((t - at) / 0.5);
        return (
          <span key={i} style={{ opacity: a, color: mix(tint, ink, settle) }}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
};

const AgentTrace: React.FC<z.infer<typeof AgentTraceProps>> = (p) => {
  switch (p.variant) {
    case "terminal": return <TraceTerminal d={p} />;
    case "sheet": return <TraceSheet d={p} />;
    case "nodes": return <TraceNodes d={p} />;
    case "document": return <TraceDocument d={p} />;
    case "cards": return <TraceCards d={p} />;
    default: return <AgentTraceRows {...p} />;
  }
};

const AgentTraceRows: React.FC<z.infer<typeof AgentTraceProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const ink = theme.foreground;
  const tint = theme.accentText;
  const muted = theme.mutedForeground;

  // ---- schedule
  const typeEnd = 0.25 + p.prompt.length / CHARS_PER_S;
  const sent = typeEnd + 0.3;
  const resultHold = p.result ? 2.0 : 0;
  const stepsStart = sent + 0.55;
  const per = Math.max(0.85, Math.min(1.6, (dur - stepsStart - resultHold - 0.4) / p.steps.length));
  const stepAt = p.steps.map((_, i) => stepsStart + i * per);
  const resultAt = p.result ? stepAt[stepAt.length - 1] + per * 0.85 : Infinity;

  // ---- layout (a column the camera travels down)
  // Big and tight: the work fills the frame the way the launch films shoot it.
  // Largest size (≤ 80u) at which the longest step + its value fit on one line.
  const longest = Math.max(...p.steps.map((s) => s.text.length + (s.value ? s.value.length + 2 : 0)));
  const size = Math.min(80 * u * style.typeScale, (Math.min(width * 0.84, 1700 * u) - 110 * u) / (longest * 0.54));
  const promptSize = Math.min(50 * u, (Math.min(width * 0.84, 1700 * u) - 200 * u) / (Math.max(1, p.prompt.length) * 0.5));
  const rowH = size * 1.5;
  const colW = Math.min(width * 0.84, 1700 * u);
  const promptH = promptSize * 2.6;
  const rowY = (i: number) => promptH + 70 * u + i * rowH; // top of each step row inside the column

  // Camera: keep the newest line just below center; follow with an expo move each time a line lands.
  const focusY = (i: number) => (i < 0 ? promptH / 2 : rowY(i) + rowH / 2);
  let camY = focusY(-1);
  for (let i = 0; i < p.steps.length; i++) {
    const k = progress(t, stepAt[i] - 0.15, 0.6, "expo");
    camY = lerp(camY, focusY(i), k);
  }
  const collapse = p.result ? progress(t, resultAt, 0.7, "expo") : 0; // no payoff line → nothing collapses
  const push = 1 + 0.05 * clamp01(t / Math.max(1, dur)); // a slow dolly under everything
  const colTop = height * 0.5 - camY;

  // ---- prompt bar
  const typed = p.prompt.slice(0, Math.max(0, Math.floor((t - 0.25) * CHARS_PER_S)));
  const barIn = progress(t, 0, 0.45, "expo");
  const sendK = progress(t, sent, 0.35, "out");
  const caretOn = t < sent && Math.floor(t * 2.2) % 2 === 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: (width - colW) / 2,
          top: colTop,
          width: colW,
          transform: `scale(${push * lerp(1, 0.92, collapse)})`,
          transformOrigin: `50% ${camY}px`,
          opacity: lerp(1, 0.06, collapse),
          filter: collapse > 0 ? `blur(${collapse * 6 * u}px)` : undefined,
        }}
      >
        {/* the request */}
        <div
          style={{
            height: promptH,
            display: "flex",
            alignItems: "center",
            gap: 20 * u,
            padding: `0 ${34 * u}px`,
            borderRadius: promptH / 2,
            border: `${2 * u}px solid ${mix(ink, theme.background, 0.82)}`,
            background: mix(theme.background, "#ffffff", theme.mode === "dark" ? 0.04 : 0.55),
            boxShadow: `0 ${24 * u}px ${60 * u}px -${30 * u}px ${mix(ink, theme.background, 0.6)}`,
            opacity: barIn,
            transform: `translateY(${(1 - barIn) * 30 * u}px)`,
            fontFamily: theme.fontBody,
            fontSize: promptSize,
            fontWeight: 500,
            color: ink,
            letterSpacing: "-0.01em",
            boxSizing: "border-box",
          }}
        >
          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden" }}>
            {typed}
            <span style={{ opacity: caretOn ? 1 : 0, color: tint }}>|</span>
          </span>
          <div
            style={{
              width: promptH * 0.62,
              height: promptH * 0.62,
              borderRadius: "50%",
              background: ink,
              display: "grid",
              placeItems: "center",
              transform: `scale(${1 - 0.18 * Math.sin(Math.PI * sendK)})`,
            }}
          >
            <Icon name="arrow-up" size={promptSize * 0.8} color={theme.background} />
          </div>
        </div>
        <div
          style={{
            marginTop: 22 * u,
            paddingLeft: 36 * u,
            fontFamily: theme.fontBody,
            fontSize: 26 * u,
            color: muted,
            opacity: clamp01((t - sent) / 0.3) * (1 - clamp01((t - stepAt[0]) / 0.6)) + 0,
          }}
        >
          {p.status ?? "Investigating"}
          {".".repeat(1 + (Math.floor(t * 3) % 3))}
        </div>

        {/* the work */}
        {p.steps.map((s, i) => {
          const at = stepAt[i];
          if (t < at - 0.05) return null;
          const inK = progress(t, at, 0.35, "out");
          const textEnd = at + s.text.split(" ").length * WORD_EVERY;
          const valK = progress(t, textEnd + 0.12, 0.3, "overshoot");
          const newer = stepAt[i + 1] !== undefined ? progress(t, stepAt[i + 1], 0.5, "out") : 0;
          const done = clamp01((t - textEnd - 0.1) / 0.25);
          const up = s.dir === "up";
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: rowY(i),
                left: 0,
                width: colW,
                height: rowH,
                display: "flex",
                alignItems: "center",
                gap: 26 * u,
                opacity: inK * lerp(1, 0.32, newer),
                transform: `translateY(${(1 - inK) * 24 * u}px)`,
                // Data rows read in the body face at a solid weight — a thin display serif can't carry numbers.
                fontFamily: theme.fontBody,
                fontSize: size,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: ink,
              }}
            >
              {s.logo ? (
                // The source it checked: its logo lands, dim while working, full once the finding is in.
                <div style={{ flex: "none", opacity: lerp(0.35, 1, done), transform: `scale(${lerp(0.85, 1, done)})` }}>
                  <AppLogo logo={s.logo} size={size * 0.82} />
                </div>
              ) : (
              <div style={{ width: size * 0.62, height: size * 0.62, flex: "none", position: "relative" }}>
                {/* spinner → check */}
                <svg viewBox="0 0 24 24" style={{ position: "absolute", inset: 0, opacity: 1 - done, transform: `rotate(${t * 360}deg)` }}>
                  <circle cx="12" cy="12" r="9" fill="none" stroke={muted} strokeWidth="2.5" strokeDasharray="42 60" strokeLinecap="round" />
                </svg>
                <div style={{ position: "absolute", inset: 0, opacity: done, transform: `scale(${lerp(0.6, 1, done)})` }}>
                  <Icon name="circle-check" size={size * 0.62} color={tint} />
                </div>
              </div>
              )}
              <span style={{ flex: 1, whiteSpace: "nowrap" }}>
                <Streamed text={s.text} t={t} t0={at} ink={ink} tint={tint} />
              </span>
              {s.value && (
                <span
                  style={{
                    flex: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8 * u,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: tint,
                    opacity: clamp01(valK * 1.4),
                    transform: `scale(${lerp(0.7, 1, valK)})`,
                    transformOrigin: "100% 50%",
                  }}
                >
                  {s.dir !== "none" && <span style={{ fontSize: size * 0.6 }}>{up ? "▲" : "▼"}</span>}
                  {/* the arrow already says the direction — "▲ +$5,210" reads twice */}
                  {s.dir !== "none" ? s.value.replace(/^[+\-−]\s?/, "") : s.value}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* the payoff */}
      {p.result && t >= resultAt && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 118 * u * style.typeScale,
              fontWeight: style.weight,
              letterSpacing: `${style.tracking}em`,
              color: ink,
              textAlign: "center",
              maxWidth: width * 0.84,
              lineHeight: 1.05,
              opacity: collapse,
              transform: `translateY(${(1 - collapse) * 40 * u}px) scale(${lerp(1.06, 1, collapse)})`,
            }}
          >
            <Accent text={p.result} accent={p.resultAccent} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* film_reel                                                            */
/* ------------------------------------------------------------------ */

const FilmReelProps = z.object({
  films: z.array(z.object({ src: z.string(), title: z.string().optional(), start: z.number().default(0) })).min(2).max(6)
    .describe("Finished videos (asset paths) that slide past, each playing."),
  caption: z.string().optional().describe("One line under the reel, ≤ 44 chars."),
  accent: z.string().optional(),
});

/**
 * A carousel of finished films (Replit's slide carousel): the track glides left on an expo curve and
 * settles each film at center, where it's full size and playing; neighbours sit smaller and dimmer.
 */
const FilmReel: React.FC<z.infer<typeof FilmReelProps>> = (p) => {
  const { t, dur, fps } = useSceneTime();
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const cardW = width * 0.46, cardH = (cardW * 9) / 16, gap = 44 * u;
  const n = p.films.length;
  const per = (dur - 0.6) / n;
  // position in "cards": glide to card i over 0.6s at the start of its slot, then hold
  let pos = 0;
  for (let i = 1; i < n; i++) pos += progress(t, i * per - 0.35, 0.6, "expoInOut");
  const enter = progress(t, 0, 0.7, "expo");
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", top: (height - cardH) / 2 - 30 * u, left: (width - cardW) / 2 - pos * (cardW + gap), display: "flex", gap, transform: `translateY(${(1 - enter) * 80 * u}px)`, opacity: enter }}>
        {p.films.map((f, i) => {
          const d = Math.abs(i - pos);
          const k = clamp01(1 - d);
          return (
            <div key={i} style={{ width: cardW, flex: "none", transform: `scale(${lerp(0.8, 1, k)})`, opacity: lerp(0.45, 1, k), transformOrigin: "50% 50%" }}>
              <div style={{ width: cardW, height: cardH, borderRadius: 22 * u, overflow: "hidden", background: "#000", boxShadow: `0 ${40 * u}px ${90 * u}px -${40 * u}px rgba(10,15,30,.5)` }}>
                <OffthreadVideo src={asset(f.src)!} trimBefore={Math.round((f.start ?? 0) * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              {f.title && (
                <div style={{ marginTop: 22 * u, fontFamily: theme.fontBody, fontSize: 26 * u, fontWeight: 600, color: theme.foreground, textAlign: "center", opacity: k }}>{f.title}</div>
              )}
            </div>
          );
        })}
      </div>
      {p.caption && (
        <div style={{ position: "absolute", bottom: height * 0.07, width: "100%", textAlign: "center", fontFamily: theme.fontDisplay, fontSize: 64 * u * style.typeScale, fontWeight: theme.displayWeight ?? style.weight, letterSpacing: `${style.tracking}em`, color: theme.foreground, opacity: progress(t, 0.4, 0.6, "expo") }}>
          <Accent text={p.caption} accent={p.accent} />
        </div>
      )}
    </AbsoluteFill>
  );
};

export const filmScenes = [
  defineScene({
    type: "film_reel",
    category: "product",
    description: "Carousel of finished videos gliding past (Replit style): each settles at center full size and playing, neighbours smaller and dimmer. Use to show many outputs — 'every brand gets its own film'.",
    duration: [4, 12],
    ownCamera: true,
    schema: FilmReelProps,
    component: FilmReel,
    assetProps: ["films"],
    example: { films: [{ src: "user/a.mp4", title: "Talo" }, { src: "user/b.mp4", title: "Linear" }], caption: "Every brand, its own film." },
  }),
  defineScene({
    type: "agent_trace",
    category: "product",
    description:
      "The product doing the work, filmed like a founder launch: the user's request types into an input bar, then the agent's findings stream in one per line in big type (value + ▲/▼ in the accent), the camera following each new line, older lines dimming. Optionally everything collapses into one huge payoff line. Use for AI agents, analytics, research, automation — any 'ask → it investigates → answer' story.",
    duration: [5, 14],
    ownCamera: true,
    schema: AgentTraceProps,
    component: AgentTrace,
    // Mirrors each variant's layout: the input bar (rows), the terminal window, the memo page.
    anchor: (p, { width, height }) => {
      const u = Math.min(width, height) / 1080;
      if (p.variant === "terminal") {
        const r = { x: width * 0.1, y: height * 0.14, w: width * 0.8, h: height * 0.72, r: 22 * u, fill: "dark" as const };
        return { in: r, out: p.result ? null : r };
      }
      if (p.variant === "document") {
        const pw = Math.min(width * 0.64, 1200 * u);
        const r = { x: (width - pw) / 2, y: height * 0.1, w: pw, h: height * 0.9, r: 14 * u, fill: "card" as const };
        return { in: r, out: p.result ? null : r };
      }
      if (!p.variant || p.variant === "rows") {
        const colW = Math.min(width * 0.84, 1700 * u);
        const ps = Math.min(50 * u, (colW - 200 * u) / (Math.max(1, p.prompt.length) * 0.5));
        const h = ps * 2.6;
        return { in: { x: (width - colW) / 2, y: height / 2 - h / 2, w: colW, h, r: h / 2, fill: "card" }, out: null };
      }
      return null;
    },
    example: {
      prompt: "why did churn go up in march?",
      steps: [
        { text: "Signups", value: "flat", dir: "none" },
        { text: "Onboarding drop-off", value: "31%", dir: "up" },
        { text: "Bug reports, one screen", value: "×84", dir: "up" },
        { text: "All on Android", dir: "none" },
      ],
      result: "One broken screen.",
      resultAccent: "broken screen.",
    },
  }),
];
