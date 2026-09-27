import React from "react";
import { AbsoluteFill, Img, OffthreadVideo } from "remotion";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";

const UI_SCALE = 1.35;
import { useSceneTime, useStyle } from "@/engine/SceneContext";
import { asset } from "@/engine/brandTheme";
import { KineticText, fitSize } from "@/kit/motion/KineticText";
import { progress, clamp01, lerp, rand, kf } from "@/kit/motion/keyframes";
import { ease } from "@/kit/motion/easing";
import { ThemeProvider, useKitTheme } from "@/kit/theme";
import { alpha, mix } from "@/kit/lib/color";
import { BrowserWindow, PhoneFrame, SkeletonLines, Surface } from "@/kit/ui/devices";
import { Cursor, useCursor } from "@/kit/ui/Cursor";
import { Icon, LogoMark, Pill } from "@/kit/ui/bits";
import { AppLogo, AppLogoRef } from "@/kit/ui/AppLogo";
import { PingLockscreen, PingScatter, PingThread, PingTicker } from "./variants/problem";


/** Caption column used by two-column device scenes. Lines type on in sequence. */
const CaptionColumn: React.FC<{ lines: string[]; t: number; width: number; size: number; start?: number; per?: number }> = ({
  lines,
  t,
  width,
  size,
  start = 0.25,
  per = 0.9,
}) => {
  const theme = useKitTheme();
  const style = useStyle();
  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: size * 0.3 }}>
      {lines.map((line, i) => {
        const p = progress(t, start + i * per, 0.6, style.ease);
        return (
          <div key={i} style={{ overflow: "hidden" }}>
            <div
              style={{
                transform: `translateY(${(1 - p) * 140}%)`,
                fontFamily: theme.fontDisplay,
                fontWeight: theme.displayWeight ?? (style.weight),
                fontSize: size,
                letterSpacing: `${style.tracking}em`,
                lineHeight: 1.08,
                color: i === lines.length - 1 ? theme.foreground : theme.mutedForeground,
              }}
            >
              {line}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* site_showcase — the real website, in a browser, with camera + callouts */
/* ------------------------------------------------------------------ */

const SiteShowcaseProps = z.object({
  screenshot: z.string().describe("Asset path to a real screenshot of the site/product (full-page screenshots scroll)."),
  url: z.string().optional().describe("Shown in the address bar."),
  title: z.string().optional().describe("Optional caption; switches to a two-column layout with text left."),
  accent: z.string().optional(),
  scroll: z.number().min(0).max(1).default(0.25).describe("Fraction of the page to scroll through during the scene."),
  scrollStart: z.number().default(0.8).describe("Seconds before scrolling begins."),
  device: z.enum(["browser", "none"]).default("browser"),
  tilt: z.boolean().default(true).describe("3D tilt-up entrance."),
  zoom: z
    .object({
      x: z.number(),
      y: z.number(),
      scale: z.number().default(1.8),
      at: z.number().default(1.4),
      duration: z.number().default(0.9).describe("Seconds the push-in takes — raise it to slow the zoom (0.7x speed = duration / 0.7)."),
    })
    .optional()
    .describe("Push in on a point of the visible viewport (x,y fractions) — e.g. the main CTA button."),
  click: z.object({ x: z.number(), y: z.number(), at: z.number().default(1.2) }).optional().describe("Cursor flies in and clicks at x,y (viewport fractions)."),
  callouts: z
    .array(z.object({ text: z.string(), x: z.number(), y: z.number(), at: z.number().default(1) }))
    .max(4)
    .default([])
    .describe("Labels that pop next to points on the viewport."),
});

const SiteShowcase: React.FC<z.infer<typeof SiteShowcaseProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { width, height, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const style = useStyle();
  const twoCol = !!p.title && !portrait;
  const winW = twoCol ? width * 0.56 : width * (portrait ? 0.9 : 0.74);
  const winH = winW * (portrait ? 1.5 : 0.62);
  const barH = Math.max(36, Math.round(winH * 0.055));
  const vpH = p.device === "browser" ? winH - barH : winH;

  const enter = progress(t, 0, 0.95, "expo");
  const rotX = p.tilt ? lerp(22, 0, enter) : 0;
  const y = lerp(height * 0.18, 0, enter);
  const s = progress(t, p.scrollStart, Math.max(0.5, dur - p.scrollStart - 0.2), "smooth") * p.scroll;

  // Push-in on a point: zoom the whole window around that point and center it.
  let z = 1;
  let zx = 0;
  let zy = 0;
  if (p.zoom) {
    const zp = progress(t, p.zoom.at, p.zoom.duration, "expo");
    z = lerp(1, p.zoom.scale, zp);
    zx = (0.5 - p.zoom.x) * winW * zp * (1 - 1 / p.zoom.scale) * p.zoom.scale;
    zy = (0.5 - p.zoom.y) * vpH * zp * (1 - 1 / p.zoom.scale) * p.zoom.scale;
  }

  const clickPts = p.click
    ? [
        { t: 0, x: winW * 1.05, y: vpH * 1.1 },
        { t: Math.max(0.2, p.click.at - 0.55), x: winW * 1.05, y: vpH * 1.1 },
        { t: p.click.at - 0.35, x: p.click.x * winW, y: p.click.y * vpH + (p.device === "browser" ? barH : 0), click: true },
      ]
    : [];
  const cur = useCursor(clickPts, t);

  // Two-column layouts zoom INSIDE the viewport so the caption stays clear; centered layouts move the whole window.
  const innerZoom = twoCol && !!p.zoom;
  const shot = (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: theme.card }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: p.zoom ? `${p.zoom.x * 100}% ${p.zoom.y * 100}%` : undefined,
          transform: innerZoom ? `scale(${z})` : undefined,
        }}
      >
        <Img
          src={asset(p.screenshot)!}
          style={{ width: "100%", display: "block", transform: `translateY(calc(${-s * 100}% + ${s * vpH}px))` }}
        />
      </div>
    </div>
  );

  const windowEl = (
    <div
      style={{
        position: "relative",
        transform: innerZoom
          ? `perspective(${2200 * u}px) translateY(${y}px) rotateX(${rotX}deg)`
          : `perspective(${2200 * u}px) translateY(${y}px) rotateX(${rotX}deg) translate(${zx}px, ${zy}px) scale(${z})`,
        transformOrigin: "50% 50%",
        opacity: clamp01(enter * 2),
      }}
    >
      {p.device === "browser" ? (
        <BrowserWindow width={winW} height={winH} url={p.url}>
          {shot}
        </BrowserWindow>
      ) : (
        <div style={{ width: winW, height: winH, position: "relative", borderRadius: theme.radius, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,.2)" }}>
          {shot}
        </div>
      )}
      {p.callouts.map((c, i) => {
        const cp = progress(t, c.at + i * 0.25, 0.45, "overshoot");
        const right = c.x < 0.6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x * winW,
              top: c.y * vpH + (p.device === "browser" ? barH : 0),
              transform: `translate(${right ? 18 * u : -18 * u}px, -50%) translateX(${right ? 0 : -100}%) scale(${cp})`,
              transformOrigin: right ? "0% 50%" : "100% 50%",
              opacity: clamp01(cp * 2),
              zIndex: 20,
            }}
          >
            <Pill tone="primary" size={22 * u} style={{ boxShadow: `0 12px 30px ${alpha("#000000", 0.25)}` }}>
              {c.text}
            </Pill>
          </div>
        );
      })}
      {p.callouts.map((c, i) => {
        const cp = progress(t, c.at + i * 0.25, 0.45, "overshoot");
        return (
          <div
            key={`d${i}`}
            style={{
              position: "absolute",
              left: c.x * winW - 9 * u,
              top: c.y * vpH + (p.device === "browser" ? barH : 0) - 9 * u,
              width: 18 * u,
              height: 18 * u,
              borderRadius: "50%",
              background: theme.primary,
              boxShadow: `0 0 0 ${8 * u * cp}px ${alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.25)}`,
              transform: `scale(${cp})`,
              zIndex: 19,
            }}
          />
        );
      })}
      {p.click && <Cursor x={cur.x} y={cur.y} pressed={cur.pressed} sinceClick={cur.sinceClick} scale={1.3 * u} />}
    </div>
  );

  if (!twoCol) return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>{windowEl}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: width * 0.04, padding: `0 ${width * 0.05}px` }}>
      <div style={{ width: width * 0.3 }}>
        <KineticText
          text={p.title!}
          accent={p.accent}
          anim={style.titleAnim}
          align="left"
          size={fitSize(p.title!, width * 0.3, 110 * u * style.typeScale, 40 * u, theme.displayWeight && theme.displayWeight <= 400 ? 0.42 : 0.52, 4)}
          weight={style.weight}
          tracking={style.tracking}
          stagger={style.stagger}
          delay={0.25}
          color={theme.foreground}
        />
      </div>
      {windowEl}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* ui_click — built product mock with cursor → click → success state    */
