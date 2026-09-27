/** Tiny color math so a brand's 2–4 real colors can expand into a full UI palette. */

export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Mix a toward b by t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number) {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

export function alpha(hex: string, a: number) {
  if (!hex.startsWith("#")) return hex;
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function luminance(hex: string) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** First candidate readable on `bg` (≥ 3:1, large-text AA), else a mix toward `fallback`. */
export function readableOn(bg: string, candidates: (string | undefined)[], fallback: string) {
  for (const c of candidates) if (c && c.startsWith("#") && contrast(c, bg) >= 3) return c;
  const first = candidates.find((c) => c && c.startsWith("#"));
  if (first) for (let t = 0.2; t <= 0.8; t += 0.1) { const m = mix(first, fallback, t); if (contrast(m, bg) >= 3) return m; }
  return fallback;
}

export const isDark = (hex: string) => luminance(hex) < 0.2;

/** Readable ink for text sitting on `bg`. */
export const inkOn = (bg: string, dark = "#0B0B0C", light = "#FFFFFF") => (luminance(bg) > 0.45 ? dark : light);
