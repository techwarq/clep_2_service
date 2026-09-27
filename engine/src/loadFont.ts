import { loadFont } from "@remotion/google-fonts/Inter";

// Loaded once at module scope so it's ready before any frame renders —
// this is what the old HTML/Playwright engine got wrong (it linked the
// font but never waited for it reliably).
export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