/* ------------------------------------------------------------------ */

const UiClickProps = z.object({
  heading: z.string().describe("Heading inside the app UI (what the user is doing)."),
  button: z.string().describe("Primary button label that gets clicked."),
  result: z.string().default("Done").describe("Toast shown after the click."),
  url: z.string().optional(),
  tag: z.string().optional().describe("Small chip above the heading."),
  particles: z.boolean().default(false).describe("Window assembles from particles first (dev-tool vibe)."),
  clickAt: z.number().default(0.55).describe("Fraction of the scene when the click lands."),
});

const UiClick: React.FC<z.infer<typeof UiClickProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { width, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const winW = width * (portrait ? 0.88 : 0.62);
  const winH = winW * (portrait ? 1.3 : 0.6);
  const clickT = p.clickAt * dur;
  const assemble = p.particles ? Math.min(1.1, dur * 0.25) : 0;
  const winA = p.particles ? progress(t, assemble * 0.75, 0.45) : progress(t, 0, 0.7, "expo");
  const winScale = p.particles ? 1 : lerp(0.92, 1, winA);
  const btnW = 300 * u;
  const btnH = 72 * u;
  const bx = winW / 2;
  const by = winH * 0.62;
  const cur = useCursor(
    [
      { t: 0, x: winW * 0.95, y: winH * 1.05 },
      { t: Math.max(assemble + 0.2, clickT - 0.9), x: winW * 0.8, y: winH * 0.9 },
      { t: clickT - 0.35, x: bx + 10 * u, y: by + 8 * u, click: true },
    ],
    t,
  );
  const clicked = t >= clickT;
  const press = t >= clickT - 0.06 && t < clickT + 0.12 ? 0.94 : 1;
  const toast = progress(t, clickT + 0.25, 0.5, "overshoot");
  const loading = clamp01((t - clickT) / 0.35);

  const N = 160;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: winW, height: winH }}>
        {p.particles &&
          t < assemble + 0.35 &&
          Array.from({ length: N }).map((_, i) => {
            const r1 = rand(i * 3.1 + 1);
            const r2 = rand(i * 7.7 + 2);
            const r3 = rand(i * 2.3 + 3);
            const ang = r1 * Math.PI * 2;
            const rad = 300 * u + r2 * 700 * u;
            const per = (i / N + r3 * 0.02) % 1;
            const P = 2 * (winW + winH);
            let d = per * P;
            let tx = 0;
            let ty = 0;
            if (d < winW) [tx, ty] = [d, 0];
            else if ((d -= winW) < winH) [tx, ty] = [winW, d];
            else if ((d -= winH) < winW) [tx, ty] = [winW - d, winH];
            else [tx, ty] = [0, winH - (d - winW)];
            const pp = ease("inOut")(clamp01((t - r3 * 0.5) / 0.6));
            const x = lerp(winW / 2 + Math.cos(ang) * rad, tx, pp);
            const y = lerp(winH / 2 + Math.sin(ang) * rad * 0.7, ty, pp);
            const a = clamp01(t / 0.15) * clamp01(1 - (t - assemble) / 0.35);
            return <div key={i} style={{ position: "absolute", left: x, top: y, width: 4 * u, height: 4 * u, borderRadius: "50%", background: theme.primary, opacity: a }} />;
          })}
        <div style={{ opacity: winA, transform: `scale(${winScale})` }}>
          <BrowserWindow width={winW} height={winH} url={p.url ?? (theme.name.toLowerCase().replace(/\s+/g, "") + ".com")}>
            <div style={{ position: "absolute", inset: 0, display: "flex", background: theme.card }}>
              <div style={{ width: winW * 0.2, borderRight: `1px solid ${theme.border}`, padding: 22 * u, display: "flex", flexDirection: "column", gap: 18 * u }}>
                <LogoMark size={34 * u} />
                <SkeletonLines lines={5} width={winW * 0.13} h={10 * u} gap={16 * u} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 * u, paddingBottom: winH * 0.08 }}>
                {p.tag && (
                  <Pill tone="muted" size={18 * u}>
                    {p.tag}
                  </Pill>
                )}
                <div style={{ fontFamily: theme.fontDisplay, fontWeight: theme.displayWeight ?? (700), fontSize: 44 * u, letterSpacing: "-0.03em", color: theme.cardForeground, textAlign: "center", maxWidth: winW * 0.6 }}>
                  {p.heading}
                </div>
                <SkeletonLines lines={2} width={winW * 0.34} h={10 * u} />
              </div>
            </div>
          </BrowserWindow>
          <div
            style={{
              position: "absolute",
              left: bx - btnW / 2,
              top: by - btnH / 2,
              width: btnW,
              height: btnH,
              borderRadius: btnH,
              background: clicked ? mix(theme.primary, "#000000", 0.12) : theme.primary,
              color: theme.primaryForeground,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12 * u,
              fontWeight: 700,
              fontSize: 26 * u,
              transform: `scale(${press})`,
              boxShadow: `0 16px 40px ${alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.4)}`,
            }}
          >
            {clicked && loading < 1 ? (
              <Icon name="loader-circle" size={30 * u} style={{ transform: `rotate(${t * 720}deg)` }} />
            ) : clicked ? (
              <Icon name="check" size={30 * u} strokeWidth={3} />
            ) : null}
            {p.button}
          </div>
        </div>
        <Cursor x={cur.x} y={cur.y} pressed={cur.pressed} sinceClick={cur.sinceClick} scale={1.4 * u} opacity={clamp01((t - assemble) / 0.3)} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -40 * u,
            transform: `translate(-50%, ${(1 - toast) * 40 * u}px) scale(${lerp(0.8, 1, toast)})`,
            opacity: clamp01(toast * 1.5),
          }}
        >
          <Surface pad={0} style={{ display: "flex", alignItems: "center", gap: 14 * u, padding: `${16 * u}px ${26 * u}px`, borderRadius: 999 }}>
            <div style={{ width: 34 * u, height: 34 * u, borderRadius: "50%", background: "#22C55E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={20 * u} strokeWidth={3} />
            </div>
            <span style={{ fontWeight: 600, fontSize: 24 * u }}>{p.result}</span>
          </Surface>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* feature_grid                                                         */
/* ------------------------------------------------------------------ */

const FeatureGridProps = z.object({
  title: z.string().optional(),
  features: z
    .array(z.object({ icon: z.string().default("sparkles").describe("lucide icon name"), title: z.string(), desc: z.string().optional() }))
    .min(2)
    .max(6),
  highlight: z.number().int().optional().describe("0-based card to spotlight at the end."),
});

const FeatureGrid: React.FC<z.infer<typeof FeatureGridProps>> = ({ title, features, highlight }) => {
  const { t, dur } = useSceneTime();
  const { width, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const style = useStyle();
  const cols = portrait ? 2 : features.length <= 3 ? features.length : features.length === 4 ? 2 : 3;
  const cardW = Math.min(460 * u, (width * 0.84 - (cols - 1) * 28 * u) / cols);
  const start = title ? 0.45 : 0.1;
  const hlT = dur - 1.2;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 56 * u }}>
      {title && (
        <KineticText text={title} anim={style.titleAnim} size={64 * u * style.typeScale} weight={style.weight} tracking={style.tracking} stagger={style.stagger} uppercase={style.uppercase} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cardW}px)`, gap: 28 * u }}>
        {features.map((f, i) => {
          const pp = progress(t, start + i * 0.12, 0.6, "expo");
          const hl = highlight === i ? progress(t, hlT, 0.5, "overshoot") : 0;
          const dim = highlight !== undefined && highlight !== i ? 1 - 0.45 * progress(t, hlT, 0.5) : 1;
          return (
            <Surface
              key={i}
              pad={32 * u}
              style={{
                opacity: pp * dim,
                transform: `translateY(${(1 - pp) * 50 * u}px) scale(${1 + hl * 0.06})`,
                borderColor: hl > 0 ? theme.primary : theme.border,
                display: "flex",
                flexDirection: "column",
                gap: 16 * u,
              }}
            >
              <div
                style={{
                  width: 60 * u,
                  height: 60 * u,
                  borderRadius: 16 * u,
                  background: alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.12),
                  color: theme.accentText,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={f.icon} size={32 * u} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 32 * u, letterSpacing: "-0.02em" }}>{f.title}</div>
              {f.desc && <div style={{ fontSize: 22 * u, color: theme.mutedForeground, lineHeight: 1.4 }}>{f.desc}</div>}
            </Surface>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* search_results                                                       */
/* ------------------------------------------------------------------ */

const SearchResultsProps = z.object({
  query: z.string().describe("Typed into the search/prompt bar (≤ 50 chars)."),
  status: z.string().optional().describe("Shimmering status line after enter, e.g. 'Searching the web…'"),
  results: z.array(z.object({ title: z.string(), source: z.string().optional(), meta: z.string().optional() })).max(4).default([]),
  icon: z.string().default("search"),
});

const SearchResults: React.FC<z.infer<typeof SearchResultsProps>> = (p) => {
  const { t } = useSceneTime();
  const { width, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  // Size the bar to the prompt: widen up to 78% of the frame, then shrink the type so the
  // send button always stays inside the pill (avg glyph ≈ 0.52em for UI sans).
  const chrome = (34 + 18 + 18 + 52 + 60) * u;
  const baseFs = 34 * u;
  const barW = Math.min(width * (portrait ? 0.9 : 0.78), Math.max(width * (portrait ? 0.88 : 0.5), p.query.length * baseFs * 0.52 + chrome));
  const fs = Math.min(baseFs, (barW - chrome) / Math.max(1, p.query.length * 0.52));
  const typeDur = Math.min(1.6, p.query.length * 0.045);
  const shown = p.query.slice(0, Math.round(clamp01((t - 0.3) / typeDur) * p.query.length));
  const typedEnd = 0.3 + typeDur;
  const caret = t < typedEnd + 0.3 ? Math.floor(t * 2.2) % 2 === 0 : false;
  const lift = progress(t, typedEnd + 0.2, 0.6, "expo");
  const statusA = p.status ? progress(t, typedEnd + 0.3, 0.3) : 0;
  const resultsStart = typedEnd + (p.status ? 0.9 : 0.4);
  const shimmer = ((t * 0.9) % 1.4) - 0.2;
  // Send press + "working" glow ring after the prompt is submitted.
  const sent = t >= typedEnd + 0.15;
  const press = t >= typedEnd + 0.1 && t < typedEnd + 0.25 ? 0.88 : 1;
  const glow = sent ? 0.5 + 0.5 * Math.sin((t - typedEnd) * 5) : 0;
  const accentHex = theme.accentText.startsWith("#") ? theme.accentText : "#6366F1";
  const barEnter = progress(t, 0, 0.6, "expo");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 * u, width: barW, transform: `translateY(${lerp(0, -140 * u, p.results.length ? lift : 0)}px)` }}>
        <Surface
          pad={0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18 * u,
            padding: `${22 * u}px ${22 * u}px ${22 * u}px ${30 * u}px`,
            borderRadius: 999,
            opacity: barEnter,
            transform: `translateY(${(1 - barEnter) * 24 * u}px) scale(${lerp(0.96, 1, barEnter)})`,
            borderColor: sent ? alpha(accentHex, 0.35 + 0.4 * glow) : theme.border,
            boxShadow: sent
              ? `0 0 0 ${4 * u}px ${alpha(accentHex, 0.12 * glow)}, 0 0 ${60 * u}px ${alpha(accentHex, 0.28 * glow)}, 0 30px 70px ${alpha("#000000", 0.35)}`
              : undefined,
          }}
        >
          <Icon name={p.icon} size={34 * u} color={sent ? theme.accentText : theme.mutedForeground} />
          <span style={{ flex: 1, minWidth: 0, fontSize: fs, fontWeight: 500, whiteSpace: "pre", overflow: "hidden" }}>
            {shown}
            <span style={{ opacity: caret ? 1 : 0, color: theme.accentText, fontWeight: 300 }}>|</span>
          </span>
          <div
            style={{
              flex: "none",
              width: 52 * u,
              height: 52 * u,
              borderRadius: "50%",
              background: theme.primary,
              color: theme.primaryForeground,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${press})`,
              opacity: shown.length ? 1 : 0.45,
            }}
          >
            {sent ? (
              <div style={{ width: 16 * u, height: 16 * u, borderRadius: 3 * u, background: theme.primaryForeground }} />
            ) : (
              <Icon name="arrow-up" size={28 * u} />
            )}
          </div>
        </Surface>
        {p.status && (
          <div
            style={{
              opacity: statusA,
              fontSize: 24 * u,
              fontWeight: 600,
              paddingLeft: 30 * u,
              backgroundImage: `linear-gradient(90deg, ${theme.mutedForeground} ${(shimmer - 0.15) * 100}%, ${theme.foreground} ${shimmer * 100}%, ${theme.mutedForeground} ${(shimmer + 0.15) * 100}%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {p.status}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: p.results.length > 2 && !portrait ? "1fr 1fr" : "1fr", gap: 18 * u }}>
          {p.results.map((r, i) => {
            const rp = progress(t, resultsStart + i * 0.15, 0.5, "expo");
            return (
              <Surface key={i} pad={24 * u} style={{ opacity: rp, transform: `translateY(${(1 - rp) * 30 * u}px)`, display: "flex", gap: 18 * u, alignItems: "flex-start" }}>
                <div style={{ width: 44 * u, height: 44 * u, borderRadius: 12 * u, background: mix(theme.card, theme.primary, 0.15), color: theme.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22 * u, flex: "none" }}>
                  {(r.source ?? r.title).slice(0, 1).toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 * u }}>
                  {r.source && <div style={{ fontSize: 18 * u, color: theme.mutedForeground, fontWeight: 600 }}>{r.source}</div>}
                  <div style={{ fontSize: 26 * u, fontWeight: 650, lineHeight: 1.25 }}>{r.title}</div>
                  {r.meta && <div style={{ fontSize: 18 * u, color: theme.mutedForeground }}>{r.meta}</div>}
                </div>
              </Surface>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* chat_demo                                                            */
/* ------------------------------------------------------------------ */

const ChatDemoProps = z.object({
  messages: z.array(z.object({ from: z.enum(["user", "agent"]), text: z.string() })).min(1).max(5),
  agentName: z.string().optional().describe("Defaults to the brand name."),
  results: z.array(z.string()).max(4).default([]).describe("Task-result cards that slide up after the agent replies."),
  device: z.enum(["none", "phone"]).default("none"),
  caption: z.array(z.string()).max(2).default([]).describe("Lines typed on the left (two-column layout)."),
});

/** The chat thread itself — reads the theme it's rendered in (phone screen vs. stage). */
const ChatThread: React.FC<{ p: z.infer<typeof ChatDemoProps>; t: number; colW: number; s: number; u: number; phone: boolean }> = ({ p, t, colW, s, u, phone }) => {
  const theme = useKitTheme();
  let cursor = 0.3;
  const timed = p.messages.map((m) => {
    const typing = m.from === "agent" ? 0.55 : 0;
    const at = cursor + typing;
    cursor = at + 0.45 + Math.min(0.7, m.text.length * 0.012);
    return { ...m, at, typingFrom: at - typing };
  });
  const resultsAt = cursor;

  return (
    <div style={{ width: colW, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 * u * s, padding: phone ? `${80 * u}px ${18 * u}px` : 0 }}>
      {timed.map((m, i) => {
        const a = progress(t, m.at, 0.4, "expo");
        const isUser = m.from === "user";
        const typingVisible = !isUser && t >= m.typingFrom && t < m.at;
        return (
          <React.Fragment key={i}>
            {!isUser && (t >= m.typingFrom) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 * u * s, opacity: clamp01((t - m.typingFrom) / 0.2) }}>
                <LogoMark size={30 * u * s} />
                <span style={{ fontWeight: 700, fontSize: 20 * u * s }}>{p.agentName ?? theme.name}</span>
              </div>
            )}
            {typingVisible ? (
              <div style={{ alignSelf: "flex-start", background: theme.secondary, borderRadius: 22 * u * s, padding: `${16 * u * s}px ${22 * u * s}px`, display: "flex", gap: 8 * u * s }}>
                {[0, 1, 2].map((d) => (
                  <span key={d} style={{ width: 10 * u * s, height: 10 * u * s, borderRadius: "50%", background: theme.mutedForeground, opacity: 0.35 + 0.65 * Math.abs(Math.sin(t * 6 - d * 0.7)) }} />
                ))}
              </div>
            ) : (
              t >= m.at && (
                <div
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    background: isUser ? theme.primary : theme.secondary,
                    color: isUser ? theme.primaryForeground : theme.secondaryForeground,
                    borderRadius: 26 * u * s,
                    borderBottomRightRadius: isUser ? 8 * u * s : 26 * u * s,
                    borderBottomLeftRadius: isUser ? 26 * u * s : 8 * u * s,
                    padding: `${18 * u * s}px ${26 * u * s}px`,
                    fontSize: 28 * u * s,
                    lineHeight: 1.35,
                    fontWeight: 500,
                    opacity: a,
                    transform: `translateY(${(1 - a) * 20 * u}px) scale(${lerp(0.94, 1, a)})`,
                    transformOrigin: isUser ? "100% 100%" : "0% 100%",
                  }}
                >
                  {m.text}
                </div>
              )
            )}
          </React.Fragment>
        );
      })}
      {p.results.map((r, i) => {
        const rp = progress(t, resultsAt + i * 0.18, 0.45, "expo");
        return (
          <div
            key={`r${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14 * u * s,
              padding: `${16 * u * s}px ${22 * u * s}px`,
              borderRadius: 18 * u * s,
              border: `1.5px solid ${theme.primary}`,
              background: alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.06),
              fontWeight: 600,
              fontSize: 24 * u * s,
              opacity: rp,
              transform: `translateY(${(1 - rp) * 40 * u}px)`,
            }}
          >
            <Icon name="circle-check" size={26 * u * s} color={theme.accentText} />
            {r}
          </div>
        );
      })}
    </div>
  );

};

