import { KitTheme, defaultTheme } from "@/kit/theme";

// Sampled directly from the real ai.meta.com/muse site recording (not
// guessed) — see legacy/service/assets/muse_ref/.
export const museTheme: KitTheme = {
  ...defaultTheme,
  name: "Muse",
  background: "#F7F8FA",
  bgGradientTo: "#E3E9F2",
  foreground: "#111111",
  primary: "#3B6FE0",
  accent: "#3B6FE0",
  avatarFrom: "#EDD4B6",
  avatarTo: "#C9A87E",
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const CX = WIDTH / 2;
export const CY = HEIGHT / 2;
