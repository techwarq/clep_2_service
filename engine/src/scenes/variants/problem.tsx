import React from "react";
import { AbsoluteFill } from "remotion";
import { useLayout } from "@/engine/defineScene";
import { useSceneTime, useStyle } from "@/engine/SceneContext";
import { progress, clamp01, lerp, rand } from "@/kit/motion/keyframes";
import { useKitTheme } from "@/kit/theme";
import { alpha, mix } from "@/kit/lib/color";
import { AppLogo, AppLogoRefT } from "@/kit/ui/AppLogo";
import { PhoneFrame } from "@/kit/ui/devices";

/*
 * Ways to show "too many pings" — the pain beat. Each is a different shot, not a re-skin:
 *   scatter    toasts pile up all over the frame, camera pulls back as it gets out of hand
 *   thread     a real team channel scrolling: avatars, names, the same question asked again
 *   ticker     one message at a time, full-frame big type, logo beside it — rapid-fire
 *   lockscreen a phone face-up on the desk: huge clock, notifications stacking under it
 */

export type Ping = { app?: string; title: string; body?: string; logo?: AppLogoRefT };
type VP = { items: Ping[]; caption: string[] };

const Caption: React.FC<{ lines: string[]; at: number; size: number }> = ({ lines, at, size }) => {
  const { t } = useSceneTime();
  const theme = useKitTheme();
  if (!lines.length) return null;
  const k = progress(t, at, 0.5, "expo");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: size,
          fontWeight: theme.displayWeight ?? 700,
          letterSpacing: "-0.03em",
          color: theme.foreground,
          textAlign: "center",
          lineHeight: 1.05,
          opacity: k,
          transform: `scale(${lerp(1.08, 1, k)})`,
          textShadow: `0 0 ${size * 0.6}px ${theme.background}, 0 0 ${size * 0.3}px ${theme.background}`,
        }}
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- scatter */

