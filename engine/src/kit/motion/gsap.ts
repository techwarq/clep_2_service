import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { EASE_BEZIER } from "./easing";

gsap.registerPlugin(CustomEase, SplitText, DrawSVGPlugin, MorphSVGPlugin, ScrambleTextPlugin);
// GSAP never drives itself here: every timeline is paused and seeked from the
// Remotion frame. Kill the ticker's lag smoothing so nothing depends on wall time.
gsap.ticker.lagSmoothing(0);
for (const [name, [a, b, c, d]] of Object.entries(EASE_BEZIER)) {
  if (name !== "linear") CustomEase.create(`kit.${name}`, `M0,0 C${a},${b} ${c},${d} 1,1`);
}

export { gsap, SplitText };

/**
 * GSAP inside Remotion, frame-exact.
 *
 * `build` runs once per mount inside a gsap.context scoped to the returned
 * ref, receiving a *paused* timeline. On every frame the timeline is seeked to
 * frame/fps (× speed), so GSAP renders are deterministic, scrub-safe in the
 * Studio, and parallel-render safe — GSAP is just an authoring API for
 * keyframes, Remotion still owns time.
 *
 *   const scope = useGsapTimeline<HTMLDivElement>((tl, q) => {
 *     const split = SplitText.create(q(".title"), { type: "chars", mask: "chars" });
 *     tl.from(split.chars, { yPercent: 110, stagger: 0.03, ease: "kit.expo", duration: 0.7 });
 *   });
 *   return <div ref={scope}><h1 className="title">Hello</h1></div>;
 */
export function useGsapTimeline<T extends HTMLElement = HTMLDivElement>(
  build: (tl: gsap.core.Timeline, q: (sel: string) => Element[], root: T) => void,
  deps: unknown[] = [],
  opts: { speed?: number; delayFrames?: number } = {},
) {
  const scope = useRef<T>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { speed = 1, delayFrames = 0 } = opts;

  useLayoutEffect(() => {
    if (!scope.current) return;
    const root = scope.current;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ paused: true });
      build(timeline, gsap.utils.selector(root) as (sel: string) => Element[], root);
      tl.current = timeline;
    }, root);
    // Seek immediately so the first painted frame is already correct.
    tl.current?.seek(Math.max(0, ((frame - delayFrames) / fps) * speed), false);
    return () => {
      tl.current = null;
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useLayoutEffect(() => {
    tl.current?.seek(Math.max(0, ((frame - delayFrames) / fps) * speed), false);
  }, [frame, fps, speed, delayFrames]);

  return scope;
}
