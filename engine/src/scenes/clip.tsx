import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";
import { useScene, useStyle } from "@/engine/SceneContext";
import { asset } from "@/engine/brandTheme";
import { ease } from "@/kit/motion/easing";
import { clamp01, lerp, progress } from "@/kit/motion/keyframes";
import { KineticText, fitSize } from "@/kit/motion/KineticText";
import { useKitTheme } from "@/kit/theme";
import { alpha } from "@/kit/lib/color";
import { BrowserWindow } from "@/kit/ui/devices";
import { Pill } from "@/kit/ui/bits";

const UI_SCALE = 1.35;

/**
 * Clep trace focus: where the action happens in the RAW capture, in clip
 * seconds and fractions of the clip frame. Same shape Clep's recorder writes
 * to trace.json ("focuses"), plus optional label/click for callouts.
 */
const Focus = z.object({
  t: z.number().describe("Seconds into the clip (after startFrom)."),
  x: z.number(),
  y: z.number(),
  zoom: z.number().optional().describe("Override push-in for this beat."),
  label: z.string().optional().describe("Callout pill shown at this point."),
  click: z.boolean().default(false).describe("Draw a click ripple."),
});

const ClipShowcaseProps = z.object({
  src: z.string().describe("RAW product capture (Clep recording) — not an already-zoomed edit."),
  startFrom: z.number().default(0),
  focuses: z.array(Focus).max(12).default([]).describe("From Clep trace.json → the camera follows these."),
  zoom: z.number().default(1.55).describe("Default push-in on each focus (1 = no zoom)."),
  frame: z.enum(["browser", "window", "none"]).default("browser"),
  url: z.string().optional(),
  width: z.number().min(0.4).max(1).default(0.8).describe("Window width as a fraction of the frame at zoom 1."),
  tilt: z.boolean().default(true).describe("3D tilt-up entrance."),
  title: z.string().optional().describe("Lower-left caption over the backdrop."),
  accent: z.string().optional(),
});

type CamKey = { t: number; z: number; x: number; y: number };

function camKeys(focuses: z.infer<typeof Focus>[], zoom: number, dur: number): CamKey[] {
  const keys: CamKey[] = [{ t: 0, z: 1, x: 0.5, y: 0.5 }];
  let prev = keys[0];
  for (const f of [...focuses].sort((a, b) => a.t - b.t)) {
    const arrive = Math.max(prev.t + 0.35, f.t);
    if (arrive >= dur - 0.6) break;
    const move = Math.min(0.65, arrive - prev.t);
    keys.push({ ...prev, t: arrive - move }); // hold, then travel
    prev = { t: arrive, z: f.zoom ?? zoom, x: f.x, y: f.y };
    keys.push(prev);
  }
  // Pull back to the full window for the ending beat.
  const out = Math.max(prev.t + 0.2, dur - 1.0);
  keys.push({ ...prev, t: out }, { t: Math.max(out + 0.1, dur - 0.25), z: 1, x: 0.5, y: 0.5 });
  return keys;
}

function sample(keys: CamKey[], t: number): CamKey {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const p = ease("smooth")(clamp01((t - a.t) / Math.max(0.001, b.t - a.t)));
      return { t, z: lerp(a.z, b.z, p), x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
    }
  }
  return keys[keys.length - 1];
}