const ChatDemo: React.FC<z.infer<typeof ChatDemoProps>> = (p) => {
  const { t } = useSceneTime();
  const { width, height, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const phone = p.device === "phone";
  const colW = phone ? height * 0.78 * 0.49 * 0.93 : Math.min(width * 0.5, 900 * u);
  const s = phone ? 0.62 : 1; // phone screens use smaller type
  const thread = <ChatThread p={p} t={t} colW={colW} s={s} u={u} phone={phone} />;
  const screen = theme.base ?? theme;
  const main = phone ? (
    <PhoneFrame height={height * 0.78} screenBg={screen.background} darkUi={screen.mode === "dark"}>
      <ThemeProvider theme={screen}>{thread}</ThemeProvider>
    </PhoneFrame>
  ) : (
    thread
  );

  if (!p.caption.length || portrait) return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>{main}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: width * 0.08 }}>
      <CaptionColumn lines={p.caption} t={t} width={width * 0.32} size={64 * u} />
      {main}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* notification_stack                                                   */
/* ------------------------------------------------------------------ */

const NotificationStackProps = z.object({
  notifications: z
    .array(
      z.object({
        app: z.string().optional(),
        title: z.string(),
        body: z.string().optional(),
        icon: z.string().optional(),
        logo: AppLogoRef.optional().describe("The app's real logo (resolved by the director) — shown instead of the icon."),
      }),
    )
    .min(2)
    .max(6),
  caption: z.array(z.string()).max(2).default([]),
  device: z.enum(["none", "phone"]).default("none"),
  peel: z.boolean().default(true).describe("Swipe them all away at the end (the 'problem solved' beat)."),
  variant: z
    .enum(["cards", "scatter", "thread", "ticker", "lockscreen"])
    .default("cards")
    .describe("cards = stacked cards · scatter = toasts pile up everywhere, camera pulls back · thread = a team channel scrolling · ticker = one message at a time, full-frame · lockscreen = phone with a big clock"),
});

