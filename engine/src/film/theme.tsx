import React, { createContext, useContext } from "react";
import { Img } from "remotion";
import type { BrandT } from "../engine/spec";
import { asset } from "../engine/brandTheme";
import { isDark, mix, readableOn, contrast } from "@/kit/lib/color";
import { progress } from "@/kit/motion";

/** Film palette + type, derived from any brand kit. Light scenes sit on the brand's own
 *  background; "dark" scenes (the pain beats) on a near-black cut from its ink. */
export type FilmTheme = {
  paper: string;
  ink: string;
  muted: string;
  card: string;
  accent: string; // emphasis words on paper
  pop: string; // buttons, highlights (brand primary)
  popInk: string;
  night: string;
  nightInk: string;
  nightMuted: string;
  nightAccent: string;
  display: string;
  body: string;
  mono: string;
  italic: boolean;
  grad: string; // pastel frame for finished-film shots
  brand: BrandT;
};

const stack = (f: string | undefined, fb: string) => (f ? `'${f}', ${fb}` : fb);

export function makeTheme(brand: BrandT): FilmTheme {
  const c = brand.colors;
  const paper = c.background;
  const ink = c.foreground;
  const darkBrand = isDark(paper);
  const night = darkBrand ? mix(paper, "#000000", 0.45) : mix(ink, "#000000", 0.45);
  const pop = c.primary;
  const accent = readableOn(paper, [c.accent, c.primary], ink);
  const soft = (x: string, k: number) => mix(x, "#ffffff", k);
  return {
    paper,
    ink,
    muted: mix(ink, paper, 0.45),
    card: darkBrand ? mix(paper, "#ffffff", 0.08) : (c.card ?? "#ffffff"),
    accent: contrast(accent, paper) >= 2.4 ? accent : ink,
    pop,
    popInk: c.primaryForeground ?? (isDark(pop) ? "#ffffff" : "#0b0b0c"),
    night,
    nightInk: "#eef1ee",
    nightMuted: "#8a938f",
    nightAccent: readableOn(night, [c.primary, c.accent], "#ffffff"),
    display: stack(brand.fonts?.display?.family, "Inter, system-ui, sans-serif"),
    body: stack(brand.fonts?.body?.family, "Inter, system-ui, sans-serif"),
    mono: stack(brand.fonts?.mono?.family, "'JetBrains Mono', ui-monospace, monospace"),
    italic: Boolean((brand as { accentItalic?: boolean }).accentItalic),
    grad: `linear-gradient(135deg, ${soft(pop, 0.62)} 0%, ${soft(c.accent ?? pop, 0.72)} 55%, ${soft(pop, 0.82)} 100%)`,
    brand,
  };
}

const Ctx = createContext<FilmTheme | null>(null);
export const FilmThemeProvider = Ctx.Provider;
export const useFilm = () => {
  const th = useContext(Ctx);
  if (!th) throw new Error("FilmThemeProvider missing");
  return th;
};

/** Mark + wordmark (or the logo image, or the name set in the display face). */
export const Lockup: React.FC<{ t: number; at: number; size: number; onDark?: boolean }> = ({ t, at, size, onDark }) => {
  const th = useFilm();
  const b = th.brand;
  const m = progress(t, at, 0.7, "overshoot");
  const w = progress(t, at + 0.3, 0.6, "expo");
  const color = onDark ? th.nightInk : th.ink;
  const logo = onDark ? b.logoOnDark ?? b.logo : b.logo;
  if (!b.mark && logo)
    return <Img src={asset(logo)!} style={{ height: size, width: "auto", transform: `scale(${m})`, opacity: Math.min(1, m * 2) }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22 }}>
      {b.mark && (
        <div style={{ transform: `scale(${m}) rotate(${(1 - m) * -30}deg)`, opacity: Math.min(1, m * 2) }}>
          <Img src={asset(b.mark)!} style={{ width: size, height: size, borderRadius: size * 0.22 }} />
        </div>
      )}
      <div style={{ overflow: "hidden", paddingRight: 8 }}>
        <div
          style={{
            fontFamily: b.wordmark?.font ? stack(b.wordmark.font.family, th.display) : th.display,
            fontWeight: b.wordmark?.weight ?? 600,
            letterSpacing: `${b.wordmark?.tracking ?? -0.02}em`,
            fontSize: size * 0.95,
            color,
            lineHeight: 1.1,
            transform: `translateX(${(1 - w) * (b.mark ? -size * 1.4 : 0)}px)`,
            opacity: b.mark ? w : m,
          }}
        >
          {b.wordmark?.text ?? b.name}
        </div>
      </div>
    </div>
  );
};
