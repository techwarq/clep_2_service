export type KitTheme = {
  mode: "light" | "dark";
  background: string;
  bgGradientTo?: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string; // gray pill/bubble surfaces
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  /** Second accent for highlights/tags; defaults to primary. */
  accent: string;
  /** Accent color for TEXT — guaranteed readable on `background` (lime primaries aren't). */
  accentText: string;
  /** Render accent words in italic (editorial serif brands). */
  accentItalic: boolean;
  /** Weight the display font actually ships in (e.g. 400 for Instrument Serif) — avoids faux bold. */
  displayWeight?: number;
  /** Brand character/mascot colors (Avatar). */
  avatarFrom: string;
  avatarTo: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  /** Font for accent words (a brand's italic serif, say); undefined = same as the surrounding text. */
  fontAccent?: string;
  /** Base corner radius in px for cards/windows. */
  radius: number;
  /** Brand name + logo (static asset path, already resolved via staticFile). */
  name: string;
  logo?: string;
  logoOnDark?: string;
  /** Square icon mark (resolved asset URL). */
  mark?: string;
  wordmarkText?: string;
  fontWordmark?: string;
  wordmarkWeight?: number;
  /** em */
  wordmarkTracking?: number;
  /** The brand's untoned theme — device screens (phones) keep the real app look on any stage tone. */
  base?: KitTheme;
};

// Neutral fallback so kit components render sensibly even without a brand.
export const defaultTheme: KitTheme = {
  mode: "light",
  background: "#F7F8FA",
  bgGradientTo: "#E3E9F2",
  foreground: "#111111",
  card: "#ffffff",
  cardForeground: "#111111",
  primary: "#3B6FE0",
  primaryForeground: "#ffffff",
  secondary: "#E8E9EB",
  secondaryForeground: "#171717",
  muted: "#E8E9EB",
  mutedForeground: "#8b8f96",
  border: "rgba(0,0,0,.08)",
  accent: "#3B6FE0",
  accentText: "#3B6FE0",
  accentItalic: false,
  avatarFrom: "#EDD4B6",
  avatarTo: "#C9A87E",
  fontDisplay: "Inter, system-ui, sans-serif",
  fontBody: "Inter, system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  radius: 18,
  name: "Brand",
};