const NotificationStack: React.FC<z.infer<typeof NotificationStackProps>> = (p) => {
  const items = p.notifications;
  switch (p.variant) {
    case "scatter": return <PingScatter items={items} caption={p.caption} />;
    case "thread": return <PingThread items={items} caption={p.caption} />;
    case "ticker": return <PingTicker items={items} caption={p.caption} />;
    case "lockscreen": return <PingLockscreen items={items} caption={p.caption} />;
    default: return <NotificationCards {...p} />;
  }
};

const NotificationCards: React.FC<z.infer<typeof NotificationStackProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { width, height, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const phone = p.device === "phone";
  const s = phone ? 0.6 : 1;
  const w = phone ? height * 0.78 * 0.49 * 0.86 : Math.min(760 * u, width * 0.8);
  const peelAt = dur * 0.68;
  const stack = (
    <div style={{ width: w, display: "flex", flexDirection: "column", gap: 14 * u * s, paddingTop: phone ? 120 * u : 0 }}>
      {phone && (
        <div style={{ textAlign: "center", color: "#fff", fontSize: 88 * u * s, fontWeight: 300, marginBottom: 30 * u * s }}>9:41</div>
      )}
      {p.notifications.map((n, i) => {
        const a = progress(t, 0.15 + i * 0.22, 0.45, "overshoot");
        const pe = p.peel ? progress(t, peelAt + i * 0.07, 0.4, "in") : 0;
        const jitter = Math.sin(t * 14 + i * 7) * 0.5 * (1 - pe);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 18 * u * s,
              alignItems: "center",
              background: phone ? "rgba(255,255,255,.9)" : theme.card,
              color: "#111",
              border: phone ? "none" : `1px solid ${theme.border}`,
              borderRadius: 26 * u * s,
              padding: `${20 * u * s}px ${24 * u * s}px`,
              boxShadow: `0 18px 40px ${alpha("#0A0F1E", 0.14)}`,
              opacity: clamp01(a * 1.5) * (1 - pe),
              transform: `translate(${-pe * w * 1.1}px, ${(1 - a) * -30 * u}px) scale(${lerp(0.9, 1, a)}) rotate(${jitter}deg)`,
            }}
          >
            {n.logo ? (
              <AppLogo logo={n.logo} name={n.app} size={56 * u * s} radius={14 * u * s} />
            ) : (
              <div style={{ width: 56 * u * s, height: 56 * u * s, borderRadius: 14 * u * s, background: mix(theme.primary, "#ffffff", 0.1), color: theme.primaryForeground, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={n.icon ?? "bell"} size={30 * u * s} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 * u * s, color: "#6b6f76", fontWeight: 600 }}>
                <span>{(n.app ?? theme.name).toUpperCase()}</span>
                <span>now</span>
              </div>
              <div style={{ fontSize: 26 * u * s, fontWeight: 700, color: theme.mode === "dark" && !phone ? theme.cardForeground : "#111" }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 22 * u * s, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
  const main = phone ? (
    <PhoneFrame height={height * 0.78} screenBg={`linear-gradient(180deg, ${mix(theme.primary, "#000000", 0.35)}, #0B0B0C)`}>
      {stack}
    </PhoneFrame>
  ) : (
    stack
  );
  if (!p.caption.length || portrait) return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>{main}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: width * 0.08 }}>
      <CaptionColumn lines={p.caption} t={t} width={width * 0.32} size={64 * u} />
      {main}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* approval_card                                                        */
/* ------------------------------------------------------------------ */

const ApprovalCardProps = z.object({
  badge: z.string().default("Waiting for your approval"),
  items: z.array(z.object({ name: z.string(), meta: z.string().optional() })).min(1).max(4),
  totalLabel: z.string().default("Total"),
  total: z.string().optional(),
  approve: z.string().default("Approve"),
  deny: z.string().default("Deny"),
  clickApprove: z.boolean().default(true),
});

const ApprovalCard: React.FC<z.infer<typeof ApprovalCardProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const cardW = 620 * u;
  const cardA = progress(t, 0, 0.6, "expo");
  const badgeA = progress(t, 0.3, 0.5, "overshoot");
  const clickT = dur * 0.66;
  const cur = useCursor(
    p.clickApprove
      ? [
          { t: 0, x: cardW * 1.2, y: 700 * u },
          { t: clickT - 0.9, x: cardW * 1.1, y: 640 * u },
          { t: clickT - 0.35, x: (cardW - 72 * u) * 0.75, y: 34 * u, click: true },
        ]
      : [],
    t,
  );
  const approved = p.clickApprove && t >= clickT;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -90 * u,
            transform: `translateX(-50%) scale(${badgeA})`,
            opacity: clamp01(badgeA * 1.4),
            zIndex: 3,
          }}
        >
          <Surface pad={0} style={{ display: "flex", alignItems: "center", gap: 14 * u, padding: `${12 * u}px ${24 * u}px ${12 * u}px ${12 * u}px`, borderRadius: 999 }}>
            <LogoMark size={48 * u} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 22 * u }}>{theme.name}</div>
              <div style={{ fontSize: 17 * u, color: theme.mutedForeground, display: "flex", alignItems: "center", gap: 6 * u }}>
                <Icon name={approved ? "circle-check" : "lock"} size={16 * u} />
                {approved ? "Approved" : p.badge}
              </div>
            </div>
          </Surface>
        </div>
        <Surface pad={36 * u} style={{ width: cardW, opacity: cardA, transform: `scale(${lerp(0.9, 1, cardA)})` }}>
          {p.items.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18 * u, padding: `${12 * u}px 0`, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ width: 56 * u, height: 56 * u, borderRadius: 14 * u, background: theme.muted, flex: "none" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 24 * u }}>{it.name}</div>
                {it.meta && <div style={{ fontSize: 19 * u, color: theme.mutedForeground }}>{it.meta}</div>}
              </div>
            </div>
          ))}
          {p.total && (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 28 * u, marginTop: 22 * u }}>
              <span>{p.totalLabel}</span>
              <span>{p.total}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 16 * u, marginTop: 26 * u, position: "relative" }}>
            <div style={{ flex: 1, height: 68 * u, borderRadius: 999, background: theme.secondary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 24 * u, opacity: progress(t, 0.6, 0.3) }}>
              {p.deny}
            </div>
            <div
              style={{
                flex: 1,
                height: 68 * u,
                borderRadius: 999,
                background: approved ? "#22C55E" : theme.primary,
                color: theme.primaryForeground,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10 * u,
                fontWeight: 700,
                fontSize: 24 * u,
                opacity: progress(t, 0.7, 0.3),
                transform: `scale(${cur.pressed ? 0.95 : 1})`,
              }}
            >
              {approved && <Icon name="check" size={26 * u} strokeWidth={3} />}
              {p.approve}
            </div>
            {p.clickApprove && <Cursor x={cur.x} y={cur.y} pressed={cur.pressed} sinceClick={cur.sinceClick} scale={1.3 * u} opacity={progress(t, clickT - 1.1, 0.3)} />}
          </div>
        </Surface>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* phone_showcase                                                       */
