import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/PublicSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import timeline from "./timeline.json";

// clep.abstraklabs.com, animated: grey paper, Instrument Serif with italic
// green accents, lime pills, IBM Plex Mono for commands.
const serif = loadSerif("normal", { subsets: ["latin"] }).fontFamily;
loadSerif("italic", { subsets: ["latin"] });
const sans = loadSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
const poppins = loadPoppins("normal", { weights: ["600"], subsets: ["latin"] }).fontFamily;

export const F = { serif, sans, mono, poppins };

export const C = {
  paper: "#ebebeb",
  ink: "#0d1412",
  night: "#0b100e",
  lime: "#c8f542",
  limeInk: "#101505",
  green: "#4d7c0f",
  muted: "#5f6763",
  card: "#ffffff",
  red: "#ff4d3d",
  indigo: "#4f46e5",
};

export const FPS = timeline.fps;
export const DURATION = timeline.duration;
export const B = timeline.beats;
export const W = 1920;
export const H = 1080;
