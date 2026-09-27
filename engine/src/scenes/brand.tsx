import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";
import { useScene, useSceneTime, useStyle } from "@/engine/SceneContext";
import { progress, clamp01 } from "@/kit/motion/keyframes";
import { useGsapTimeline } from "@/kit/motion/gsap";
import { KineticText } from "@/kit/motion/KineticText";
import { useKitTheme } from "@/kit/theme";
import { alpha } from "@/kit/lib/color";
import { BrandLogo, Icon } from "@/kit/ui/bits";

/* ------------------------------------------------------------------ */
/* logo_reveal — GSAP-choreographed lockup                              */
/* ------------------------------------------------------------------ */

const LogoRevealProps = z.object({
  tagline: z.string().optional(),
  variant: z.enum(["cross", "scale", "wipe"]).default("cross").describe("cross: lines draw a cross that resolves into the mark; scale: mark pops; wipe: logo wipes on behind a bar."),
});

const LogoReveal: React.FC<z.infer<typeof LogoRevealProps>> = ({ tagline, variant }) => {
  const { u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const { speed } = useScene();
  const logoH = 120 * u;
  const scope = useGsapTimeline<HTMLDivElement>(
    (tl, q) => {
      if (variant === "cross") {
        tl.fromTo(q(".lr-h"), { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "kit.expo" }, 0)
          .fromTo(q(".lr-v"), { scaleY: 0 }, { scaleY: 1, duration: 0.4, ease: "kit.expo" }, 0.25)
          .to(q(".lr-h, .lr-v"), { scale: 0, rotate: 90, opacity: 0, duration: 0.35, ease: "kit.in" }, 0.75)
          .from(q(".lr-logo"), { scale: 0.4, opacity: 0, filter: "blur(12px)", duration: 0.7, ease: "kit.overshoot" }, 0.85);
      } else if (variant === "scale") {
        tl.from(q(".lr-logo"), { scale: 2.2, opacity: 0, filter: "blur(18px)", duration: 0.8, ease: "kit.expo" }, 0.1);
      } else {
        tl.set(q(".lr-logo"), { opacity: 0 }, 0)
          .fromTo(q(".lr-bar"), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.45, ease: "kit.expoInOut" }, 0.05)
          .set(q(".lr-logo"), { opacity: 1 }, 0.5)
          .set(q(".lr-bar"), { transformOrigin: "100% 50%" }, 0.5)
          .to(q(".lr-bar"), { scaleX: 0, duration: 0.45, ease: "kit.expoInOut" }, 0.5);
      }
    },
    [variant],
    { speed },
  );
  const tagDelay = variant === "cross" ? 1.4 : 0.9;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 * u }}>
      <div ref={scope} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: logoH }}>
        {variant === "cross" && (
          <>
            <div className="lr-h" style={{ position: "absolute", width: 180 * u, height: 5 * u, borderRadius: 4, background: theme.primary }} />
            <div className="lr-v" style={{ position: "absolute", width: 5 * u, height: 180 * u, borderRadius: 4, background: theme.primary }} />
          </>
        )}
        {variant === "wipe" && <div className="lr-bar" style={{ position: "absolute", inset: `-${10 * u}px -${30 * u}px`, background: theme.primary, zIndex: 2 }} />}
        <div className="lr-logo">
          <BrandLogo size={logoH} />
        </div>
      </div>
      {tagline && (
        <KineticText text={tagline} anim={style.titleAnim === "slam" ? "words" : style.titleAnim} delay={tagDelay} size={44 * u} weight={500} color={theme.mutedForeground} tracking={-0.01} stagger={0.05} />
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* end_card                                                             */
/* ------------------------------------------------------------------ */

const EndCardProps = z.object({
  headline: z.string().optional().describe("Final line above the CTA."),
  accent: z.string().optional(),
  cta: z.string().optional().describe("Button label, e.g. 'Start free'."),
  url: z.string().optional().describe("Shown under the button, e.g. 'clep.dev'."),
  fadeOut: z.boolean().default(true),
});

const EndCard: React.FC<z.infer<typeof EndCardProps>> = ({ headline, accent, cta, url, fadeOut }) => {
  const { t, left } = useSceneTime();
  const { width, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const logoA = progress(t, 0, 0.6, "expo");
  const hDelay = 0.35;
  const btn = progress(t, hDelay + 0.7, 0.55, "overshoot");
  const urlA = progress(t, hDelay + 1, 0.4);
  const out = fadeOut ? 1 - clamp01((0.35 - left) / 0.35) : 1;
  const shine = ((t - hDelay - 1.1) / 1.2) % 2;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 44 * u, opacity: out }}>
      <div style={{ opacity: logoA, transform: `translateY(${(1 - logoA) * -20 * u}px)` }}>
        <BrandLogo size={72 * u} />
      </div>
      {headline && (
        <KineticText
          text={headline}
          accent={accent}
          anim={style.titleAnim}
          delay={hDelay}
          size={Math.min(110 * u * style.typeScale, (width * 0.8) / Math.max(8, headline.length * 0.5))}
          weight={style.weight}
          tracking={style.tracking}
          uppercase={style.uppercase}
          stagger={style.stagger}
          maxWidth={width * 0.8}
        />
      )}
      {cta && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            transform: `scale(${btn})`,
            opacity: clamp01(btn * 1.5),
            background: theme.primary,
            color: theme.primaryForeground,
            fontWeight: 700,
            fontSize: 34 * u,
            padding: `${24 * u}px ${52 * u}px`,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 14 * u,
            boxShadow: `0 20px 50px ${alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.4)}`,
          }}
        >
          {cta.replace(/\s*[→➜➔>]+\s*$/, "")}
          <Icon name="arrow-right" size={34 * u} />
          {shine > 0 && shine < 1 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${-30 + shine * 160}%`,
                width: "30%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)",
                transform: "skewX(-20deg)",
              }}
            />
          )}
        </div>
      )}
      {url && <div style={{ fontFamily: theme.fontMono, fontSize: 28 * u, color: theme.mutedForeground, opacity: urlA }}>{url}</div>}
    </AbsoluteFill>
  );
};

export const brandScenes = [
  defineScene({
    type: "logo_reveal",
    category: "brand",
    description: "Brand lockup reveal choreographed in GSAP (cross→mark, scale-blur pop, or bar wipe) using the real logo if available, then the tagline. Openers and closers.",
    duration: [2.2, 4],
    schema: LogoRevealProps,
    component: LogoReveal,
    example: { tagline: "Product videos that edit themselves.", variant: "cross" },
  }),
  defineScene({
    type: "end_card",
    category: "brand",
    description: "Closing card: logo, final headline, CTA button with a light sweep, URL, then fade out. Always the last scene.",
    duration: [2.5, 4.5],
    schema: EndCardProps,
    component: EndCard,
    // The previous scene's container collapses into the CTA button.
    anchor: (p, { width, height }) => {
      if (!p.cta) return null;
      const u = Math.min(width, height) / 1080;
      return { in: { x: width / 2 - 170 * u, y: height * 0.56, w: 340 * u, h: 84 * u, r: 42 * u, fill: "primary" }, out: null };
    },
    example: { headline: "Ship the video with the feature.", cta: "Try Clep free", url: "clep.dev" },
  }),
];

