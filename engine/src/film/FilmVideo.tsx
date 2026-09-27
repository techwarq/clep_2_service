import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, CalculateMetadataFunction } from "remotion";
import { progress } from "@/kit/motion";
import { Grain, Vignette } from "@/kit/ui/promo";
import type { BrandT } from "../engine/spec";
import { loadBrandFonts } from "../engine/fonts";
import { makeTheme, FilmThemeProvider, FilmTheme } from "./theme";
import { BEATS, Beat } from "./beats";

/**
 * A chat-made launch film. director/filmspec.py writes the props: every beat's
 * window, voice line and event times are already computed, so this only draws.
 */
export type FilmProps = { brand: BrandT; fps: number; width: number; height: number; duration: number; beats: Beat[] };

export const calculateFilmMetadata: CalculateMetadataFunction<FilmProps> = ({ props }) => ({
  fps: props.fps || 60,
  width: props.width || 1920,
  height: props.height || 1080,
  durationInFrames: Math.max(1, Math.round((props.duration || 10) * (props.fps || 60))),
});

const FADE = 0.4;

const Ground: React.FC<{ th: FilmTheme; dark: boolean }> = ({ th, dark }) =>
  dark ? (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at 50% 40%, ${th.night}, #050706 80%)` }} />
  ) : (
    <AbsoluteFill style={{ background: `radial-gradient(900px 600px at 8% 0%, ${th.pop}33, ${th.pop}00 70%), radial-gradient(900px 700px at 100% 8%, ${th.accent}1f, ${th.accent}00 70%), ${th.paper}` }} />
  );

export const FilmVideo: React.FC<FilmProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  loadBrandFonts(props.brand);
  const th = makeTheme(props.brand);
  const beats = props.beats;
  return (
    <FilmThemeProvider value={th}>
      <AbsoluteFill style={{ background: th.paper }}>
        {beats.map((b, i) => {
          if (t < b.start - FADE || t > b.end + FADE) return null;
          const Comp = BEATS[b.kind];
          if (!Comp) return null;
          const prev = beats[i - 1];
          const iris = prev && prev.dark !== b.dark;
          const inK = i === 0 ? progress(t, 0, 0.6, "smooth") : progress(t, b.start - FADE, FADE * 2, iris ? "expoInOut" : "smooth");
          const outK = i === beats.length - 1 ? 0 : progress(t, b.end - FADE, FADE * 2, "smooth");
          const next = beats[i + 1];
          const nextIris = next && next.dark !== b.dark;
          const push = 1 + 0.025 * ((t - b.start) / Math.max(1, b.end - b.start));
          const style: React.CSSProperties = iris
            ? { clipPath: inK >= 1 ? undefined : `circle(${inK * 2300}px at 50% 50%)`, zIndex: i }
            : { opacity: inK, zIndex: i };
          const fadeOut = nextIris ? 0 : outK;
          return (
            <AbsoluteFill key={i} style={style}>
              <Ground th={th} dark={b.dark} />
              <AbsoluteFill style={{ transform: `scale(${push + fadeOut * 0.03})`, filter: fadeOut > 0.02 ? `blur(${fadeOut * 8}px)` : undefined }}>
                <Comp t={t} b={b} />
              </AbsoluteFill>
            </AbsoluteFill>
          );
        })}
        <Vignette k={0.35} />
        <Grain frame={frame} opacity={0.04} />
      </AbsoluteFill>
    </FilmThemeProvider>
  );
};
