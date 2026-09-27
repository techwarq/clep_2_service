/**
 * Voice-timed films: a timeline.json (see director/film.py) gives every narration
 * line's start/end and phrase onsets. Scenes are placed relative to lines, so a
 * re-voiced script re-times the picture.
 *
 *   const L = voTimeline(timeline);
 *   L("intro").start, L("intro").end, L("intro").words[2]
 */
export type VoLine = { id: string; start: number; end: number; text: string; words: number[] };

export function voTimeline(tl: { vo?: { id?: string; start: number; end?: number; text: string; words?: number[] }[] }) {
  const map = new Map<string, VoLine>();
  for (const v of tl.vo ?? []) {
    if (!v.id) continue;
    map.set(v.id, { id: v.id, start: v.start, end: v.end ?? v.start, text: v.text, words: v.words ?? [v.start] });
  }
  return (id: string): VoLine => {
    const l = map.get(id);
    if (!l) throw new Error(`timeline has no vo line "${id}" — run: motion.py film <video> voice`);
    return l;
  };
}
