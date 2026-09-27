import React from "react";
import { icons, LucideProps } from "lucide-react";
import { Img } from "remotion";
import { useKitTheme } from "../theme/ThemeProvider";
import { alpha, mix } from "../lib/color";

const toPascal = (s: string) =>
  s
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toUpperCase());

/** Any lucide icon by name ("sparkles", "shield-check", "Zap"). Unknown → Sparkles. */
export const Icon: React.FC<{ name?: string } & LucideProps> = ({ name = "sparkles", ...rest }) => {
  const Cmp = (icons as Record<string, React.FC<LucideProps>>)[toPascal(name)] ?? icons.Sparkles;
  return <Cmp strokeWidth={2} {...rest} />;
};

/** Brand logo image if the brand has one, else a generated mark + wordmark. */
export const BrandLogo: React.FC<{ size?: number; wordmark?: boolean; color?: string }> = ({ size = 64, wordmark = true, color }) => {
  const theme = useKitTheme();
  if (theme.logo && !theme.mark) {
    return <Img src={theme.logo} style={{ height: size, width: "auto", objectFit: "contain" }} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <LogoMark size={size} />
      {wordmark && (
        <span
          style={{
            fontFamily: theme.fontWordmark ?? theme.fontDisplay,
            fontWeight: theme.wordmarkWeight ?? theme.displayWeight ?? 800,
            fontSize: size * 0.78,
            letterSpacing: `${theme.wordmarkTracking ?? -0.03}em`,
            lineHeight: 1,
            color: color ?? theme.foreground,
          }}
        >
          {theme.wordmarkText ?? theme.name}
        </span>
      )}
    </div>
  );
};

export const LogoMark: React.FC<{ size?: number; letter?: string }> = ({ size = 64, letter }) => {
  const theme = useKitTheme();
  if (theme.mark && !letter) {
    return <Img src={theme.mark} style={{ width: size, height: size, flex: "none", borderRadius: size * 0.24, display: "block" }} />;
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(145deg, ${mix(theme.primary, "#ffffff", 0.2)}, ${theme.primary})`,
        color: theme.primaryForeground,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.fontDisplay,
        fontWeight: 800,
        fontSize: size * 0.52,
        boxShadow: `0 ${size * 0.2}px ${size * 0.5}px ${alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.35)}`,
        flex: "none",
      }}
    >
      {letter ?? theme.name.slice(0, 1).toUpperCase()}
    </div>
  );
};

export const Pill: React.FC<{
  children: React.ReactNode;
  tone?: "primary" | "muted" | "outline" | "card";
  size?: number;
  icon?: string;
  style?: React.CSSProperties;
}> = ({ children, tone = "muted", size = 20, icon, style }) => {
  const theme = useKitTheme();
  const map = {
    primary: { background: theme.primary, color: theme.primaryForeground, border: "transparent" },
    muted: { background: theme.secondary, color: theme.secondaryForeground, border: "transparent" },
    outline: { background: "transparent", color: theme.foreground, border: theme.border },
    card: { background: theme.card, color: theme.cardForeground, border: theme.border },
  }[tone];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.45,
        padding: `${size * 0.5}px ${size * 0.95}px`,
        borderRadius: 999,
        fontSize: size,
        fontWeight: 600,
        background: map.background,
        color: map.color,
        border: `1px solid ${map.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size * 1.05} />}
      {children}
    </div>
  );
};

/** Split `text` so the `accent` substring renders in the brand accent. */
export const Accent: React.FC<{ text: string; accent?: string; color?: string; mark?: boolean; style?: React.CSSProperties }> = ({
  text,
  accent,
  color,
  mark,
  style,
}) => {
  const theme = useKitTheme();
  if (!accent || !text.includes(accent)) return <>{text}</>;
  const i = text.indexOf(accent);
  return (
    <>
      {text.slice(0, i)}
      <span
        data-accent
        style={{
          position: mark ? "relative" : undefined,
          display: mark ? "inline-block" : undefined,
          color: color ?? theme.accentText,
          fontStyle: theme.accentItalic ? "italic" : undefined,
          // An accent face (serif italic) sets its own weight; faux-bolding it looks wrong.
          ...(theme.fontAccent ? { fontFamily: theme.fontAccent, fontWeight: 400, letterSpacing: "-0.01em" } : {}),
          ...style,
        }}
      >
        {accent}
        {mark && (
          // A marker stroke, not a CSS underline: slightly rising, overshooting both ends (T:0 / Listen).
          <svg className="kt-mark" viewBox="0 0 100 12" preserveAspectRatio="none"
               style={{ position: "absolute", left: "-4%", width: "108%", bottom: "-0.16em", height: "0.24em", overflow: "visible" }}>
            <path d="M1 8.5 C 22 6, 48 5.2, 70 5.6 S 93 4.4, 99 3" fill="none" stroke={color ?? theme.accentText}
                  strokeLinecap="round" strokeWidth={4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} opacity={0} />
          </svg>
        )}
      </span>
      {text.slice(i + accent.length)}
    </>
  );
};

/** Format a count-up value while preserving the target's formatting ("$1,200", "98%", "3.5x"). */
export function formatLike(target: string, value: number) {
  const m = target.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return target;
  const [, pre, num, post] = m;
  const decimals = num.includes(".") ? num.split(".")[1].length : 0;
  const useComma = num.includes(",");
  let s = value.toFixed(decimals);
  if (useComma) s = Number(s).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return pre + s + post;
}
export function numericValue(target: string) {
  const m = target.match(/-?[\d,]*\.?\d+/);
  return m ? parseFloat(m[0].replace(/,/g, "")) : 0;
}