const ClipShowcase: React.FC<z.infer<typeof ClipShowcaseProps>> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { durationInFrames } = useScene();
  const style = useStyle();
  const theme = useKitTheme();
  const { width, height, u } = useLayout(UI_SCALE);
  const t = frame / fps; // footage plays in real time; the camera is keyed to it
  const dur = durationInFrames / fps;

  const winW = width * p.width;
  const barH = p.frame === "browser" ? Math.max(36, Math.round(winW * 0.62 * 0.055)) : 0;
  const vidH = (winW * 9) / 16;
  const winH = vidH + barH;

  const cam = sample(camKeys(p.focuses, p.zoom, dur), t);
  // Focus point in window px → bring it toward frame center as we zoom in.
  const fx = cam.x * winW;
  const fy = barH + cam.y * vidH;
  const pull = clamp01((cam.z - 1) / 0.5);
  const dx = (winW / 2 - fx) * pull;
  const dy = (winH / 2 - fy) * pull;

  const enter = progress(t, 0, 0.9, "expo");
  const rotX = p.tilt ? lerp(24, 0, enter) : 0;
  const ty = lerp(height * 0.2, 0, enter);

  const video = (
    <OffthreadVideo src={asset(p.src)!} trimBefore={Math.round(p.startFrom * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
  );
  const overlays = p.focuses.map((f, i) => {
    const px = f.x * winW;
    const py = barH + f.y * vidH;
    const since = t - f.t;
    const ring = f.click && since >= 0 && since < 0.6 ? since / 0.6 : -1;
    const lab = f.label ? progress(t, f.t + 0.1, 0.4, "overshoot") * (1 - progress(t, f.t + 1.9, 0.3)) : 0;
    const right = f.x < 0.62;
    return (
      <React.Fragment key={i}>
        {ring >= 0 && (
          <div
            style={{
              position: "absolute",
              left: px - (20 + ring * 50) / cam.z,
              top: py - (20 + ring * 50) / cam.z,
              width: (40 + ring * 100) / cam.z,
              height: (40 + ring * 100) / cam.z,
              borderRadius: "50%",
              border: `${3 / cam.z}px solid ${alpha(theme.accentText.startsWith("#") ? theme.accentText : "#3B6FE0", 1 - ring)}`,
              background: alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.18 * (1 - ring)),
            }}
          />
        )}
        {lab > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: px + (right ? 34 : -34) / cam.z,
              top: py - 46 / cam.z,
              transform: `translate(${right ? 0 : -100}%, -100%) scale(${lab / cam.z})`,
              transformOrigin: right ? "0% 100%" : "100% 100%",
              opacity: clamp01(lab * 1.4),
              zIndex: 5,
            }}
          >
            <Pill tone="primary" size={24 * u} style={{ boxShadow: `0 12px 30px ${alpha("#000000", 0.25)}` }}>
              {f.label}
            </Pill>
          </div>
        )}
      </React.Fragment>
    );
  });

  const win = (
    <div style={{ position: "relative", width: winW, height: winH }}>
      {p.frame === "browser" ? (
        <BrowserWindow width={winW} height={winH} url={p.url}>
          {video}
        </BrowserWindow>
      ) : (
        <div
          style={{
            width: winW,
            height: winH,
            borderRadius: p.frame === "window" ? theme.radius : 0,
            overflow: "hidden",
            boxShadow: p.frame === "window" ? `0 50px 110px ${alpha("#0A0F1E", 0.3)}` : undefined,
          }}
        >
          {video}
        </div>
      )}
      {overlays}
    </div>
  );

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `perspective(${2400 * u}px) translateY(${ty}px) rotateX(${rotX}deg) translate(${dx * cam.z}px, ${dy * cam.z}px) scale(${cam.z})`,
          transformOrigin: "50% 50%",
          opacity: clamp01(enter * 2),
        }}
      >
        {win}
      </div>
      {p.title && (
        <div style={{ position: "absolute", left: width * 0.06, bottom: height * 0.08, maxWidth: width * 0.5 }}>
          <KineticText
            text={p.title}
            accent={p.accent}
            anim={style.titleAnim}
            align="left"
            delay={0.3}
            size={fitSize(p.title, width * 0.45, 72 * u, 32 * u, 0.5, 2)}
            weight={style.weight}
            tracking={style.tracking}
            stagger={style.stagger}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* table_fill — agent working through a list, rows resolving live       */
/* ------------------------------------------------------------------ */

const TableFillProps = z.object({
  title: z.string().optional(),
  columns: z.array(z.string()).min(2).max(5),
  rows: z.array(z.array(z.string())).min(2).max(8).describe("Cell values per row (same length as columns)."),
  status: z.array(z.enum(["done", "working", "flagged"])).optional().describe("Final status per row (default all done)."),
  counterLabel: z.string().default("done").describe("Header counter: '6 / 8 done'."),
});

const TableFill: React.FC<z.infer<typeof TableFillProps>> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { speed, durationInFrames } = useScene();
  const theme = useKitTheme();
  const style = useStyle();
  const { width, u } = useLayout(UI_SCALE);
  const t = (frame / fps) * speed;
  const dur = (durationInFrames / fps) * speed;
  const start = p.title ? 0.5 : 0.15;
  const per = Math.min(0.55, (dur - start - 1) / p.rows.length);
  const tableW = Math.min(width * 0.8, 1500 * u);
  const done = p.rows.filter((_, i) => t >= start + i * per + per * 1.6).length;
  const pal = { done: "#22C55E", working: theme.accentText, flagged: "#F59E0B" };
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 * u }}>
      {p.title && <KineticText text={p.title} anim={style.titleAnim} size={56 * u} weight={style.weight} tracking={style.tracking} stagger={style.stagger} />}
      <div
        style={{
          width: tableW,
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius,
          overflow: "hidden",
          boxShadow: `0 40px 90px ${alpha("#0A0F1E", theme.mode === "dark" ? 0.5 : 0.14)}`,
          opacity: progress(t, 0, 0.4),
          transform: `translateY(${(1 - progress(t, 0, 0.7, "expo")) * 40 * u}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: `${16 * u}px ${24 * u}px`, borderBottom: `1px solid ${theme.border}`, fontFamily: theme.fontMono, fontSize: 18 * u, color: theme.mutedForeground }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 * u }}>
            <span style={{ width: 10 * u, height: 10 * u, borderRadius: "50%", background: done < p.rows.length ? theme.accentText : "#22C55E", opacity: done < p.rows.length ? 0.4 + 0.6 * Math.abs(Math.sin(t * 4)) : 1 }} />
            {done < p.rows.length ? "running" : "complete"}
          </span>
          <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", color: theme.foreground }}>
            {done} / {p.rows.length} {p.counterLabel}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${p.columns.length}, 1fr) ${150 * u}px`, fontSize: 17 * u, fontFamily: theme.fontMono, color: theme.mutedForeground, textTransform: "uppercase", letterSpacing: "0.06em", padding: `${12 * u}px ${24 * u}px`, borderBottom: `1px solid ${theme.border}` }}>
          {p.columns.map((c) => (
            <span key={c}>{c}</span>
          ))}
          <span style={{ textAlign: "right" }}>status</span>
        </div>
        {p.rows.map((row, i) => {
          const s0 = start + i * per;
          const a = progress(t, s0, 0.35, "expo");
          const resolved = t >= s0 + per * 1.6;
          const final = p.status?.[i] ?? "done";
          const shimmer = ((t * 1.2 + i * 0.3) % 1.6) - 0.3;
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${p.columns.length}, 1fr) ${150 * u}px`,
                alignItems: "center",
                padding: `${14 * u}px ${24 * u}px`,
                borderBottom: i < p.rows.length - 1 ? `1px solid ${theme.border}` : undefined,
                opacity: a,
                transform: `translateY(${(1 - a) * 14 * u}px)`,
                fontSize: 23 * u,
                background: !resolved && t >= s0 ? alpha(theme.accentText.startsWith("#") ? theme.accentText : "#3B6FE0", 0.06) : undefined,
              }}
            >
              {row.map((cell, j) => {
                const cs = s0 + 0.2 + j * per * 0.35;
                const n = Math.round(clamp01((t - cs) / 0.35) * cell.length);
                return (
                  <span
                    key={j}
                    style={{
                      fontWeight: j === 0 ? 650 : 450,
                      color: j === 0 ? theme.foreground : theme.mutedForeground,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      paddingRight: 16 * u,
                    }}
                  >
                    {n > 0 ? cell.slice(0, n) : (
                      <span style={{ display: "inline-block", width: "60%", height: 12 * u, borderRadius: 6 * u, background: `linear-gradient(90deg, ${theme.muted} ${(shimmer - 0.2) * 100}%, ${theme.border} ${shimmer * 100}%, ${theme.muted} ${(shimmer + 0.2) * 100}%)` }} />
                    )}
                  </span>
                );
              })}
              <span style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 * u, fontSize: 18 * u, fontWeight: 600, color: resolved ? pal[final] : theme.mutedForeground, fontFamily: theme.fontMono }}>
                <span style={{ width: 9 * u, height: 9 * u, borderRadius: "50%", background: resolved ? pal[final] : theme.mutedForeground, opacity: resolved ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i)) }} />
                {resolved ? final : "working"}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const clipScenes = [
  defineScene({
    type: "clip_showcase",
    category: "product",
    description:
      "A RAW Clep product capture in a floating browser window over the backdrop. The camera follows the trace.json focus points automatically — pushes in on each action, pans between them, pulls back at the end — with click ripples and label callouts. The Floating-window launch look.",
    duration: [4, 14],
    schema: ClipShowcaseProps,
    component: ClipShowcase,
    ownCamera: true,
    assetProps: ["src"],
    example: { src: "clips/capture.webm", focuses: [{ t: 1.2, x: 0.5, y: 0.4, label: "Paste your doc", click: true }] },
  }),
  defineScene({
    type: "table_fill",
    category: "product",
    description:
      "An agent working through a list: table rows appear one by one, cells type in over shimmering placeholders, status goes working → done, with a live 'N / M done' counter. Agents, enrichment, batch jobs.",
    duration: [3.5, 6],
    schema: TableFillProps,
    component: TableFill,
    example: { title: "It works the list for you", columns: ["Company", "Founder", "Funding"], rows: [["Linear", "Karri Saarinen", "$82M"], ["Raycast", "Thomas Paul Mann", "$45M"]] },
  }),
];
