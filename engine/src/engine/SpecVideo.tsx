import React, { useMemo, useState } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { Audio } from "@remotion/media";
import { ThemeProvider } from "@/kit/theme";
import { Background, Grain } from "@/kit/components/Background";
import { Overlays, textEffectCss } from "@/kit/components/Overlays";
import type { BackgroundKind } from "@/kit/components/Background";
import { Camera } from "@/kit/motion/Camera";
import { toPresentation, toTiming, type MorphEnds } from "@/kit/motion/transitions";
import type { Anchor } from "./defineScene";
import { setFontWidth } from "@/kit/motion/KineticText";
import { KitTheme } from "@/kit/theme";
import { asset, brandToTheme, toneTheme } from "./brandTheme";
import { loadBrandFonts } from "./fonts";
import { REGISTRY } from "./registry";
import { SceneProvider } from "./SceneContext";
import type { SceneT, VideoSpecT } from "./spec";
import type { StylePreset } from "./styles";
import { buildTimeline } from "./timeline";

const ErrorCard: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <AbsoluteFill style={{ background: "#1a0606", color: "#ffb4b4", padding: 80, fontFamily: "monospace", fontSize: 28, gap: 20 }}>
    <div style={{ fontSize: 44, fontWeight: 700 }}>{title}</div>
    <pre style={{ whiteSpace: "pre-wrap" }}>{detail}</pre>
  </AbsoluteFill>
);

const SceneRenderer: React.FC<{
  scene: SceneT;
  frames: number;
  theme: KitTheme;
  style: StylePreset;
  globalSpeed: number;
  preroll: number;
}> = ({ scene, frames, theme, style, globalSpeed, preroll }) => {
  const { fps } = useVideoConfig();
  const def = REGISTRY[scene.type];
  if (!def) return <ErrorCard title={`Unknown scene type "${scene.type}"`} detail={Object.keys(REGISTRY).join(", ")} />;
  const parsed = def.schema.safeParse(scene.props ?? {});
  if (!parsed.success) return <ErrorCard title={`Bad props for ${scene.type}`} detail={parsed.error.message} />;

  const sceneTheme = toneTheme(theme, scene.tone ?? def.defaultTone ?? "base");
  const bg = scene.background ?? (def.defaultBackground ? { kind: def.defaultBackground as BackgroundKind } : style.background);
  const camera = def.ownCamera && !scene.camera ? { move: "none" as const } : { ...style.camera, ...(scene.camera ?? {}) };
  const Cmp = def.component as React.FC<Record<string, unknown>>;

  return (
    <ThemeProvider theme={sceneTheme}>
      <SceneProvider speed={(scene.speed ?? 1) * globalSpeed} durationInFrames={frames} style={style} preroll={preroll}>
        <AbsoluteFill style={{ background: sceneTheme.background, overflow: "hidden" }}>
          <Background kind={bg.kind as BackgroundKind} src={asset(bg.src)} dim={bg.dim} colors={bg.colors} angle={bg.angle} />
          <Camera camera={camera}>
            <Cmp {...(parsed.data as Record<string, unknown>)} />
          </Camera>
          {scene.sfx?.map((s, i) => (
            <Sequence key={i} from={Math.round(s.at * fps)} layout="none">
              <Audio src={asset(s.src)!} volume={s.volume} />
            </Sequence>
          ))}
        </AbsoluteFill>
      </SceneProvider>
    </ThemeProvider>
  );
};

/**
 * Renders ANY VideoSpec. The only composition the platform needs — every
 * video is data (spec JSON) + assets, never new React code.
 */
/** A scene's container at its first/last frame, from its definition's `anchor` (null if it has none). */
function anchorOf(scene: SceneT, side: "in" | "out", box: { width: number; height: number }): Anchor | null {
  const def = REGISTRY[scene.type];
  if (!def?.anchor) return null;
  const parsed = def.schema.safeParse(scene.props ?? {});
  if (!parsed.success) return null;
  try {
    return (def.anchor(parsed.data, box) ?? {})[side] ?? null;
  } catch {
    return null;
  }
}

