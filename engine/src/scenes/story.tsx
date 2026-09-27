import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";

const UI_SCALE = 1.35;
import { useSceneTime, useStyle } from "@/engine/SceneContext";
import { asset } from "@/engine/brandTheme";
import { progress, clamp01, lerp, rand } from "@/kit/motion/keyframes";
import { ease } from "@/kit/motion/easing";
import { KineticText } from "@/kit/motion/KineticText";
import { useKitTheme } from "@/kit/theme";
import { alpha } from "@/kit/lib/color";
import { Icon } from "@/kit/ui/bits";
import { Surface } from "@/kit/ui/devices";

const cardRest = (i: number, n: number, rx: number, ry: number) => {
  const r1 = rand(i * 5.3 + 11);
  const r2 = rand(i * 9.1 + 13);
  const ang = (i / n) * Math.PI * 1.5 - Math.PI * 0.75 + (r1 - 0.5) * 0.3;
  const rad = 0.75 + r2 * 0.4;
  return { x: Math.cos(ang) * rx * rad, y: Math.sin(ang) * ry * rad, rot: (r1 - 0.5) * 20 };
};

/* ------------------------------------------------------------------ */
/* card_scatter (ex capture_cards)                                      */
/* ------------------------------------------------------------------ */

const CardScatterProps = z.object({
  cards: z.array(z.object({ label: z.string(), icon: z.string().optional(), image: z.string().optional() })).min(2).max(6),
  title: z.string().optional().describe("Centered text the cards burst out from."),
  flash: z.boolean().default(true).describe("Camera-flash on each capture."),
});

const CardScatter: React.FC<z.infer<typeof CardScatterProps>> = ({ cards, title, flash }) => {
  const { t, dur } = useSceneTime();
  const { width, height, u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const style = useStyle();
  const n = cards.length;
  const per = Math.min(0.55, (dur - 0.6) / n);
  const cw = 320 * u;
  const ch = 210 * u;
  let flashA = 0;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {title && (
        <div style={{ position: "absolute" }}>
          <KineticText text={title} anim={style.titleAnim} size={80 * u * style.typeScale} weight={style.weight} tracking={style.tracking} uppercase={style.uppercase} />
        </div>
      )}
      {cards.map((c, i) => {
        const s0 = 0.3 + i * per;
        if (t < s0) return null;
        if (flash) flashA = Math.max(flashA, 1 - clamp01((t - s0) / 0.1));
        const rest = cardRest(i, n, width * 0.34, height * 0.32);
        const p = ease("expo")(clamp01((t - s0) / 0.6));
        const bounce = 1 + 0.2 * (1 - clamp01((t - s0) / 0.22));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: width / 2 + lerp(0, rest.x, p) - cw / 2,
              top: height / 2 + lerp(0, rest.y, p) - ch / 2,
              transform: `rotate(${lerp(0, rest.rot, p)}deg) scale(${bounce})`,
              opacity: clamp01((t - s0) / 0.08),
            }}
          >
            <Surface pad={0} style={{ width: cw, height: ch, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {c.image ? (
                <Img src={asset(c.image)!} style={{ width: "100%", flex: 1, objectFit: "cover" }} />
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.08), color: theme.primary }}>
                  <Icon name={c.icon ?? "image"} size={64 * u} />
                </div>
              )}
              <div style={{ padding: `${14 * u}px ${18 * u}px`, fontWeight: 700, fontSize: 24 * u, borderTop: `1px solid ${theme.border}` }}>{c.label}</div>
            </Surface>
          </div>
        );
      })}
      {flashA > 0 && <AbsoluteFill style={{ background: "#fff", opacity: flashA * 0.7 }} />}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* timeline_assemble                                                    */
/* ------------------------------------------------------------------ */

const TimelineAssembleProps = z.object({
  clips: z.array(z.string()).min(2).max(6).describe("Clip labels (reuse the preceding card_scatter labels for continuity)."),
  tags: z.array(z.string()).max(6).default(["zoom", "cut", "focus", "cursor"]).describe("Auto-edit tags that pop as the playhead crosses."),
});

