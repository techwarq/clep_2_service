import { staticFile } from "remotion";
import { KitTheme, defaultTheme } from "@/kit/theme";
import { alpha, inkOn, isDark, mix, readableOn } from "@/kit/lib/color";
import type { BrandT } from "./spec";
import type { StylePreset } from "./styles";

export const asset = (p?: string) => (!p ? undefined : /^(https?:|data:)/.test(p) ? p : staticFile(p));

const stack = (family: string | undefined, fallback: string) =>
  family ? `'${family}', ${fallback}` : fallback;

/**
 * Expand a brand's few real colors into a full KitTheme. If the style forces
 * a mode the brand isn't in (dark keynote for a white-site brand), the brand's
 * primary is kept and the neutrals are re-derived for that mode.
 */
export function brandToTheme(brand: BrandT, style: StylePreset): KitTheme {
  const c = brand.colors;
  const brandMode = brand.mode ?? (isDark(c.background) ? "dark" : "light");
  const mode = style.mode ?? brandMode;
  const flipped = mode !== brandMode;

  const background = flipped ? (mode === "dark" ? "#0A0A0B" : "#F8F8F7") : c.background;
  const foreground = flipped ? (mode === "dark" ? "#F5F5F4" : "#0B0B0C") : c.foreground;
  const dark = mode === "dark";

  return {
    ...defaultTheme,
    mode,
    name: brand.name,
    logo: asset(dark ? brand.logoOnDark ?? brand.logo : brand.logo),
    logoOnDark: asset(brand.logoOnDark ?? brand.logo),
    mark: asset(brand.mark),
    wordmarkText: brand.wordmark?.text,
    fontWordmark: brand.wordmark?.font ? stack(brand.wordmark.font.family, "Inter, system-ui, sans-serif") : undefined,
    wordmarkWeight: brand.wordmark?.weight,
    wordmarkTracking: brand.wordmark?.tracking,
    background,
    bgGradientTo: mix(background, c.primary, dark ? 0.12 : 0.08),
    foreground,
    card: flipped ? (dark ? "#141416" : "#FFFFFF") : c.card ?? (dark ? mix(background, "#ffffff", 0.06) : "#FFFFFF"),
    cardForeground: foreground,
    primary: c.primary,
    primaryForeground: c.primaryForeground ?? inkOn(c.primary),
    secondary: c.secondary && !flipped ? c.secondary : mix(background, foreground, dark ? 0.12 : 0.07),
    secondaryForeground: foreground,
    muted: c.muted && !flipped ? c.muted : mix(background, foreground, dark ? 0.1 : 0.06),
    mutedForeground: mix(foreground, background, 0.45),
    border: alpha(foreground.startsWith("#") ? foreground : "#000000", dark ? 0.12 : 0.09),
    accent: c.accent ?? c.primary,
    accentText: readableOn(background, [c.accent, c.primary], foreground),
    accentItalic: brand.accentItalic ?? brand.fonts?.accent?.italic ?? false,
    displayWeight: numericWeight(brand.fonts?.display?.weight),
    avatarFrom: mix(c.primary, "#ffffff", 0.55),
    avatarTo: c.primary,
    fontDisplay: stack(brand.fonts?.display?.family ?? brand.fonts?.body?.family, "Inter, system-ui, sans-serif"),
    fontBody: stack(brand.fonts?.body?.family, "Inter, system-ui, sans-serif"),
    fontMono: stack(brand.fonts?.mono?.family, "'JetBrains Mono', ui-monospace, Menlo, monospace"),
    fontAccent: brand.fonts?.accent ? stack(brand.fonts.accent.family, "Georgia, serif") : undefined,
    radius: brand.radius ?? 18,
  };
}

const numericWeight = (w?: string | number) => {
  if (w === undefined) return undefined;
  const n = typeof w === "number" ? w : /^\d+$/.test(w.trim()) ? parseInt(w, 10) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Theme variant for a scene's tone. */
export function toneTheme(t: KitTheme, tone: "base" | "inverse" | "primary" = "base"): KitTheme {
  if (tone === "base") return t;
  if (tone === "primary") {
    const fg = t.primaryForeground;
    return {
      ...t,
      base: t.base ?? t,
      background: t.primary,
      bgGradientTo: mix(t.primary, "#000000", 0.18),
      foreground: fg,
      mutedForeground: alpha(fg, 0.7),
      primary: fg,
      primaryForeground: t.primary,
      accent: fg,
      accentText: fg,
      border: alpha(fg, 0.2),
      mode: isDark(t.primary) ? "dark" : "light",
    };
  }
  const dark = t.mode !== "dark";
  const background = dark ? "#0A0A0B" : "#F8F8F7";
  const foreground = dark ? "#F5F5F4" : "#0B0B0C";
  return {
    ...t,
    base: t.base ?? t,
    mode: dark ? "dark" : "light",
    logo: dark ? t.logoOnDark ?? t.logo : t.logo,
    background,
    bgGradientTo: mix(background, t.primary, dark ? 0.12 : 0.08),
    foreground,
    card: dark ? "#141416" : "#FFFFFF",
    cardForeground: foreground,
    secondary: mix(background, foreground, 0.1),
    secondaryForeground: foreground,
    muted: mix(background, foreground, 0.08),
    mutedForeground: mix(foreground, background, 0.45),
    border: alpha(foreground, dark ? 0.12 : 0.09),
    accentText: readableOn(background, [t.accent, t.primary], foreground),
  };
}
