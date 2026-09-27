import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";

const UI_SCALE = 1.35;
import { useSceneTime } from "@/engine/SceneContext";
import { progress, clamp01, lerp } from "@/kit/motion/keyframes";
import { ease } from "@/kit/motion/easing";
import { useKitTheme } from "@/kit/theme";
import { alpha } from "@/kit/lib/color";
import { CodeWindow } from "@/kit/ui/code";

/* ------------------------------------------------------------------ */
/* terminal_type                                                        */
/* ------------------------------------------------------------------ */

const TerminalProps = z.object({
  lines: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe("Commands to type. Prefix a line with '>' to print it instantly as output (e.g. '> ✓ Deployed in 1.2s')."),
  prompt: z.string().default("$"),
  title: z.string().default("zsh"),
  flash: z.boolean().default(false).describe("Flash to brand color at the end (hard-cut driver)."),
  window: z.boolean().default(true).describe("Framed window vs. full-bleed black screen."),
});

const Terminal: React.FC<z.infer<typeof TerminalProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { width, u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const fs = (p.window ? 30 : 44) * u;
  let cursorT = 0.35;
  const rows = p.lines.map((raw) => {
    const out = raw.startsWith(">");
    const text = out ? raw.slice(1).trimStart() : raw;
    const typeDur = out ? 0 : Math.min(1.2, text.length * 0.04);
    const start = cursorT;
    cursorT = start + typeDur + (out ? 0.25 : 0.35);
    return { out, text, start, typeDur };
  });
  const active = [...rows].reverse().find((r) => t >= r.start);
  const caretOn = Math.floor(t * 2.4) % 2 === 0;
  const flashA = p.flash ? clamp01((t - (dur - 0.3)) / 0.3) : 0;
  const body = (
    <div style={{ fontFamily: theme.fontMono, fontSize: fs, lineHeight: 1.6, color: "#E6E6E9", padding: p.window ? `${fs}px ${fs * 1.2}px` : 0 }}>
      {rows.map((r, i) => {
        if (t < r.start) return null;
        const n = r.out ? r.text.length : Math.round(clamp01((t - r.start) / Math.max(0.01, r.typeDur)) * r.text.length);
        const isActive = active === r && !r.out;
        return (
          <div key={i} style={{ whiteSpace: "pre", color: r.out ? (/✓|success|done/i.test(r.text) ? "#4ADE80" : "rgba(230,230,233,.6)") : "#E6E6E9", opacity: r.out ? progress(t, r.start, 0.15) : 1 }}>
            {!r.out && <span style={{ color: "#4ADE80" }}>{p.prompt} </span>}
            {r.text.slice(0, n)}
            {isActive && <span style={{ opacity: caretOn ? 1 : 0, background: "#E6E6E9", marginLeft: 2 }}>&nbsp;</span>}
          </div>
        );
      })}
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {p.window ? (
        <div
          style={{
            width: Math.min(width * 0.7, 1300 * u),
            minHeight: 420 * u,
            background: "#0D0E12",
            borderRadius: theme.radius,
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: `0 50px 110px ${alpha("#000000", 0.5)}`,
            overflow: "hidden",
            opacity: progress(t, 0, 0.35),
            transform: `scale(${lerp(0.96, 1, progress(t, 0, 0.5, "expo"))})`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 * u, padding: `${14 * u}px ${18 * u}px`, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span key={c} style={{ width: 13 * u, height: 13 * u, borderRadius: "50%", background: c }} />
            ))}
            <span style={{ marginLeft: "auto", marginRight: "auto", color: "rgba(255,255,255,.45)", fontSize: 18 * u, fontFamily: theme.fontMono }}>{p.title}</span>
          </div>
          {body}
        </div>
      ) : (
        body
      )}
      {flashA > 0 && <AbsoluteFill style={{ background: theme.primary, opacity: flashA * 0.95 }} />}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* code_zoom                                                            */
/* ------------------------------------------------------------------ */

const CodeZoomProps = z.object({
  lines: z.array(z.string()).min(3).max(18).describe("Real-looking code (the brand's SDK/API usage)."),
  highlight: z.number().int().min(1).describe("1-based line to spotlight."),
  title: z.string().default("index.tsx"),
  blowup: z.string().optional().describe("Short snippet that explodes to full-screen at the end (fake-3D zoom)."),
  typing: z.boolean().default(false).describe("Type the code in instead of showing it."),
});

const CodeZoom: React.FC<z.infer<typeof CodeZoomProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { width, u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const total = p.lines.join("\n").length;
  const typed = p.typing ? Math.round(clamp01((t - 0.2) / Math.min(dur * 0.45, total * 0.02)) * total) : undefined;
  const hlStart = p.typing ? Math.min(dur * 0.5, 0.2 + total * 0.02) : 0.7;
  const hl = progress(t, hlStart, 0.5);
  const blowAt = p.blowup ? dur - 1.3 : Infinity;
  const zoomP = progress(t, hlStart, Math.max(0.6, blowAt - hlStart), "smooth");
  const lineFrac = (p.highlight - 0.5) / p.lines.length;
  const z = lerp(1, 1.45, zoomP);
  const ty = (0.5 - lineFrac) * 600 * u * (z - 1);
  if (t >= blowAt && p.blowup) {
    const bp = ease("expo")(clamp01((t - blowAt) / 1.1));
    // Blow up as far as the snippet still fits the frame (mono glyph ≈ 0.6em).
    const maxScale = Math.min(4.2, (width * 0.88) / (p.blowup.length * 0.6 * 44 * u));
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "#0B0C0F" }}>
        <div
          style={{
            fontFamily: theme.fontMono,
            fontWeight: 700,
            fontSize: 44 * u,
            color: theme.accentText,
            transform: `scale(${lerp(1, maxScale, bp)}) skewX(${lerp(0, -8, bp)}deg)`,
            whiteSpace: "pre",
            textShadow: `0 0 ${40 * bp}px ${alpha(theme.accentText.startsWith("#") ? theme.accentText : "#6366F1", 0.6)}`,
          }}
        >
          {p.blowup}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${ty}px) scale(${z})`, opacity: progress(t, 0, 0.35) }}>
        <CodeWindow lines={p.lines} title={p.title} highlight={[p.highlight]} highlightOpacity={hl} typed={typed} width={Math.min(width * 0.66, 1250 * u)} fontSize={26 * u} />
      </div>
    </AbsoluteFill>
  );
};

export const devScenes = [
  defineScene({
    type: "terminal_type",
    category: "dev",
    description: "Terminal window (or full-bleed) typing commands with a blinking block caret; '>'-prefixed lines print as output (green if success). Optional brand-color flash out. CLIs, SDKs, deploys.",
    duration: [2.5, 5],
    schema: TerminalProps,
    component: Terminal,
    defaultTone: "inverse",
    example: { lines: ["npx clep record --flow signup", "> ✓ Captured 6 steps", "> ✓ Rendered 1080p in 14s"] },
  }),
  defineScene({
    type: "code_zoom",
    category: "dev",
    description: "Syntax-highlighted editor; camera drifts in on one highlighted line while others dim; optional snippet that explodes full-screen at the end. Show the 3 lines of code it takes.",
    duration: [3, 5],
    schema: CodeZoomProps,
    component: CodeZoom,
    defaultTone: "inverse",
    ownCamera: true,
    example: {
      lines: ['import { Clep } from "@clep/sdk"', "", "const clep = new Clep()", 'await clep.record("signup")', 'await clep.export({ format: "mp4" })'],
      highlight: 4,
      blowup: 'clep.record("signup")',
    },
  }),
];
