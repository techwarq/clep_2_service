import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";

const UI_SCALE = 1.35;
import { useSceneTime, useStyle } from "@/engine/SceneContext";
import { progress, clamp01, lerp } from "@/kit/motion/keyframes";
import { ease } from "@/kit/motion/easing";
import { useGsapTimeline } from "@/kit/motion/gsap";
import { KineticText, fitSize } from "@/kit/motion/KineticText";
import { useKitTheme } from "@/kit/theme";
import { alpha, mix } from "@/kit/lib/color";
import { Icon, formatLike, numericValue } from "@/kit/ui/bits";

/* ------------------------------------------------------------------ */
/* stat_counter                                                         */
/* ------------------------------------------------------------------ */

const StatCounterProps = z.object({
  title: z.string().optional(),
  stats: z
    .array(z.object({ value: z.string().describe("Target as displayed: '98%', '$0', '10x', '1,000+'"), label: z.string() }))
    .min(1)
    .max(3),
});

const StatCounter: React.FC<z.infer<typeof StatCounterProps>> = ({ title, stats }) => {
  const { t } = useSceneTime();
  const { width, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const style = useStyle();
  // Largest value that still fits its column on one line (wide display fonts would overflow).
  const longest = stats.reduce((a, b) => (String(b.value).length > a.length ? String(b.value) : a), "");
  const big = fitSize(longest, (width * 0.82) / (portrait ? 1 : stats.length), (stats.length === 1 ? 260 : stats.length === 2 ? 190 : 150) * u * style.typeScale, 60 * u, 0.62, 1);
  const start = title ? 0.4 : 0.1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 50 * u }}>
      {title && <KineticText text={title} anim={style.titleAnim} size={52 * u} weight={600} color={theme.mutedForeground} tracking={-0.01} />}
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: width * 0.07, alignItems: "center" }}>
        {stats.map((s, i) => {
          const p = progress(t, start + i * 0.2, 1.3, "expo");
          const target = numericValue(s.value);
          const shown = /\d/.test(s.value) ? formatLike(s.value, target * p) : s.value;
          const a = progress(t, start + i * 0.2, 0.35);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 * u, opacity: a }}>
              <div
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: big,
                  fontWeight: theme.displayWeight ?? (800),
                  letterSpacing: "-0.05em",
                  lineHeight: 1,
                  color: theme.foreground,
                  fontVariantNumeric: "tabular-nums",
                  transform: `translateY(${(1 - a) * 30 * u}px)`,
                }}
              >
                {shown}
              </div>
              <div style={{ fontSize: Math.max(26 * u, big * 0.15), color: theme.mutedForeground, fontWeight: 600, textAlign: "center" }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* progress_ring                                                        */
/* ------------------------------------------------------------------ */

const ProgressRingProps = z.object({
  label: z.string().default("Rendering"),
  done: z.string().default("Done"),
  stepped: z.boolean().default(true).describe("Percent jumps in kinetic steps instead of counting smoothly."),
});

const ProgressRing: React.FC<z.infer<typeof ProgressRingProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const R = 190 * u;
  const ringDur = Math.max(1, dur - 1.1);
  const rp = ease("inOut")(clamp01(t / ringDur));
  const steps = [0, 17, 42, 68, 91, 100];
  const pct = p.stepped ? steps.filter((_, i) => clamp01(t / ringDur) >= [0, 0.07, 0.26, 0.49, 0.71, 0.93][i]).pop() ?? 0 : Math.round(rp * 100);
  const done = progress(t, ringDur + 0.05, 0.4, "overshoot");
  const C = 2 * Math.PI * R;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <svg width={R * 2 + 40 * u} height={R * 2 + 40 * u} style={{ position: "absolute", transform: "rotate(-90deg)", opacity: progress(t, 0, 0.3) }}>
        <circle cx={R + 20 * u} cy={R + 20 * u} r={R} stroke={theme.border} strokeWidth={14 * u} fill="none" />
        <circle cx={R + 20 * u} cy={R + 20 * u} r={R} stroke={theme.primary} strokeWidth={14 * u} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - rp)} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${1 - done * 0.15})`, opacity: 1 - done }}>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 110 * u, fontWeight: theme.displayWeight ?? (800), letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 24 * u, color: theme.mutedForeground }}>{p.label}</div>
      </div>
      <div style={{ position: "absolute", display: "flex", alignItems: "center", gap: 18 * u, transform: `scale(${lerp(1.6, 1, done)})`, opacity: done }}>
        <div style={{ width: 90 * u, height: 90 * u, borderRadius: "50%", background: theme.primary, color: theme.primaryForeground, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={52 * u} strokeWidth={3} />
        </div>
        <span style={{ fontFamily: theme.fontDisplay, fontSize: 96 * u, fontWeight: theme.displayWeight ?? (800), letterSpacing: "-0.04em" }}>{p.done}</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* bar_chart                                                            */
/* ------------------------------------------------------------------ */

const BarChartProps = z.object({
  title: z.string().optional(),
  bars: z.array(z.object({ label: z.string(), value: z.number(), display: z.string().optional() })).min(2).max(6),
  highlight: z.number().int().optional().describe("0-based bar in brand color (usually 'us')."),
  unit: z.string().default(""),
  orientation: z.enum(["vertical", "horizontal"]).default("horizontal"),
});

const BarChart: React.FC<z.infer<typeof BarChartProps>> = (p) => {
  const { t } = useSceneTime();
  const { width, height, u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const style = useStyle();
  const max = Math.max(...p.bars.map((b) => b.value));
  const start = p.title ? 0.45 : 0.15;
  const hi = p.highlight ?? -1;
  const horiz = p.orientation === "horizontal";
  const trackW = width * 0.5;
  const trackH = height * 0.45;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 50 * u }}>
      {p.title && <KineticText text={p.title} anim={style.titleAnim} size={60 * u * style.typeScale} weight={style.weight} tracking={style.tracking} />}
      <div style={{ display: "flex", flexDirection: horiz ? "column" : "row", gap: (horiz ? 22 : 36) * u, alignItems: horiz ? "stretch" : "flex-end", height: horiz ? undefined : trackH }}>
        {p.bars.map((b, i) => {
          const g = progress(t, start + i * 0.12, 1, "expo");
          const frac = (b.value / max) * g;
          const color = i === hi ? theme.primary : mix(theme.background, theme.foreground, 0.18);
          const label = b.display ?? `${formatLike(String(b.value), b.value * g)}${p.unit}`;
          return horiz ? (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
              <div style={{ width: 240 * u, textAlign: "right", fontSize: 28 * u, fontWeight: i === hi ? 700 : 500, color: i === hi ? theme.foreground : theme.mutedForeground }}>{b.label}</div>
              <div style={{ width: trackW, height: 56 * u, position: "relative" }}>
                <div style={{ width: `${frac * 100}%`, height: "100%", borderRadius: 14 * u, background: color }} />
              </div>
              <div style={{ width: 170 * u, fontSize: 30 * u, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: i === hi ? theme.accentText : theme.foreground, opacity: g }}>{label}</div>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 30 * u, fontWeight: 700, opacity: g, color: i === hi ? theme.accentText : theme.foreground }}>{label}</div>
              <div style={{ width: 110 * u, height: trackH * 0.8 * frac, borderRadius: 14 * u, background: color }} />
              <div style={{ fontSize: 24 * u, color: theme.mutedForeground, fontWeight: 600 }}>{b.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* split_compare                                                        */
/* ------------------------------------------------------------------ */

const Side = z.object({ title: z.string(), items: z.array(z.string()).min(1).max(5) });
const SplitCompareProps = z.object({
  left: Side.describe("The old/slow way."),
  right: Side.describe("The new way (this product)."),
  collapseLeft: z.boolean().default(true).describe("Old way glitches away near the end."),
});

const SplitCompare: React.FC<z.infer<typeof SplitCompareProps>> = ({ left, right, collapseLeft }) => {
  const { t, dur } = useSceneTime();
  const { width, height, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const collapseAt = dur - 1.1;
  const col = (side: z.infer<typeof Side>, isNew: boolean) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 * u, padding: 40 * u }}>
      <div style={{ fontFamily: theme.fontMono, fontSize: 22 * u, letterSpacing: "0.12em", color: isNew ? theme.accentText : theme.mutedForeground, textTransform: "uppercase", opacity: progress(t, 0.1, 0.3) }}>
        {side.title}
      </div>
      {side.items.map((it, i) => {
        const s0 = isNew ? 0.4 + i * 0.18 : 0.35 + i * 0.42;
        let a = progress(t, s0, isNew ? 0.25 : 0.35, "expo");
        let x = 0;
        if (!isNew && collapseLeft && t > collapseAt) {
          const cp = clamp01((t - collapseAt - i * 0.08) / 0.35);
          a *= (1 - cp) * (0.55 + 0.45 * Math.sin(cp * 40));
          x = Math.sin(t * 90 + i) * 8 * u * cp;
        }
        return (
          <div
            key={i}
            style={{
              opacity: Math.max(0, a),
              transform: `translate(${x}px, ${(1 - a) * 16 * u}px)`,
              fontFamily: theme.fontDisplay,
              fontWeight: theme.displayWeight ?? (isNew ? 750 : 550),
              fontSize: (isNew ? 46 : 38) * u,
              color: isNew ? theme.foreground : theme.mutedForeground,
              textDecoration: !isNew && t > collapseAt - 0.4 && collapseLeft ? "line-through" : undefined,
              display: "flex",
              alignItems: "center",
              gap: 14 * u,
            }}
          >
            {isNew && <Icon name="check" size={36 * u} color={theme.accentText} strokeWidth={3} />}
            {it}
          </div>
        );
      })}
    </div>
  );
  return (
    <AbsoluteFill style={{ flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center" }}>
      {col(left, false)}
      <div style={{ width: portrait ? width * 0.7 : 1.5, height: portrait ? 1.5 : height * 0.6, background: theme.border, transform: `scale${portrait ? "X" : "Y"}(${progress(t, 0, 0.6, "expo")})` }} />
      {col(right, true)}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* flow_diagram — nodes + connectors drawn on with GSAP DrawSVG          */
/* ------------------------------------------------------------------ */

const FlowDiagramProps = z.object({
  nodes: z.array(z.object({ label: z.string(), icon: z.string().optional(), sub: z.string().optional() })).min(2).max(5),
  caption: z.string().optional(),
  highlight: z.number().int().optional().describe("0-based node drawn in brand color (usually the product)."),
});

const FlowDiagram: React.FC<z.infer<typeof FlowDiagramProps>> = ({ nodes, caption, highlight }) => {
  const { t } = useSceneTime();
  const { width, height, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const style = useStyle();
  const n = nodes.length;
  const avail = portrait ? height * 0.6 : width * 0.86;
  const box = { w: Math.min(300 * u, (avail / n) * 0.8), h: 190 * u };
  // Span is measured between node centers, so leave room for half a node at each end.
  const span = portrait ? avail : avail - box.w;
  const step = span / (n - 1 || 1);
  const W = portrait ? box.w + 40 : span + box.w;
  const H = portrait ? span + box.h : box.h + 40;
  const pos = (i: number) => (portrait ? { x: W / 2, y: box.h / 2 + i * step } : { x: box.w / 2 + i * step, y: H / 2 });

  const scope = useGsapTimeline<HTMLDivElement>(
    (tl, q) => {
      tl.from(q(".fd-node"), { opacity: 0, y: 30, scale: 0.9, stagger: 0.35, duration: 0.55, ease: "kit.expo" }, 0.1);
      q(".fd-line").forEach((line, i) => {
        tl.fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.4, ease: "kit.inOut" }, 0.45 + i * 0.35);
      });
      tl.from(q(".fd-cap"), { opacity: 0, y: 20, duration: 0.5, ease: "kit.expo" }, 0.4 + n * 0.35);
    },
    [n, portrait],
    { speed: 1 },
  );

  // A pulse travelling along the whole chain after it's drawn.
  const pulseStart = 0.5 + n * 0.35;
  const pp = ((t - pulseStart) / 1.4) % 1;
  const along = t > pulseStart ? pp * (n - 1) : -1;
  const pi = Math.floor(along);
  const pf = along - pi;
  const pulse = along >= 0 && pi < n - 1 ? { x: lerp(pos(pi).x, pos(pi + 1).x, ease("inOut")(pf)), y: lerp(pos(pi).y, pos(pi + 1).y, ease("inOut")(pf)) } : null;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div ref={scope} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 60 * u }}>
      <div style={{ position: "relative", width: W, height: H }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {nodes.slice(0, -1).map((_, i) => {
            const a = pos(i);
            const b = pos(i + 1);
            const d = portrait ? `M${a.x},${a.y + box.h / 2} L${b.x},${b.y - box.h / 2}` : `M${a.x + box.w / 2},${a.y} L${b.x - box.w / 2},${b.y}`;
            return <path key={i} className="fd-line" d={d} stroke={theme.mutedForeground} strokeWidth={3 * u} fill="none" strokeDasharray="0" />;
          })}
          {pulse && <circle cx={pulse.x} cy={pulse.y} r={10 * u} fill={theme.primary} style={{ filter: `drop-shadow(0 0 ${10 * u}px ${theme.primary})` }} />}
        </svg>
        {nodes.map((node, i) => {
          const { x, y } = pos(i);
          const hl = highlight === i;
          return (
            <div
              key={i}
              className="fd-node"
              style={{
                position: "absolute",
                left: x - box.w / 2,
                top: y - box.h / 2,
                width: box.w,
                height: box.h,
                borderRadius: theme.radius,
                background: hl ? theme.primary : theme.card,
                color: hl ? theme.primaryForeground : theme.cardForeground,
                border: `1.5px solid ${hl ? theme.primary : theme.border}`,
                boxShadow: hl ? `0 24px 60px ${alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.35)}` : `0 20px 50px ${alpha("#0A0F1E", 0.1)}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10 * u,
                textAlign: "center",
                padding: 16 * u,
              }}
            >
              {node.icon && <Icon name={node.icon} size={44 * u} color={hl ? theme.primaryForeground : theme.primary} />}
              <div style={{ fontWeight: 700, fontSize: 28 * u, letterSpacing: "-0.01em" }}>{node.label}</div>
              {node.sub && <div style={{ fontSize: 19 * u, opacity: 0.7 }}>{node.sub}</div>}
            </div>
          );
        })}
      </div>
      {caption && (
        <div className="fd-cap" style={{ fontSize: 40 * u, fontWeight: style.weight, letterSpacing: `${style.tracking}em`, color: theme.foreground }}>
          {caption}
        </div>
      )}
      </div>
    </AbsoluteFill>
  );
};

