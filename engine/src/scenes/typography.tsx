import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { z } from "zod";
import { defineScene, useLayout } from "@/engine/defineScene";
import { useSceneTime, useStyle } from "@/engine/SceneContext";
import { KineticText, fitSize } from "@/kit/motion/KineticText";
import { progress, clamp01 } from "@/kit/motion/keyframes";
import { ease } from "@/kit/motion/easing";
import { useKitTheme } from "@/kit/theme";
import { Accent, Icon, Pill } from "@/kit/ui/bits";
import { asset } from "@/engine/brandTheme";
import { mix } from "@/kit/lib/color";

/** Average glyph width / font size for fitting: caps run ~25% wider, heavy (800+) caps wider still. */
const charW = (style: { uppercase?: boolean; weight?: number }) =>
  style.uppercase ? ((style.weight ?? 700) >= 800 ? 0.74 : 0.64) : 0.52;

const TextAnimEnum = z.enum(["mask", "words", "chars", "slam", "scramble", "blur", "stream", "pullout", "build"]);

/* ------------------------------------------------------------------ */
/* kinetic_title                                                        */
/* ------------------------------------------------------------------ */

const KineticTitleProps = z.object({
  title: z.string().describe("Headline. Use \\n for a deliberate line break. ≤ 8 words lands best."),
  accent: z.string().optional().describe("Exact substring of title to color in the brand primary."),
  eyebrow: z.string().optional().describe("Small pill/label above the title."),
  subtitle: z.string().optional(),
  anim: TextAnimEnum.optional().describe("Override the style's title animation."),
  align: z.enum(["center", "left"]).default("center"),
  exit: z.boolean().default(false).describe("Animate text out before the cut."),
});