/** Morph endpoints between two scenes. A side without a container grows from / shrinks to a centered pill. */
function morphEnds(a: SceneT, b: SceneT, box: { width: number; height: number }, theme: KitTheme): MorphEnds | undefined {
  const from = anchorOf(a, "out", box);
  const to = anchorOf(b, "in", box);
  if (!from && !to) return undefined;
  const u = Math.min(box.width, box.height) / 1080;
  const pill: Anchor = { x: box.width / 2 - 170 * u, y: box.height / 2 - 44 * u, w: 340 * u, h: 88 * u, r: 44 * u, fill: (to ?? from)!.fill };
  const color = (f: Anchor["fill"]) =>
    f === "ink" ? theme.foreground : f === "dark" ? "#0c0d0f" : f === "primary" ? theme.primary : f === "outline" ? "transparent" : theme.card;
  const rect = (x: Anchor) => ({ x: x.x, y: x.y, w: x.w, h: x.h, r: x.r, fill: color(x.fill) });
  return { from: rect(from ?? pill), to: rect(to ?? pill), background: theme.background, border: theme.border };
}

export const SpecVideo: React.FC<VideoSpecT> = (spec) => {
  const { fps, width, height } = useVideoConfig();
  const { entries, style } = useMemo(() => buildTimeline(spec, fps), [spec, fps]);
  const theme = useMemo(() => brandToTheme(spec.brand, style), [spec.brand, style]);
  setFontWidth(style.fontWidth); // before any scene sizes its text
  useState(() => loadBrandFonts(spec.brand));
  const grain = spec.grain ?? style.grain;
  const effectCss = useMemo(
    () => textEffectCss(style.textEffect, theme.fontDisplay, { fg: theme.foreground, primary: theme.primary, accent: theme.accent, bg: theme.background }),
    [style.textEffect, theme],
  );

  const audio = spec.audio;
  const voiceFrames = audio?.voiceover ? 1 : 0;

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{ background: theme.background }}>
        {effectCss && <style>{effectCss}</style>}
        <TransitionSeries>
          {entries.flatMap((e) => {
            const nodes = [
              <TransitionSeries.Sequence key={`s${e.index}`} durationInFrames={e.frames} name={e.scene.id ?? `${e.index}:${e.scene.type}`}>
                <SceneRenderer
                  scene={e.scene}
                  frames={e.frames}
                  theme={theme}
                  style={style}
                  globalSpeed={spec.speed ?? 1}
                  preroll={Math.round((entries[e.index - 1]?.transition.frames ?? 0) * 0.5)}
                />
              </TransitionSeries.Sequence>,
            ];
            if (e.transition.frames > 0) {
              nodes.push(
                <TransitionSeries.Transition
                  key={`t${e.index}`}
                  presentation={toPresentation(
                    e.transition,
                    { width, height },
                    { primary: theme.primary, accent: theme.accent, background: theme.background, foreground: theme.foreground },
                    e.transition.type === "morph" && entries[e.index + 1]
                      ? morphEnds(e.scene, entries[e.index + 1].scene, { width, height }, theme)
                      : undefined,
                  )}
                  timing={toTiming({ ...e.transition, duration: e.transition.frames / fps }, fps)}
                />,
              );
            }
            return nodes;
          })}
        </TransitionSeries>
        <Overlays kinds={style.overlays} />
        {grain > 0 && <Grain opacity={grain} />}
        {audio?.voiceover && <Audio src={asset(audio.voiceover)!} volume={audio.voiceVolume} />}
        {audio?.music && (
          <Audio
            src={asset(audio.music)!}
            loop
            volume={(f) => {
              const base = audio.musicVolume ?? 0.25;
              const fadeIn = Math.min(1, f / (fps * 0.8));
              return base * fadeIn * (voiceFrames && audio.duck ? 0.55 : 1);
            }}
          />
        )}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