export const dataScenes = [
  defineScene({
    type: "stat_counter",
    category: "data",
    description: "1-3 huge numbers counting up to their targets (keeps $/%/x/commas formatting) with labels. Proof points. Looks great with tone 'primary'.",
    duration: [2.5, 4],
    schema: StatCounterProps,
    component: StatCounter,
    example: { stats: [{ value: "10x", label: "faster launches" }, { value: "98%", label: "less editing" }] },
  }),
  defineScene({
    type: "progress_ring",
    category: "data",
    description: "Ring fills while the percentage jumps in kinetic steps, then snaps to a check + 'Done'. Processing / rendering / deploying beats.",
    duration: [2.5, 4],
    schema: ProgressRingProps,
    component: ProgressRing,
    example: { label: "Rendering 4K", done: "Ready" },
  }),
  defineScene({
    type: "bar_chart",
    category: "data",
    description: "Animated bar chart (horizontal or vertical) with one highlighted bar — benchmarks, us vs. them.",
    duration: [3, 5],
    schema: BarChartProps,
    component: BarChart,
    example: { title: "Time to first video", bars: [{ label: "Screen Studio", value: 45, display: "45 min" }, { label: "Manual edit", value: 180, display: "3 hrs" }, { label: "Clep", value: 2, display: "2 min" }], highlight: 2 },
  }),
  defineScene({
    type: "split_compare",
    category: "data",
    description: "Split screen: old way (slow list that glitches/strikes away) vs. new way (fast checked list in brand color).",
    duration: [3.5, 5.5],
    schema: SplitCompareProps,
    component: SplitCompare,
    example: { left: { title: "Before", items: ["Record", "Import", "Cut", "Zoom", "Export"] }, right: { title: "With Clep", items: ["Tag the flow", "Done"] } },
  }),
  defineScene({
    type: "flow_diagram",
    category: "data",
    description: "2-5 nodes connected by lines that draw on (GSAP DrawSVG) with a glowing pulse travelling the chain. How-it-works / architecture.",
    duration: [3, 5],
    schema: FlowDiagramProps,
    component: FlowDiagram,
    example: { nodes: [{ label: "Your app", icon: "app-window" }, { label: "Clep", icon: "sparkles", sub: "records + edits" }, { label: "MP4", icon: "film" }], highlight: 1, caption: "Three steps. Zero editing." },
  }),
];
