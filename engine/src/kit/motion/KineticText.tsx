import React from "react";
import { gsap, SplitText, useGsapTimeline } from "./gsap";
import { gsapEase, EaseName } from "./easing";
import { useScene, useStyle } from "@/engine/SceneContext";
import { useVideoConfig } from "remotion";
import { useKitTheme } from "../theme/ThemeProvider";
import { Accent } from "../ui/bits";

export type TextAnim = "mask" | "words" | "chars" | "slam" | "scramble" | "blur" | "stream" | "pullout" | "build" | "none";

/**
 * The AE text animator, via GSAP SplitText on a frame-seeked timeline.
 *   mask     — words rise out of an invisible mask (the classic launch-video reveal)
 *   words    — words fade/lift/unblur in sequence
 *   chars    — per-character flip-up
 *   slam     — words punch in from 2.4x scale (kinetic social)
 *   scramble — decoder-style character scramble per word (dev-tool look)
 *   blur     — cinematic blur-in
 *   stream   — words land one at a time at reading pace, the newest tinted in the accent then settling
 *              to ink (how agent output reads in the Aside / T:0 launch films)
 *   pullout  — the first word starts filling the frame and snaps back into the sentence (T:0 opener),
 *              the rest stream in after it
 *   build    the phrase grows word by word at the center and re-centers smoothly as each word lands
 *              (Replit: "in AI-powered" → "in AI-powered slides"); multi-line text falls back to stream
 * `accent` colors a substring in the brand primary; `exit` animates out before the scene ends.
 */
