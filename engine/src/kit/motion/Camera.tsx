import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { ease as easeFn, EaseName } from "./easing";
import { clamp01, lerp } from "./keyframes";
import type { CameraT } from "@/engine/spec";
import { useScene } from "@/engine/SceneContext";

const DEFAULT_AMOUNT: Record<string, number> = {
  push_in: 0.06,
  pull_out: 0.08,
  drift: 0.025,
  pan_left: 0.04,
  pan_right: 0.04,
  tilt_up: 0.04,
  tilt_down: 0.04,
  punch_in: 0.08,
  dutch: 2.5,
};

type CamState = { zoom: number; fx: number; fy: number; rot: number; tx: number; ty: number };

function presetState(cam: Partial<CameraT>, t: number, dur: number): CamState {
  const move = cam.move ?? "none";
  const amount = cam.amount ?? DEFAULT_AMOUNT[move] ?? 0;
  const [fx, fy] = cam.focus ?? [0.5, 0.5];
  const e = easeFn((cam.ease as EaseName) ?? "smooth");
  const p = e(clamp01(t / Math.max(0.001, dur)));
  const s: CamState = { zoom: 1, fx, fy, rot: 0, tx: 0, ty: 0 };
  switch (move) {
    case "push_in":
      s.zoom = 1 + amount * p;
      break;
    case "pull_out":
      s.zoom = 1 + amount * (1 - p);
      break;
    case "drift":
      s.zoom = 1 + amount * p;
      s.tx = -amount * 0.5 * p;
      break;
    case "pan_left":
      s.zoom = 1 + amount;
      s.tx = amount * (0.5 - p);
      break;
    case "pan_right":
      s.zoom = 1 + amount;
      s.tx = -amount * (0.5 - p);
      break;
    case "tilt_up":
      s.zoom = 1 + amount;
      s.ty = amount * (0.5 - p);
      break;
    case "tilt_down":
      s.zoom = 1 + amount;
      s.ty = -amount * (0.5 - p);
      break;
    case "punch_in": {
      // Beat-synced snap: hard zoom in over ~0.22s, then a slow creep.
      const snap = easeFn("snappy")(clamp01(t / 0.22));
      s.zoom = 1 + amount * snap + amount * 0.25 * p;
      break;
    }
    case "dutch":
      s.rot = amount * (1 - p) - amount * 0.3;
      s.zoom = 1.04;
      break;
  }
  return s;
}

function keyedState(cam: Partial<CameraT>, t: number): CamState {
  const keys = [...(cam.keys ?? [])].sort((a, b) => a.at - b.at);
  const first = { at: 0, zoom: 1, focus: [0.5, 0.5] as [number, number], rotate: 0, ease: "smooth" as EaseName };
  const all = keys.length && keys[0].at <= 0 ? keys : [first, ...keys];
  let a = all[0];
  let b = all[all.length - 1];
  for (let i = 1; i < all.length; i++) {
    if (t <= all[i].at) {
      a = all[i - 1];
      b = all[i];
      break;
    }
    a = all[i];
    b = all[i];
  }
  const span = Math.max(0.0001, b.at - a.at);
  const p = a === b ? 1 : easeFn((b.ease as EaseName) ?? "smooth")(clamp01((t - a.at) / span));
  const fa = a.focus ?? [0.5, 0.5];
  const fb = b.focus ?? [0.5, 0.5];
  return {
    zoom: lerp(a.zoom ?? 1, b.zoom ?? 1, p),
    fx: lerp(fa[0], fb[0], p),
    fy: lerp(fa[1], fb[1], p),
    rot: lerp(a.rotate ?? 0, b.rotate ?? 0, p),
    tx: 0,
    ty: 0,
  };
}

/**
 * Virtual camera over a scene's content. Preset moves (push_in, punch_in,
 * pan…) or explicit keyframes that zoom to a focus point and bring it toward
 * frame center — "push in on the button" = keys: [{at: 1.2, zoom: 1.8, focus: [0.62, 0.58]}].
 */
export const Camera: React.FC<{ camera?: Partial<CameraT>; children: React.ReactNode }> = ({ camera, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // Scene length, not the composition's — useVideoConfig() inside a series reports the whole video.
  const { durationInFrames } = useScene();
  const cam = camera ?? {};
  const speed = cam.speed ?? 1;
  const t = (frame / fps) * speed;
  const dur = durationInFrames / fps;

  const s = cam.keys?.length ? keyedState(cam, t) : presetState(cam, t, dur);
  // Pull the focus point toward center as we zoom (fully centered by ~1.5x).
  const c = clamp01((s.zoom - 1) * 2) * (cam.keys?.length ? 1 : 0.35);
  const dx = (0.5 - s.fx) * width * c + s.tx * width;
  const dy = (0.5 - s.fy) * height * c + s.ty * height;

  let shx = 0;
  let shy = 0;
  if (cam.shake) {
    const k = frame / fps;
    shx = (Math.sin(k * 7.1) + Math.sin(k * 13.7 + 1.3) * 0.5) * cam.shake;
    shy = (Math.sin(k * 8.3 + 2.1) + Math.sin(k * 11.9) * 0.5) * cam.shake;
  }

  const content = (
    <AbsoluteFill
      style={{
        transformOrigin: `${s.fx * 100}% ${s.fy * 100}%`,
        transform: `translate(${dx + shx}px, ${dy + shy}px) rotate(${s.rot}deg) scale(${s.zoom})`,
        willChange: "transform",
      }}
    >
      {children}
    </AbsoluteFill>
  );

  if (!cam.motionBlur) return content;
  return (
    <CameraMotionBlur shutterAngle={180} samples={6}>
      {content}
    </CameraMotionBlur>
  );
};