const TimelineAssemble: React.FC<z.infer<typeof TimelineAssembleProps>> = ({ clips, tags }) => {
  const { t, dur } = useSceneTime();
  const { width, height, u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const n = clips.length;
  const x0 = width * 0.12;
  const x1 = width * 0.88;
  const slot = (x1 - x0) / n;
  const trackY = height * 0.5;
  const clipH = 120 * u;
  const playStart = 1.2;
  const pp = clamp01((t - playStart) / Math.max(0.5, dur - playStart - 0.2));
  const px = x0 + pp * (x1 - x0);
  return (
    <AbsoluteFill>
      {clips.map((label, i) => {
        const rest = cardRest(i, n, width * 0.34, height * 0.32);
        const p = ease("expo")(clamp01((t - i * 0.1) / 0.7));
        const tx = x0 + i * slot + 6 * u;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: lerp(width / 2 + rest.x - 160 * u, tx, p),
              top: lerp(height / 2 + rest.y - 260 * u, trackY - clipH / 2, p),
              width: lerp(320 * u, slot - 12 * u, p),
              height: lerp(210 * u, clipH, p),
              transform: `rotate(${lerp(rest.rot, 0, p)}deg)`,
              borderRadius: 14 * u,
              background: theme.card,
              border: `1.5px solid ${px > tx && px < tx + slot ? theme.primary : theme.border}`,
              boxShadow: `0 20px 40px ${alpha("#0A0F1E", 0.12)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 24 * u,
              overflow: "hidden",
            }}
          >
            {label}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: x0, top: trackY + clipH / 2 + 30 * u, width: x1 - x0, height: 2, background: theme.border, opacity: progress(t, 0.9, 0.4) }} />
      {t > playStart && (
        <>
          <div style={{ position: "absolute", left: px - 1.5 * u, top: trackY - clipH / 2 - 50 * u, width: 3 * u, height: clipH + 100 * u, background: theme.primary, borderRadius: 2 }} />
          <div style={{ position: "absolute", left: px - 9 * u, top: trackY - clipH / 2 - 62 * u, width: 18 * u, height: 18 * u, borderRadius: "50%", background: theme.primary }} />
        </>
      )}
      {tags.map((tag, i) => {
        const tx = x0 + ((i % n) + 0.5) * slot;
        const d = px - tx;
        if (t <= playStart || d < 0 || d > slot * 0.8) return null;
        const a = 1 - d / (slot * 0.8);
        const pop = ease("overshoot")(clamp01(d / (slot * 0.12)));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: tx,
              top: trackY + clipH / 2 + 60 * u,
              transform: `translateX(-50%) scale(${pop})`,
              opacity: a,
              fontFamily: theme.fontMono,
              fontSize: 24 * u,
              fontWeight: 600,
              color: theme.primaryForeground,
              background: theme.primary,
              padding: `${6 * u}px ${16 * u}px`,
              borderRadius: 999,
            }}
          >
            {tag}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* logo_wall                                                            */
/* ------------------------------------------------------------------ */

const LogoWallProps = z.object({
  title: z.string().default("Trusted by teams at"),
  logos: z.array(z.string()).min(3).max(16).describe("Company names (rendered as wordmarks) or asset paths to logo images."),
  rows: z.number().int().min(1).max(3).default(2),
});

const LogoWall: React.FC<z.infer<typeof LogoWallProps>> = ({ title, logos, rows }) => {
  const { t } = useSceneTime();
  const { width, u } = useLayout(UI_SCALE);
  const theme = useKitTheme();
  const style = useStyle();
  const isImg = (s: string) => /\.(png|svg|jpe?g|webp)$/i.test(s) || s.startsWith("http");
  const itemW = 300 * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 60 * u }}>
      <KineticText text={title} anim={style.titleAnim} size={48 * u} weight={600} color={theme.mutedForeground} tracking={-0.01} />
      <div
        style={{
          width,
          display: "flex",
          flexDirection: "column",
          gap: 40 * u,
          maskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
          opacity: progress(t, 0.3, 0.6),
        }}
      >
        {Array.from({ length: rows }).map((_, r) => {
          const row = logos.filter((_, i) => i % rows === r);
          const seq = [...row, ...row, ...row, ...row];
          const rowW = row.length * itemW;
          const dir = r % 2 === 0 ? -1 : 1;
          const off = ((t * 90 * u) % rowW) * dir;
          return (
            <div key={r} style={{ display: "flex", transform: `translateX(${off - (dir > 0 ? rowW : 0)}px)` }}>
              {seq.map((l, i) => (
                <div key={i} style={{ width: itemW, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.65 }}>
                  {isImg(l) ? (
                    <Img src={asset(l)!} style={{ height: 54 * u, width: "auto", filter: theme.mode === "dark" ? "brightness(0) invert(1)" : "grayscale(1)" }} />
                  ) : (
                    <span style={{ fontFamily: theme.fontDisplay, fontSize: 44 * u, fontWeight: theme.displayWeight ?? (800), letterSpacing: "-0.03em", color: theme.foreground }}>{l}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const storyScenes = [
  defineScene({
    type: "card_scatter",
    category: "story",
    description: "Cards burst out from center one by one with a camera flash and settle scattered around the frame — 'captures', 'moments', 'everything it grabbed'.",
    duration: [2.5, 4.5],
    schema: CardScatterProps,
    component: CardScatter,
    assetProps: ["cards"],
    example: { cards: [{ label: "Sign up", icon: "user-plus" }, { label: "Verify email", icon: "mail-check" }, { label: "Dashboard", icon: "layout-dashboard" }, { label: "Invite team", icon: "users" }] },
  }),
  defineScene({
    type: "timeline_assemble",
    category: "story",
    description: "Scattered cards slam onto an editing timeline; a playhead sweeps and auto-edit tags pop as it crosses. 'It edits itself.' Pairs with card_scatter.",
    duration: [3.5, 5.5],
    schema: TimelineAssembleProps,
    component: TimelineAssemble,
    example: { clips: ["Sign up", "Verify email", "Dashboard", "Invite team"], tags: ["zoom", "cut", "focus", "cursor"] },
  }),
  defineScene({
    type: "logo_wall",
    category: "story",
    description: "Social proof: 1-3 rows of customer logos/wordmarks drifting in opposite directions under a 'Trusted by' line.",
    duration: [2.5, 4],
    schema: LogoWallProps,
    component: LogoWall,
    assetProps: ["logos"],
    example: { logos: ["Vercel", "Linear", "Raycast", "Supabase", "Resend", "Cursor"] },
  }),
];