export const KineticText: React.FC<{
  text: string;
  accent?: string;
  anim?: TextAnim;
  /** seconds */
  delay?: number;
  stagger?: number;
  duration?: number;
  ease?: EaseName;
  size?: number;
  weight?: number;
  color?: string;
  accentColor?: string;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  tracking?: number;
  lineHeight?: number;
  font?: "display" | "body" | "mono";
  maxWidth?: number | string;
  exit?: boolean;
  italic?: boolean;
  /** Hand-drawn underline that writes on under the accent once it has landed. */
  mark?: boolean;
  style?: React.CSSProperties;
}> = ({
  text,
  accent,
  anim = "mask",
  delay = 0,
  stagger = 0.06,
  duration,
  ease = "expo",
  size = 96,
  weight = 700,
  color,
  accentColor,
  align = "center",
  uppercase = false,
  tracking = -0.03,
  lineHeight = 1.05,
  font = "display",
  maxWidth,
  exit = false,
  italic,
  mark: markProp,
  style,
}) => {
  const theme = useKitTheme();
  const look = useStyle();
  const mark = markProp ?? (!!accent && text.includes(accent) && !!look.accentMark);
  // Display fonts that ship in one weight (serifs) must not be faux-bolded.
  if (font === "display" && theme.displayWeight) weight = theme.displayWeight;
  const { speed, durationInFrames } = useScene();
  const { fps } = useVideoConfig();
  const sceneDur = (durationInFrames / fps) * speed;

  const scope = useGsapTimeline<HTMLDivElement>(
    (tl, q) => {
      const el = q(".kt")[0] as HTMLElement;
      if (!el || anim === "none") return;
      const e = gsapEase(ease);
      let targets: Element[] = [];
      switch (anim) {
        case "mask": {
          const s = SplitText.create(el, { type: "words", mask: "words" });
          // Masks clip at the glyph box — give italic overhang and descenders room without shifting layout.
          gsap.set(s.masks, { padding: "0 0.12em 0.14em 0.04em", margin: "0 -0.12em -0.14em -0.04em" });
          targets = s.words;
          tl.from(s.words, { yPercent: 118, duration: duration ?? 0.85, ease: e, stagger }, delay);
          break;
        }
        case "words": {
          const s = SplitText.create(el, { type: "words" });
          targets = s.words;
          tl.from(s.words, { opacity: 0, y: size * 0.35, filter: "blur(8px)", duration: duration ?? 0.6, ease: e, stagger }, delay);
          break;
        }
        case "chars": {
          const s = SplitText.create(el, { type: "words,chars" });
          targets = s.chars;
          gsap.set(el, { perspective: 800 });
          tl.from(
            s.chars,
            { opacity: 0, yPercent: 70, rotateX: -90, transformOrigin: "50% 100%", duration: duration ?? 0.6, ease: e, stagger: stagger * 0.45 },
            delay,
          );
          break;
        }
        case "slam": {
          const s = SplitText.create(el, { type: "words" });
          targets = s.words;
          tl.from(
            s.words,
            { opacity: 0, scale: 2.4, filter: "blur(10px)", duration: duration ?? 0.32, ease: gsapEase("snappy"), stagger: Math.max(stagger, 0.1) },
            delay,
          );
          break;
        }
        case "scramble": {
          const s = SplitText.create(el, { type: "words" });
          targets = s.words;
          s.words.forEach((w, i) => {
            const final = w.textContent ?? "";
            tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.05 }, delay + i * stagger * 1.6);
            tl.to(
              w,
              { duration: duration ?? 0.7, scrambleText: { text: final, chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", speed: 1 }, ease: "none" },
              delay + i * stagger * 1.6,
            );
          });
          break;
        }
        case "build": {
          const s = SplitText.create(el, { type: "words" });
          targets = s.words;
          const ws = s.words as HTMLElement[];
          const oneLine = ws.every((w) => Math.abs(w.offsetTop - ws[0].offsetTop) < 2);
          const per = Math.max(stagger, 0.2);
          if (oneLine && ws.length > 1) {
            const left = ws[0].offsetLeft;
            const full = ws[ws.length - 1].offsetLeft + ws[ws.length - 1].offsetWidth - left;
            // Shift the whole line so the words shown so far sit centered; ease each shift like a camera reframe.
            const shift = (i: number) => (full - (ws[i].offsetLeft + ws[i].offsetWidth - left)) / 2;
            gsap.set(el, { x: shift(0) });
            ws.forEach((w, i) => {
              const t0 = delay + i * per;
              tl.fromTo(w, { opacity: 0, y: size * 0.12, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.3, ease: gsapEase("out") }, t0);
              if (i > 0) tl.to(el, { x: shift(i), duration: 0.42, ease: gsapEase("expo") }, t0 - 0.04);
            });
          } else {
            ws.forEach((w, i) => tl.fromTo(w, { opacity: 0, y: size * 0.1 }, { opacity: 1, y: 0, duration: 0.25, ease: gsapEase("out") }, delay + i * per));
          }
          break;
        }
        case "stream":
        case "pullout": {
          const s = SplitText.create(el, { type: "words" });
          targets = s.words;
          const per = Math.max(stagger, 0.14); // reading pace, not a flourish
          let at = delay;
          if (anim === "pullout" && s.words.length) {
            // Scale the whole line from the first word's center: it fills the frame, then settles into place.
            const w0 = s.words[0] as HTMLElement;
            const ox = w0.offsetLeft + w0.offsetWidth / 2, oy = w0.offsetTop + w0.offsetHeight / 2;
            gsap.set(el, { transformOrigin: `${ox}px ${oy}px` });
            tl.from(el, { scale: 3.4, duration: duration ?? 0.55, ease: gsapEase("expo") }, at);
            tl.from(s.words.slice(1), { opacity: 0, duration: 0.01 }, at);
            at += (duration ?? 0.55) * 0.8;
            s.words.slice(1).forEach((w, i) => {
              tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, at + i * per);
            });
            break;
          }
          const ink = color ?? theme.foreground;
          const tint = accentColor ?? theme.accentText;
          s.words.forEach((w, i) => {
            const t0 = at + i * per;
            tl.fromTo(w, { opacity: 0, y: size * 0.06 }, { opacity: 1, y: 0, duration: 0.18, ease: gsapEase("out") }, t0);
            // Only plain words fade tint → ink; accent words keep their own color.
            if (!(w as HTMLElement).closest("[data-accent]")) {
              tl.fromTo(w, { color: tint }, { color: ink, duration: 0.55, ease: gsapEase("out") }, t0);
            }
          });
          break;
        }
        case "blur": {
          const s = SplitText.create(el, { type: "words" });
          targets = s.words;
          tl.from(s.words, { opacity: 0, filter: "blur(24px)", scale: 1.08, duration: duration ?? 1.1, ease: gsapEase("smooth"), stagger }, delay);
          break;
        }
      }
      if (mark) {
        const path = q(".kt-mark path")[0] as SVGPathElement | undefined;
        if (path) {
          // pathLength=1 on the path: dash units are fractions of the stroke, whatever its rendered size.
          const landed = delay + targets.length * Math.max(stagger, anim === "stream" || anim === "pullout" ? 0.14 : stagger) + 0.35;
          // Hidden until it starts drawing — a round cap on a zero-length dash would show as a dot.
          tl.set(path, { opacity: 1 }, landed);
          tl.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: gsapEase("inOut") }, landed);
        }
      }
      if (exit && targets.length) {
        tl.to(targets, { opacity: 0, y: -size * 0.25, filter: "blur(6px)", duration: 0.35, ease: gsapEase("in"), stagger: 0.02 }, Math.max(delay + 0.5, sceneDur - 0.45));
      }
      // Hold the timeline open to the scene end so seek() never wraps early.
      tl.set({}, {}, sceneDur);
    },
    [text, accent, anim, delay, stagger, duration, ease, size, exit, sceneDur, mark],
    { speed },
  );

  return (
    <div ref={scope} style={{ maxWidth, textAlign: align, ...style }}>
      <div
        className="kt"
        style={{
          fontFamily: font === "display" ? theme.fontDisplay : font === "mono" ? theme.fontMono : theme.fontBody,
          fontSize: size,
          fontWeight: weight,
          lineHeight,
          letterSpacing: `${tracking}em`,
          textTransform: uppercase ? "uppercase" : undefined,
          fontStyle: italic ? "italic" : undefined,
          color: color ?? theme.foreground,
          whiteSpace: "pre-line",
          textWrap: "balance",
        }}
      >
        <Accent text={text} accent={accent} color={accentColor} mark={mark} />
      </div>
    </div>
  );
};

/**
 * Largest font size (≤ max) at which `text` wraps into at most `maxLines`
 * lines of `width` px. Font-agnostic estimate (avg glyph ≈ perChar × size).
 */
/** How much wider the active display font runs than a normal sans (set per video from the style/look). */
let FONT_WIDTH = 1;
export const setFontWidth = (w?: number) => {
  FONT_WIDTH = w && w > 0.5 && w < 2.5 ? w : 1;
};

export function fitSize(text: string, width: number, max: number, min = 36, perChar = 0.52, maxLines = 3) {
  const words = text.replace(/\n/g, " \n ").split(/ +/);
  const fits = (size: number) => {
    const cap = width / (size * perChar * FONT_WIDTH);
    let lines = 1;
    let cur = 0;
    for (const w of words) {
      if (w === "\n") {
        lines++;
        cur = 0;
        continue;
      }
      if (w.length > cap) return false;
      const add = cur === 0 ? w.length : cur + 1 + w.length;
      if (add > cap) {
        lines++;
        cur = w.length;
      } else cur = add;
    }
    return lines <= maxLines;
  };
  for (let size = Math.round(max); size > min; size -= 2) if (fits(size)) return size;
  return Math.round(min);
}