const KineticTitle: React.FC<z.infer<typeof KineticTitleProps>> = ({ title, accent, eyebrow, subtitle, anim, align, exit }) => {
  const style = useStyle();
  const { t } = useSceneTime();
  const { width, u } = useLayout();
  const theme = useKitTheme();
  const maxW = width * 0.82;
  const size = fitSize(title, maxW, 150 * u * style.typeScale, 54 * u, charW(style));
  const titleAnim = anim ?? style.titleAnim;
  const hasEyebrow = !!eyebrow;
  const eb = progress(t, 0, 0.5, style.ease);
  const sub = progress(t, 0.45 + title.split(" ").length * style.stagger, 0.6, style.ease);
  const left = align === "left";
  return (
    <AbsoluteFill
      style={{
        alignItems: left ? "flex-start" : "center",
        justifyContent: "center",
        padding: left ? `0 ${width * 0.09}px` : 0,
        gap: 28 * u,
        flexDirection: "column",
      }}
    >
      {hasEyebrow && (
        <div style={{ opacity: eb, transform: `translateY(${(1 - eb) * 16 * u}px)` }}>
          <Pill tone="card" size={26 * u}>
            {eyebrow}
          </Pill>
        </div>
      )}
      <KineticText
        text={title}
        accent={accent}
        anim={titleAnim}
        delay={hasEyebrow ? 0.15 : 0}
        stagger={style.stagger}
        size={size}
        weight={style.weight}
        tracking={style.tracking}
        uppercase={style.uppercase}
        align={align}
        maxWidth={maxW}
        exit={exit}
      />
      {subtitle && (
        <div
          style={{
            opacity: sub,
            transform: `translateY(${(1 - sub) * 18 * u}px)`,
            fontSize: Math.max(26 * u, size * 0.26),
            color: theme.mutedForeground,
            fontWeight: 500,
            maxWidth: maxW * 0.8,
            textAlign: align,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* word_flash                                                           */
/* ------------------------------------------------------------------ */

const WordFlashProps = z.object({
  words: z.array(z.string()).min(2).max(10).describe("Short words/phrases hard-cut one after another (on the beat)."),
  final: z.string().optional().describe("Held last line after the flashes."),
  accent: z.string().optional().describe("Substring of `final` to color."),
  invertEvery: z.boolean().default(true).describe("Alternate background/ink on each flash for strobe energy."),
});

const WordFlash: React.FC<z.infer<typeof WordFlashProps>> = ({ words, final, accent, invertEvery }) => {
  const { t, dur } = useSceneTime();
  const { width, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const finalDur = final ? Math.min(dur * 0.45, 1.4) : 0;
  const slice = (dur - finalDur) / words.length;
  const idx = Math.floor(t / slice);
  const inFinal = !!final && t >= dur - finalDur;
  const word = inFinal ? final! : words[Math.min(idx, words.length - 1)];
  const local = inFinal ? t - (dur - finalDur) : t - idx * slice;
  const punch = 1 + 0.18 * (1 - ease("expo")(clamp01(local / 0.22)));
  const inverted = invertEvery && !inFinal && idx % 2 === 1;
  const size = fitSize(word, width * 0.86, 190 * u * style.typeScale, 60 * u, 0.55);
  return (
    <AbsoluteFill
      style={{
        background: inverted ? theme.foreground : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${punch})`,
          fontFamily: theme.fontDisplay,
          fontWeight: theme.displayWeight ?? (Math.max(style.weight), 800),
          fontSize: size,
          letterSpacing: `${style.tracking}em`,
          textTransform: style.uppercase ? "uppercase" : undefined,
          color: inverted ? theme.background : theme.foreground,
          textAlign: "center",
          lineHeight: 1,
          maxWidth: width * 0.9,
        }}
      >
        {inFinal ? <Accent text={word} accent={accent} /> : word}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* statement                                                            */
/* ------------------------------------------------------------------ */

const StatementProps = z.object({
  lines: z.array(z.string()).min(1).max(4).describe("Lines revealed in sequence; earlier lines dim as new ones land."),
  accent: z.string().optional().describe("Substring (in any line) to color."),
  dimPrevious: z.boolean().default(true),
});

const Statement: React.FC<z.infer<typeof StatementProps>> = ({ lines, accent, dimPrevious }) => {
  const { t, dur } = useSceneTime();
  const { width, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const per = Math.min(1.1, (dur - 0.6) / lines.length);
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  // Caps set ~25% wider than mixed case — size for it, or uppercase styles overflow narrow (9:16) frames.
  const size = fitSize(longest, width * 0.8, 112 * u * style.typeScale, 44 * u, charW(style));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: size * 0.18 }}>
      {lines.map((line, i) => {
        const start = 0.1 + i * per;
        const p = progress(t, start, 0.55, style.ease);
        const newer = lines.findIndex((_, j) => j > i && t >= 0.1 + j * per);
        const dim = dimPrevious && newer !== -1 ? 0.28 : 1;
        return (
          <div
            key={i}
            style={{
              overflow: "hidden",
              padding: `0 ${size * 0.12}px ${size * 0.14}px`,
              margin: `0 ${-size * 0.12}px ${-size * 0.06}px`,
            }}
          >
            <div
              style={{
                // Start fully below the (padded) mask so nothing peeks before its beat.
                transform: `translateY(${(1 - p) * 140}%)`,
                opacity: dim,
                fontFamily: theme.fontDisplay,
                fontSize: size,
                fontWeight: theme.displayWeight ?? (style.weight),
                letterSpacing: `${style.tracking}em`,
                textTransform: style.uppercase ? "uppercase" : undefined,
                lineHeight: 1.05,
                textAlign: "center",
                color: theme.foreground,
                maxWidth: width * 0.86,
              }}
            >
              <Accent text={line} accent={accent} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* list_reveal (ex kinetic_cascade)                                     */
/* ------------------------------------------------------------------ */

const ListRevealProps = z.object({
  title: z.string().optional(),
  items: z.array(z.string()).min(2).max(6),
  marker: z.enum(["check", "arrow", "number", "none"]).default("check"),
  emphasis: z.number().int().optional().describe("0-based item index to highlight in brand color."),
});

const ListReveal: React.FC<z.infer<typeof ListRevealProps>> = ({ title, items, marker, emphasis }) => {
  const { t, dur } = useSceneTime();
  const { u, width } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const start = title ? 0.5 : 0.15;
  const gap = Math.min(0.45, (dur - start - 0.8) / items.length);
  // One line per item: shrink to the longest one (wide display fonts / caps would overflow otherwise).
  const longest = items.reduce((a, b) => (b.length > a.length ? b : a), "");
  const size = fitSize(longest, width * 0.7, 76 * u * style.typeScale, 30 * u, charW(style), 1);
  const tp = progress(t, 0, 0.5, style.ease);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 44 * u }}>
      {title && (
        <div
          style={{
            opacity: tp,
            transform: `translateY(${(1 - tp) * 14 * u}px)`,
            fontSize: 30 * u,
            fontWeight: 600,
            color: theme.mutedForeground,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 * u, alignItems: "flex-start" }}>
        {items.map((item, i) => {
          const s0 = start + i * gap;
          const p = progress(t, s0, 0.4, "expo");
          const pop = progress(t, s0 + 0.12, 0.35, "overshoot");
          const hl = emphasis === i;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26 * u, opacity: p, transform: `translateX(${(1 - p) * -40 * u}px)` }}>
              {marker !== "none" && (
                <div
                  style={{
                    width: size * 0.9,
                    height: size * 0.9,
                    borderRadius: marker === "number" ? size * 0.25 : "50%",
                    background: hl ? theme.primary : mix(theme.background, theme.foreground, 0.08),
                    color: hl ? theme.primaryForeground : theme.foreground,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${pop})`,
                    fontWeight: 700,
                    fontSize: size * 0.42,
                    flex: "none",
                  }}
                >
                  {marker === "check" ? <Icon name="check" size={size * 0.5} strokeWidth={3} /> : marker === "arrow" ? <Icon name="arrow-right" size={size * 0.5} /> : i + 1}
                </div>
              )}
              <span
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: size,
                  fontWeight: theme.displayWeight ?? (style.weight),
                  letterSpacing: `${style.tracking}em`,
                  textTransform: style.uppercase ? "uppercase" : undefined,
                  color: hl ? theme.accentText : theme.foreground,
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* quote                                                                */
/* ------------------------------------------------------------------ */

const QuoteProps = z.object({
  quote: z.string(),
  author: z.string(),
  role: z.string().optional(),
  avatar: z.string().optional().describe("Asset path to a headshot."),
  accent: z.string().optional(),
});

const Quote: React.FC<z.infer<typeof QuoteProps>> = ({ quote, author, role, avatar, accent }) => {
  const { t } = useSceneTime();
  const { width, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const size = fitSize(quote, width * 0.72, 72 * u, 36 * u, 0.5);
  const a = progress(t, 0.2 + quote.split(" ").length * 0.035, 0.5, style.ease);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 48 * u }}>
      <div style={{ fontSize: 160 * u, lineHeight: 0.5, color: theme.accentText, fontFamily: "Georgia, serif", opacity: progress(t, 0, 0.4) }}>“</div>
      <KineticText text={quote} accent={accent} anim="words" stagger={0.035} size={size} weight={600} maxWidth={width * 0.74} lineHeight={1.2} tracking={-0.02} />
      <div style={{ display: "flex", alignItems: "center", gap: 20 * u, opacity: a, transform: `translateY(${(1 - a) * 14 * u}px)` }}>
        {avatar && <Img src={asset(avatar)!} style={{ width: 64 * u, height: 64 * u, borderRadius: "50%", objectFit: "cover" }} />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 34 * u }}>{author}</div>
          {role && <div style={{ color: theme.mutedForeground, fontSize: 26 * u }}>{role}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const typographyScenes = [
  defineScene({
    type: "kinetic_title",
    category: "typography",
    description:
      "Big headline with the style's signature text animation (mask/words/chars/slam/scramble/blur), optional eyebrow pill and subtitle. The workhorse hook/section title.",
    duration: [1.8, 4],
    schema: KineticTitleProps,
    component: KineticTitle,
    example: { title: "Ship demos\nwithout editing.", accent: "without editing.", eyebrow: "New" },
  }),
  defineScene({
    type: "word_flash",
    category: "typography",
    description: "Rapid hard-cut word flashes on the beat (strobing ink/background), landing on a held final line. High-energy hooks and lists.",
    duration: [1.5, 3.5],
    schema: WordFlashProps,
    component: WordFlash,
    ownCamera: true,
    example: { words: ["Record.", "Edit.", "Zoom.", "Export."], final: "Done in one click.", accent: "one click." },
  }),
  defineScene({
    type: "statement",
    category: "typography",
    description: "1-4 lines rising from masks in sequence, earlier lines dimming — an argument building line by line. Great for problem→solution.",
    duration: [2.5, 5],
    schema: StatementProps,
    component: Statement,
    example: { lines: ["You don't need another tool.", "You need the work done."], accent: "work done." },
  }),
  defineScene({
    type: "list_reveal",
    category: "typography",
    description: "Title + 2-6 items punching in with check/arrow/number markers, one optionally emphasized. Features, steps, benefits.",
    duration: [2.5, 4.5],
    schema: ListRevealProps,
    component: ListReveal,
    example: { title: "What you get", items: ["Auto zoom", "Smooth cursor", "4K export"], emphasis: 1 },
  }),
  defineScene({
    type: "quote",
    category: "typography",
    description: "Testimonial: big quote mark, quote words fade in, author + role (+ avatar) below.",
    duration: [3, 5],
    schema: QuoteProps,
    component: Quote,
    assetProps: ["avatar"],
    example: { quote: "We cut our launch video time from a week to an afternoon.", author: "Alex Rivera", role: "Head of Growth" },
  }),
];