/* ------------------------------------------------------------------ */

const PhoneShowcaseProps = z.object({
  screenshot: z.string().optional().describe("Asset path to an app screenshot (tall images scroll). Omit for a branded splash."),
  caption: z.array(z.string()).max(3).default([]),
  scroll: z.number().min(0).max(1).default(0.3),
  side: z.enum(["right", "left"]).default("right"),
});

const PhoneShowcase: React.FC<z.infer<typeof PhoneShowcaseProps>> = (p) => {
  const { t, dur } = useSceneTime();
  const { width, height, u, portrait } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const ph = height * (portrait ? 0.62 : 0.8);
  const enter = progress(t, 0, 0.9, "expo");
  const s = progress(t, 0.8, Math.max(0.5, dur - 1), "smooth") * p.scroll;
  const vpH = ph * 0.93;
  const phoneEl = (
    <div style={{ transform: `translateY(${(1 - enter) * height * 0.4}px) rotate(${(1 - enter) * (p.side === "right" ? 8 : -8)}deg)` }}>
      <PhoneFrame height={ph} screenBg={theme.background} darkUi={theme.mode === "dark"}>
        {p.screenshot ? (
          <Img src={asset(p.screenshot)!} style={{ width: "100%", display: "block", transform: `translateY(calc(${-s * 100}% + ${s * vpH}px))` }} />
        ) : (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${theme.primary}, ${mix(theme.primary, "#000", 0.4)})` }}>
            <div style={{ transform: `scale(${progress(t, 0.4, 0.6, "overshoot")})` }}>
              <LogoMark size={110 * u} />
            </div>
          </AbsoluteFill>
        )}
      </PhoneFrame>
    </div>
  );
  if (!p.caption.length || portrait) return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>{phoneEl}</AbsoluteFill>;
  const cap = <CaptionColumn lines={p.caption} t={t} width={width * 0.36} size={68 * u} start={0.35} />;
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: width * 0.1 }}>
      {p.side === "right" ? cap : phoneEl}
      {p.side === "right" ? phoneEl : cap}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* video_showcase                                                       */
/* ------------------------------------------------------------------ */

const VideoShowcaseProps = z.object({
  src: z.string().describe("Asset path to real footage (screen recording, product clip)."),
  startFrom: z.number().default(0).describe("Seconds into the clip to start."),
  frame: z.enum(["window", "browser", "full"]).default("window"),
  url: z.string().optional(),
  mosaic: z.array(z.string()).max(8).default([]).describe("Still images for an ending mosaic wall (optional)."),
});

const VideoShowcase: React.FC<z.infer<typeof VideoShowcaseProps>> = (p) => {
  const { t, dur, fps } = useSceneTime();
  const { width, u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const mosaicAt = p.mosaic.length ? dur - 1.1 : Infinity;
  const grow = springLike(t);
  const w = p.frame === "full" ? width : width * lerp(0.42, 0.72, grow);
  const h = w * 9 / 16;
  const vid = <OffthreadVideo src={asset(p.src)!} trimBefore={Math.round(p.startFrom * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  if (t >= mosaicAt) {
    const cols = 4;
    const tileW = (width * 0.86 - 3 * 16 * u) / cols;
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap: 16 * u }}>
          {p.mosaic.map((m, i) => {
            const a = progress(t, mosaicAt + i * 0.05, 0.35, "expo");
            return <Img key={i} src={asset(m)!} style={{ width: tileW, height: tileW * 9 / 16, objectFit: "cover", borderRadius: 12 * u, opacity: a, transform: `scale(${lerp(0.85, 1, a)})` }} />;
          })}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {p.frame === "browser" ? (
        <BrowserWindow width={w} height={h} url={p.url}>
          {vid}
        </BrowserWindow>
      ) : (
        <div style={{ width: w, height: h, borderRadius: p.frame === "full" ? 0 : theme.radius, overflow: "hidden", boxShadow: "0 50px 100px rgba(0,0,0,.35)", border: p.frame === "full" ? "none" : `1px solid ${theme.border}` }}>
          {vid}
        </div>
      )}
    </AbsoluteFill>
  );
};
const springLike = (t: number) => kf(t, [[0, 0], [0.9, 1.04, "expo"], [1.3, 1, "easy"]]);

/* ------------------------------------------------------------------ */

export const productScenes = [
  defineScene({
    type: "site_showcase",
    category: "product",
    description:
      "The brand's REAL website/product screenshot in a browser window: 3D tilt-up entrance, slow scroll, optional push-in on a point (zoom), cursor click, and callout labels. Optional title switches to text-left layout. Use whenever real screenshots exist — real UI beats invented UI.",
    duration: [3, 6],
    schema: SiteShowcaseProps,
    component: SiteShowcase,
    ownCamera: true,
    assetProps: ["screenshot"],
    example: { screenshot: "shots/home.png", url: "clep.dev", scroll: 0.3, zoom: { x: 0.5, y: 0.45, scale: 1.6, at: 1.6 }, callouts: [{ text: "One-click export", x: 0.62, y: 0.4, at: 1 }] },
  }),
  defineScene({
    type: "ui_click",
    category: "product",
    description:
      "Built app mock (sidebar, heading, big primary button) — cursor flies in, clicks, spinner → check, success toast pops. Optional particle assembly intro. Use for the 'one click and it's done' moment when no screenshot exists.",
    duration: [3, 5],
    schema: UiClickProps,
    component: UiClick,
    example: { heading: "Turn this flow into a video", button: "Generate clip", result: "Clip ready — 0:28", tag: "Signup flow" },
  }),
  defineScene({
    type: "feature_grid",
    category: "product",
    description: "2-6 feature cards (lucide icon, title, short desc) rise in a staggered grid; optional card spotlight at the end.",
    duration: [3, 5],
    schema: FeatureGridProps,
    component: FeatureGrid,
    example: {
      title: "Everything in one pass",
      features: [
        { icon: "mouse-pointer-click", title: "Real cursor", desc: "Recorded, then smoothed" },
        { icon: "zoom-in", title: "Auto zoom", desc: "Follows every click" },
        { icon: "film", title: "4K export", desc: "MP4, GIF, WebM" },
      ],
      highlight: 1,
    },
  }),
  defineScene({
    type: "search_results",
    category: "product",
    description: "Prompt/search bar types a query, shimmering status line, then result cards drop in. AI search, agents, 'ask anything' products.",
    duration: [3, 5],
    schema: SearchResultsProps,
    component: SearchResults,
    example: { query: "What changed in our signup flow?", status: "Reading 4 pages…", results: [{ title: "Signup v2 shipped", source: "GitHub", meta: "2h ago" }, { title: "Conversion up 18%", source: "Analytics" }] },
  }),
  defineScene({
    type: "chat_demo",
    category: "product",
    description: "Chat thread: user bubbles, agent typing indicator then reply, then result cards slide up. Optional phone frame and caption column.",
    duration: [3.5, 6],
    schema: ChatDemoProps,
    component: ChatDemo,
    example: { messages: [{ from: "user", text: "Make a 30s launch clip of onboarding" }, { from: "agent", text: "On it — recording now." }], results: ["Recorded 6 steps", "Zoomed on 3 clicks", "Exported 1080p"], caption: ["Just ask."] },
  }),
  defineScene({
    type: "notification_stack",
    category: "product",
    description: "Notification cards stack in with a nervous jitter, then swipe away together ('problem → solved'). Optional phone lock screen + caption column.",
    duration: [3, 5],
    schema: NotificationStackProps,
    component: NotificationStack,
    anchor: (p, { width, height }) => {
      const u1 = Math.min(width, height) / 1080;
      if (p.variant === "thread") {
        const u = u1 * 1.3, w = Math.min(width * 0.62, 1100 * u), h = height * 0.7;
        const r = { x: (width - w) / 2, y: (height - h) / 2, w, h, r: 26 * u, fill: "card" as const };
        return { in: r, out: r };
      }
      if (p.variant === "lockscreen" && !p.caption.length) {
        const h = height * 0.86, w = h * 0.49;
        const r = { x: (width - w) / 2, y: (height - h) / 2, w, h, r: w * 0.17, fill: "dark" as const };
        return { in: r, out: r };
      }
      if ((!p.variant || p.variant === "cards") && !p.caption.length && p.device !== "phone") {
        const u = u1 * UI_SCALE, w = Math.min(760 * u, width * 0.8), n = p.notifications.length;
        const h = n * 97 * u + (n - 1) * 14 * u;
        return { in: { x: (width - w) / 2, y: (height - h) / 2, w, h: 97 * u, r: 26 * u, fill: "card" }, out: null };
      }
      return null;
    },
    example: { caption: ["Too many tools.", "Too many tabs."], notifications: [{ app: "Slack", title: "Can you record the demo?", icon: "message-square" }, { app: "Loom", title: "Recording failed", icon: "video-off" }, { app: "Calendar", title: "Launch in 2 hours", icon: "calendar" }] },
  }),
  defineScene({
    type: "approval_card",
    category: "product",
    description: "Checkout/permission card with line items + total, floating brand badge 'waiting for approval', cursor clicks Approve → turns green. Agentic 'you stay in control' beat.",
    duration: [3, 5],
    schema: ApprovalCardProps,
    component: ApprovalCard,
    example: { items: [{ name: "Pro plan", meta: "Annual" }, { name: "2 extra seats" }], total: "$240", approve: "Allow" },
  }),
  defineScene({
    type: "phone_showcase",
    category: "product",
    description: "Phone rises in beside a caption column; shows a real app screenshot scrolling (or a branded splash). Mobile products.",
    duration: [3, 5],
    schema: PhoneShowcaseProps,
    component: PhoneShowcase,
    assetProps: ["screenshot"],
    example: { caption: ["Your whole day,", "handled."] },
  }),
  defineScene({
    type: "video_showcase",
    category: "product",
    description: "Real footage in a floating window that springs up to size (camera pushes through), optional browser chrome, optional ending mosaic of stills.",
    duration: [3, 7],
    schema: VideoShowcaseProps,
    component: VideoShowcase,
    anchor: (p, { width, height }) => {
      if (p.frame === "full") return null;
      const u = Math.min(width, height) / 1080;
      const at = (f: number) => { const w = width * f, h = (w * 9) / 16; return { x: (width - w) / 2, y: (height - h) / 2, w, h, r: 16 * u, fill: "card" as const }; };
      return { in: at(0.42), out: at(0.72) };
    },
    ownCamera: true,
    assetProps: ["src", "mosaic"],
    example: { src: "footage/demo.mp4", frame: "browser", url: "app.clep.dev" },
  }),
];