export const PingScatter: React.FC<VP> = ({ items, caption }) => {
  const { t, dur } = useSceneTime();
  const { width, height, u } = useLayout(1.2);
  const theme = useKitTheme();
  // Repeat the real pings into a pile (the same asks, over and over), each at a seeded spot.
  const n = Math.min(14, Math.max(8, items.length * 4));
  const pile = Array.from({ length: n }, (_, i) => ({ ...items[i % items.length], i }));
  const every = Math.max(0.12, (dur * 0.62) / n);
  const pull = lerp(1.18, 0.92, progress(t, 0, dur * 0.85, "inOut")); // the camera backs away from the mess
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${pull})` }}>
        {pile.map((p) => {
          const at = 0.1 + p.i * every * (1 - p.i / (n * 2.2)); // accelerating
          const k = progress(t, at, 0.28, "overshoot");
          if (t < at) return null;
          const x = rand(p.i * 7.1) * (width * 0.72) + width * 0.04;
          const y = rand(p.i * 3.3 + 1) * (height * 0.74) + height * 0.06;
          const rot = (rand(p.i * 1.9) - 0.5) * 8;
          const w = 470 * u;
          return (
            <div
              key={p.i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                display: "flex",
                gap: 14 * u,
                alignItems: "center",
                padding: `${14 * u}px ${18 * u}px`,
                borderRadius: 18 * u,
                background: theme.card,
                color: theme.cardForeground,
                boxShadow: `0 ${16 * u}px ${40 * u}px ${alpha("#0A0F1E", 0.18)}`,
                opacity: clamp01(k * 1.6),
                transform: `rotate(${rot}deg) scale(${lerp(0.6, 1, k)})`,
                zIndex: p.i,
              }}
            >
              <AppLogo logo={p.logo} name={p.app} size={44 * u} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15 * u, color: theme.mutedForeground, fontWeight: 600 }}>{p.app}</div>
                <div style={{ fontSize: 21 * u, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <Caption lines={caption} at={dur * 0.7} size={120 * u} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- thread */

const initials = (s?: string) => (s || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const PEOPLE = ["Maya", "Dev", "Sam", "Priya", "Jonah", "Lena"];

export const PingThread: React.FC<VP> = ({ items, caption }) => {
  const { t, dur } = useSceneTime();
  const { width, height, u } = useLayout(1.3);
  const theme = useKitTheme();
  const style = useStyle();
  const channel = "team"; // a team channel where everyone's asking — not a channel named after one app
  const rowH = 118 * u;
  const every = Math.max(0.45, (dur * 0.7) / items.length);
  const shown = items.filter((_, i) => t >= 0.35 + i * every).length;
  const scroll = Math.max(0, shown - 3) * rowH; // the thread keeps scrolling as asks pile up
  const colW = Math.min(width * 0.62, 1100 * u);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: colW,
          height: height * 0.7,
          borderRadius: 26 * u,
          background: theme.card,
          boxShadow: `0 ${30 * u}px ${80 * u}px -${30 * u}px ${alpha("#0A0F1E", 0.35)}`,
          overflow: "hidden",
          fontFamily: theme.fontBody,
          color: theme.cardForeground,
          transform: `scale(${lerp(1, 1.04, clamp01(t / Math.max(1, dur)))})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 * u, padding: `${22 * u}px ${30 * u}px`, borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: 26 * u, fontWeight: 700 }}># {channel}</span>
          <span style={{ marginLeft: "auto", fontSize: 18 * u, color: theme.mutedForeground }}>{shown} new</span>
        </div>
        <div style={{ position: "relative", padding: `${16 * u}px ${30 * u}px`, transform: `translateY(${-lerp(0, scroll, progress(t, 0, dur, "smooth"))}px)` }}>
          {items.map((m, i) => {
            const at = 0.35 + i * every;
            const k = progress(t, at, 0.35, "out");
            if (t < at) return null;
            const who = PEOPLE[i % PEOPLE.length];
            return (
              <div key={i} style={{ display: "flex", gap: 18 * u, height: rowH, alignItems: "flex-start", opacity: k, transform: `translateY(${(1 - k) * 20 * u}px)` }}>
                <div
                  style={{
                    width: 58 * u,
                    height: 58 * u,
                    borderRadius: 14 * u,
                    flex: "none",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 22 * u,
                    background: mix(theme.primary, theme.card, 0.35 + 0.1 * (i % 3)),
                    color: theme.primaryForeground,
                  }}
                >
                  {initials(who)}
                </div>
                <div>
                  <div style={{ fontSize: 22 * u, fontWeight: 700 }}>
                    {who}{" "}
                    <span style={{ fontWeight: 400, color: theme.mutedForeground, fontSize: 17 * u, display: "inline-flex", alignItems: "center", gap: 6 * u, verticalAlign: "middle" }}>
                      <AppLogo logo={m.logo} name={m.app} size={20 * u} radius={5 * u} /> via {m.app}
                    </span>
                  </div>
                  <div style={{ fontSize: 30 * u, fontWeight: 450, letterSpacing: `${style.tracking * 0.3}em` }}>{m.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Caption lines={caption} at={dur * 0.72} size={110 * u} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- ticker */

export const PingTicker: React.FC<VP> = ({ items, caption }) => {
  const { t, dur } = useSceneTime();
  const { width, u } = useLayout();
  const theme = useKitTheme();
  const style = useStyle();
  const span = (caption.length ? dur * 0.72 : dur) / items.length;
  const i = Math.min(items.length - 1, Math.floor(t / span));
  const local = t - i * span;
  const m = items[i];
  const inK = progress(local, 0, 0.22, "expo");
  const outK = i < items.length - 1 || caption.length ? progress(local, span - 0.16, 0.16, "in") : 0;
  const size = Math.min(110 * u * style.typeScale, (width * 0.7) / Math.max(8, m.title.length * 0.5));
  const onCaption = caption.length && t >= dur * 0.72;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {!onCaption && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40 * u,
            maxWidth: width * 0.86,
            opacity: inK * (1 - outK),
            transform: `translateY(${(1 - inK) * 60 * u - outK * 60 * u}px)`,
          }}
        >
          <AppLogo logo={m.logo} name={m.app} size={size * 1.1} />
          <div>
            <div style={{ fontFamily: theme.fontBody, fontSize: size * 0.28, fontWeight: 600, color: theme.mutedForeground, letterSpacing: "0.02em" }}>
              {(m.app ?? "").toUpperCase()} · now
            </div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: size, fontWeight: theme.displayWeight ?? style.weight, letterSpacing: `${style.tracking}em`, color: theme.foreground, lineHeight: 1.02 }}>
              {m.title}
            </div>
          </div>
        </div>
      )}
      {/* count ticks up in the corner: how many of these there are */}
      <div style={{ position: "absolute", right: 60 * u, top: 50 * u, fontFamily: theme.fontBody, fontSize: 28 * u, fontWeight: 700, color: theme.accentText, fontVariantNumeric: "tabular-nums" }}>
        {Math.min(99, Math.floor(clamp01(t / (dur * 0.72)) * 23) + 1)} unread
      </div>
      <Caption lines={onCaption ? caption : []} at={dur * 0.72} size={120 * u} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- lockscreen */

export const PingLockscreen: React.FC<VP & { time?: string }> = ({ items, caption, time = "11:48" }) => {
  const { t, dur } = useSceneTime();
  const { width, height, u } = useLayout();
  const theme = useKitTheme();
  const phoneH = height * 0.86;
  const s = phoneH / 1700;
  const tilt = lerp(8, 0, progress(t, 0, 1.2, "expo")); // lands flat as it lights up
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: width * 0.07 }}>
      {caption.length > 0 && (
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 96 * u, fontWeight: theme.displayWeight ?? 700, color: theme.foreground, letterSpacing: "-0.03em", lineHeight: 1.04, maxWidth: width * 0.34, opacity: progress(t, 0.3, 0.6, "expo") }}>
          {caption.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      <div style={{ transform: `perspective(${2000 * u}px) rotateX(${tilt}deg)` }}>
        <PhoneFrame height={phoneH} screenBg={`linear-gradient(180deg, ${mix(theme.primary, "#000000", 0.55)}, #07070a 70%)`}>
          <div style={{ padding: `${150 * s}px ${44 * s}px 0`, color: "#fff", fontFamily: theme.fontBody }}>
            <div style={{ textAlign: "center", fontSize: 38 * s, fontWeight: 500, opacity: 0.85 }}>Tuesday</div>
            <div style={{ textAlign: "center", fontSize: 250 * s, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 60 * s }}>{time}</div>
            {items.map((m, i) => {
              const at = 0.6 + i * Math.max(0.35, (dur * 0.6) / items.length);
              const k = progress(t, at, 0.4, "overshoot");
              if (t < at) return null;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 22 * s,
                    alignItems: "center",
                    padding: `${24 * s}px ${26 * s}px`,
                    marginBottom: 16 * s,
                    borderRadius: 40 * s,
                    background: "rgba(255,255,255,.16)",
                    backdropFilter: "blur(20px)",
                    opacity: clamp01(k * 1.5),
                    transform: `translateY(${(1 - k) * -40 * s}px) scale(${lerp(0.94, 1, k)})`,
                  }}
                >
                  <AppLogo logo={m.logo} name={m.app} size={76 * s} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 26 * s, fontWeight: 600, opacity: 0.8 }}>{m.app}</div>
                    <div style={{ fontSize: 34 * s, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
