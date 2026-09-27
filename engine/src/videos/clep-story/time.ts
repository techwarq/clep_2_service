import { voTimeline } from "@/kit/film";
import timeline from "./timeline.json";

export const L = voTimeline(timeline);
export const FPS = timeline.fps;
export const DURATION = (timeline as { duration?: number }).duration ?? 60;
