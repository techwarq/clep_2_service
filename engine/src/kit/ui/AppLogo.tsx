import React from "react";
import { Img } from "remotion";
import { z } from "zod";
import { asset } from "@/engine/brandTheme";
import { useKitTheme } from "../theme/ThemeProvider";
import { mix } from "../lib/color";

/** A real app logo resolved by director/app_logos.py and copied into the project's assets/apps/. */
export const AppLogoRef = z.object({
  src: z.string().describe("Project asset path, e.g. apps/slack.svg"),
  mode: z.enum(["color", "glyph"]).default("color").describe("color = full-color mark on a light tile; glyph = one-color glyph on its brand-color tile"),
  color: z.string().optional().describe("Brand hex for glyph tiles."),
});
export type AppLogoRefT = z.infer<typeof AppLogoRef>;

const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

/**
 * App-icon tile: the way a phone or a Slack sidebar shows a tool. Full-color marks sit on a white tile;
 * one-color glyphs sit white on their brand color; no logo → a neutral letter tile (never a fake mark).
 */
export const AppLogo: React.FC<{ logo?: AppLogoRefT; name?: string; size: number; radius?: number }> = ({ logo, name, size, radius }) => {
  const theme = useKitTheme();
  const r = radius ?? size * 0.24;
  const box: React.CSSProperties = { width: size, height: size, borderRadius: r, flex: "none", display: "grid", placeItems: "center", overflow: "hidden" };
  if (!logo) {
    return (
      <div style={{ ...box, background: theme.secondary, color: theme.mutedForeground, fontFamily: theme.fontBody, fontWeight: 700, fontSize: size * 0.46 }}>
        {(name || "?").trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  const src = asset(logo.src)!;
  if (logo.mode === "glyph") {
    const bg = logo.color ?? theme.foreground;
    const ink = lum(bg) > 0.72 ? "#111111" : "#ffffff";
    const mask = `url("${src}") center / contain no-repeat`;
    return (
      <div style={{ ...box, background: bg }}>
        <div style={{ width: size * 0.58, height: size * 0.58, background: ink, WebkitMask: mask, mask }} />
      </div>
    );
  }
  return (
    <div style={{ ...box, background: "#ffffff", boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.02)}px ${mix("#ffffff", theme.foreground, 0.1)}` }}>
      <Img src={src} style={{ width: size * 0.64, height: size * 0.64, objectFit: "contain" }} />
    </div>
  );
};
