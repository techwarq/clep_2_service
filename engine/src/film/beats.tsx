import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { progress, clamp01, kf, lerp } from "@/kit/motion";
import { Words, Word, Scribble, DotField, Flare, NamedCursor, cursorAt, Check, Spinner, ChatComposer, AgentStep, BrowserFrame } from "@/kit/ui/promo";
import { asset } from "../engine/brandTheme";
import { useFilm, Lockup, FilmTheme } from "./theme";
import { AppWindow, AppFields, AppTimes } from "./app";

export type VO = { text: string; start: number; end: number; words: number[] };
export type Beat = { kind: string; start: number; end: number; dark: boolean; vo: VO; ev: Record<string, any>; [k: string]: any };
type P = { t: number; b: Beat };

// ── text ──────────────────────────────────────────────────────────────────
/** "Your code *already knows* `/clep`" → words; *…* = accent, `…` = mono pill. */
export function parse(text: string): Word[] {
  const out: Word[] = [];
  let accent = false;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let w = raw;
    const open = w.startsWith("*");
    if (open) {
      accent = true;
      w = w.slice(1);
    }
    const close = /\*[.,!?:;]*$/.test(w) || /[.,!?:;]\*$/.test(w);
    const isAccent = accent;
    if (close) {
      w = w.replace(/\*([.,!?:;]*)$/, "$1").replace(/\*$/, "");
      accent = false;
    }
    if (/^`.*`[.,!?]*$/.test(w)) out.push({ w: w.replace(/`/g, ""), mono: true });
    else out.push(isAccent ? { w, accent: true } : w);
  }
  return out;
}

const plain = (text: string) => text.replace(/[*`]/g, "");
export const fit = (text: string, max: number, width = 1640, k = 0.48) => Math.max(64, Math.min(max, width / (Math.max(8, plain(text).length) * k)));

const Head: React.FC<{ t: number; at: number; text: string; size: number; dark?: boolean; y: number; dur?: number; stagger?: number }> = ({ t, at, text, size, dark, y, dur = 0.7, stagger = 0.08 }) => {
  const th = useFilm();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", transform: "translateY(-50%)" }}>
      <Words
        t={t}
        at={at}
        words={parse(text)}
        size={size}
        font={th.display}
        accentFont={th.display}
        monoFont={th.mono}
        color={dark ? th.nightInk : th.ink}
        accentColor={dark ? th.nightAccent : th.accent}
        monoBg={dark ? th.nightAccent : th.ink}
        monoColor={dark ? th.night : th.pop}
        dur={dur}
        stagger={stagger}
        italicAccent={th.italic}
      />
    </div>
  );
};

/** Lines of a headline, each landing on the voice's phrase onsets. */
const Lines: React.FC<{ t: number; b: Beat; text: string; y: number; max?: number; dark?: boolean; gap?: number }> = ({ t, b, text, y, max = 150, dark, gap }) => {
  const lines = text.split(/\s*\\n\s*|\n/).filter(Boolean);
  const size = Math.min(...lines.map((l) => fit(l, max)));
  const lh = gap ?? size * 1.08;
  return (
    <>
      {lines.map((l, i) => (
        <Head key={i} t={t} at={b.vo.words[i] ?? b.vo.start + i * 0.9} text={l} size={size} dark={dark} y={y + (i - (lines.length - 1) / 2) * lh} />
      ))}
    </>
  );
};

const card = (th: FilmTheme): React.CSSProperties => ({ background: th.card, borderRadius: 26, boxShadow: "0 40px 90px rgba(10,20,15,.14), 0 0 0 1px rgba(10,20,15,.06)" });

// ── headline ──────────────────────────────────────────────────────────────
export const Headline: React.FC<P> = ({ t, b }) => <Lines t={t} b={b} text={b.text} y={540} max={170} dark={b.dark} />;

// ── shipped: a success card the cursor completes ──────────────────────────
export const Shipped: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const click = b.ev.click;
  const cardIn = progress(t, b.start + 0.1, 0.8, "expo");
  const done = t >= click;
  const mk = progress(t, click, 0.45, "overshoot");
  const cur = cursorAt([{ t: b.start + 0.3, x: 1780, y: 1040 }, { t: click, x: 1300, y: 612, click: true }, { t: b.end, x: 1420, y: 720 }], t);
  const ok = "#1f883d";
  const merged = "#8250df";
  return (
    <>
      <Head t={t} at={b.vo.start} text={b.text} size={fit(b.text, 160)} y={330} dark={b.dark} />
      <div style={{ ...card(th), position: "absolute", left: 460, top: 500, width: 1000, height: 210, opacity: cardIn, transform: `translateY(${(1 - cardIn) * 90}px) scale(${0.92 + cardIn * 0.08})`, fontFamily: th.body }}>
        <div style={{ position: "absolute", left: 36, top: 40, width: 60, height: 60, borderRadius: "50%", background: done ? merged : ok, display: "grid", placeItems: "center", transform: `scale(${done ? 0.8 + mk * 0.2 : 1})` }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
            <circle cx={6} cy={5} r={2.2} />
            <circle cx={6} cy={19} r={2.2} />
            <circle cx={18} cy={12} r={2.2} />
            <path d="M6 7.5 V16.5 M6 7.5 C6 12 12 12 15.8 12" />
          </svg>
        </div>
        <div style={{ position: "absolute", left: 120, top: 36, fontSize: 34, fontWeight: 700, color: "#0d1412", whiteSpace: "nowrap" }}>{b.title}</div>
        <div style={{ position: "absolute", left: 120, top: 92, fontSize: 23, color: "#5f6763" }}>{b.sub}</div>
        <div style={{ position: "absolute", left: 120, top: 140, fontSize: 21, color: ok, display: "flex", gap: 10, alignItems: "center" }}>
          <Check k={1} size={24} bg={ok} fg="#fff" /> All checks passed
        </div>
        <div style={{ position: "absolute", right: 36, top: 73, minWidth: 250, padding: "0 20px", height: 64, borderRadius: 14, background: done ? merged : ok, color: "#fff", fontSize: 24, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transform: `scale(${cur.pressed ? 0.95 : done ? 0.9 + mk * 0.1 : 1})` }}>
          {done ? (
            <>
              <Check k={progress(t, click + 0.05, 0.35)} size={28} bg="rgba(255,255,255,.25)" fg="#fff" /> {b.done}
            </>
          ) : (
            b.button
          )}
        </div>
      </div>
      <NamedCursor {...cur} opacity={progress(t, b.start + 0.3, 0.3)} />
    </>
  );
};

// ── checklist: the one thing left undone ──────────────────────────────────
export const Checklist: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const inK = progress(t, b.start + 0.3, 0.8, "expo");
  const lines: string[] = b.text.split(/\s*\\n\s*|\n/).filter(Boolean);
  const items: { text: string; done: boolean }[] = b.items;
  const undone = items.findIndex((i) => !i.done);
  let di = 0;
  const top = lines.length > 1 ? 560 : 470;
  return (
    <>
      <Lines t={t} b={b} text={b.text} y={lines.length > 1 ? 270 : 260} max={140} dark={b.dark} />
      <div style={{ ...card(th), position: "absolute", left: 550, top, width: 820, padding: "30px 40px 26px", opacity: inK, transform: `translateY(${(1 - inK) * 110}px) rotate(${(1 - inK) * 3}deg)`, fontFamily: th.body }}>
        <div style={{ fontFamily: th.mono, fontSize: 20, letterSpacing: "0.12em", color: "#8a918d", marginBottom: 14 }}>CHECKLIST</div>
        {items.map((row, i) => {
          const at = row.done ? b.ev.checks?.[di++] ?? b.start + 0.8 : undefined;
          const dk = at !== undefined ? progress(t, at, 0.3, "out") : 0;
          const hot = i === undone;
          const wig = hot ? Math.sin(t * 38) * 4 * clamp01(1 - Math.abs(t - (b.ev.circle + 0.2)) / 0.3) : 0;
          return (
            <div key={i} style={{ position: "relative", height: 72, display: "flex", alignItems: "center", gap: 22, borderTop: i ? "1px solid rgba(10,20,15,.07)" : undefined }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, border: `2.5px solid ${dk > 0 ? "#0d1412" : "#b7bdb9"}`, background: dk > 0 ? "#0d1412" : "transparent", display: "grid", placeItems: "center", transform: `rotate(${wig}deg)` }}>
                {dk > 0 && (
                  <svg width={22} height={22} viewBox="0 0 24 24">
                    <path d="M5 12.5 L10 17 L19 7" fill="none" stroke={th.pop} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - dk} />
                  </svg>
                )}
              </div>
              <div style={{ position: "relative", fontSize: 32, fontWeight: hot ? 700 : 500, color: dk > 0 ? "#9aa19d" : "#0d1412", whiteSpace: "nowrap" }}>
                {row.text}
                {dk > 0 && <span style={{ position: "absolute", left: 0, top: "52%", height: 2.5, width: `${dk * 100}%`, background: "#9aa19d" }} />}
                {hot && (
                  <div style={{ position: "absolute", left: -84, top: -24 }}>
                    <Scribble t={t} at={b.ev.circle} w={row.text.length * 17 + 170} h={96} color={th.accent} kind="circle" dur={0.6} stroke={5} />
                  </div>
                )}
              </div>
              {hot && b.tag && (
                <div style={{ marginLeft: "auto", fontFamily: th.mono, fontSize: 18, color: "#b3261e", background: "#fde8e6", borderRadius: 999, padding: "6px 14px", opacity: progress(t, b.ev.circle + 0.35, 0.3), whiteSpace: "nowrap" }}>{b.tag}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ── grind: a list of chores, one per beat ─────────────────────────────────
const RED = "#ff4d3d";
function microKind(w: string, i: number) {
  const s = w.toLowerCase();
  if (/rec|film|captur|shoot/.test(s)) return 0;
  if (/retak|redo|again|take/.test(s)) return 1;
  if (/zoom|focus/.test(s)) return 2;
  if (/crop|trim|cut|edit/.test(s)) return 3;
  if (/export|render|upload|publish|share/.test(s)) return 4;
  return i % 5;
}

export const Grind: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const times: number[] = b.ev.words;
  const words: string[] = b.words;
  const idx = times.reduce((acc, at, i) => (t >= at ? i : acc), -1);
  return (
    <>
      {idx < 0 && b.text && <Head t={t} at={b.vo.start} text={b.text} size={fit(b.text, 140)} y={400} dark />}
      {idx < 0 && b.text && <EditorMock t={t} at={b.start + 0.3} />}
      {idx >= 0 && <GrindWord t={t} at={times[idx]} word={words[idx]} kind={microKind(words[idx], idx)} />}
      {idx >= 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, display: "flex", justifyContent: "center", gap: 18 }}>
          {words.map((w, i) => (
            <div key={i} style={{ fontFamily: th.mono, fontSize: 22, letterSpacing: "0.08em", padding: "10px 20px", borderRadius: 999, color: i === idx ? th.night : i < idx ? "#7d8782" : "#3b4541", background: i === idx ? th.nightAccent : "rgba(255,255,255,.05)" }}>
              {w.replace(/[.!]/g, "").toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const EditorMock: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const th = useFilm();
  const k = progress(t, at, 0.7, "expo");
  const ph = 0.5 + 0.42 * Math.sin((t - at) * 2.6);
  return (
    <div style={{ position: "absolute", left: 360, top: 540, width: 1200, height: 380, borderRadius: 24, background: "#141b18", boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 50px 120px rgba(0,0,0,.5)", opacity: k, transform: `translateY(${(1 - k) * 80}px)`, overflow: "hidden" }}>
      <div style={{ height: 50, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.06)", fontFamily: th.mono, fontSize: 18, color: "#9aa39e" }}>
        <span style={{ width: 13, height: 13, borderRadius: "50%", background: RED, opacity: Math.floor(t * 3) % 2 ? 1 : 0.35 }} /> REC
        <span style={{ marginLeft: "auto" }}>demo_final_v7_REAL.mov</span>
      </div>
      {[0, 1, 2].map((r) => (
        <div key={r} style={{ position: "absolute", left: 36, top: 90 + r * 80, width: 1128, height: 56, borderRadius: 8, background: "rgba(255,255,255,.03)" }}>
          {[0, 1, 2, 3, 4].map((c) => (
            <div key={c} style={{ position: "absolute", left: `${((c * 23 + r * 11) % 90) + 2}%`, width: `${8 + ((c * 7 + r * 5) % 12)}%`, top: 6, bottom: 6, borderRadius: 6, background: ["#3d6b52", "#4a4f7a", "#6b5a3a"][r] }} />
          ))}
        </div>
      ))}
      <div style={{ position: "absolute", left: 36 + ph * 1128, top: 70, width: 3, height: 280, background: th.nightAccent }} />
    </div>
  );
};

const GrindWord: React.FC<{ t: number; at: number; word: string; kind: number }> = ({ t, at, word, kind }) => {
  const th = useFilm();
  const lt = t - at;
  const s = kf(lt, [[0, 1.25], [0.22, 0.97, "expo"], [0.4, 1, "easy"]]);
  const blur = Math.max(0, 1 - lt / 0.14) * 16;
  const size = Math.min(300, 1000 / (word.length * 0.5));
  return (
    <>
      <div style={{ position: "absolute", left: 230, top: 540, transform: `translateY(-55%) scale(${s})`, transformOrigin: "left center", filter: blur ? `blur(${blur}px)` : undefined, fontFamily: th.display, fontSize: size, color: th.nightInk, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>{word}</div>
      <div style={{ position: "absolute", left: 1170, top: 280, width: 520, height: 440, transform: `scale(${s})` }}>
        <Micro t={t} lt={lt} kind={kind} />
      </div>
    </>
  );
};

const Micro: React.FC<{ t: number; lt: number; kind: number }> = ({ t, lt, kind }) => {
  const th = useFilm();
  const A = th.nightAccent;
  const panel: React.CSSProperties = { position: "absolute", inset: 0, borderRadius: 28, background: "#141b18", boxShadow: "0 0 0 1px rgba(255,255,255,.08)", overflow: "hidden" };
  const center = (x: number, y: number, el: React.ReactNode) => <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)" }}>{el}</div>;
  if (kind === 0) {
    const ring = (lt * 1.6) % 1;
    return (
      <div style={panel}>
        {center(260, 190, <div style={{ position: "relative", width: 170, height: 170 }}><div style={{ position: "absolute", inset: -ring * 60, borderRadius: "50%", border: `3px solid ${RED}`, opacity: 1 - ring }} /><div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: RED, boxShadow: `0 0 60px ${RED}88` }} /></div>)}
        {center(260, 350, <div style={{ fontFamily: th.mono, fontSize: 34, color: th.nightInk }}>REC 00:00:{String(Math.floor(lt * 9) % 60).padStart(2, "0")}</div>)}
      </div>
    );
  }
  if (kind === 1) {
    const n = 4 + Math.min(4, Math.floor(lt / 0.16));
    return (
      <div style={panel}>
        {center(260, 150, <div style={{ fontFamily: th.mono, fontSize: 26, letterSpacing: "0.2em", color: "#7d8782" }}>TAKE</div>)}
        {center(260, 270, <div style={{ fontFamily: th.mono, fontSize: 190, color: A, lineHeight: 1 }}>{String(n).padStart(2, "0")}</div>)}
      </div>
    );
  }
  if (kind === 2) {
    const z = progress(lt, 0.05, 0.6, "expo");
    return (
      <div style={panel}>
        <div style={{ position: "absolute", inset: 30, borderRadius: 16, background: "#e9ece9", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + z * 1.2})`, transformOrigin: "30% 72%" }}>
            <div style={{ position: "absolute", left: 30, top: 30, width: 260, height: 22, borderRadius: 7, background: "#cfd4d0" }} />
            <div style={{ position: "absolute", left: 30, top: 80, width: 400, height: 60, borderRadius: 12, background: "#fff" }} />
            <div style={{ position: "absolute", left: 30, top: 170, width: 190, height: 54, borderRadius: 12, background: "#4f46e5" }} />
            <div style={{ position: "absolute", left: 30, top: 260, width: 400, height: 90, borderRadius: 12, background: "#dfe3df" }} />
          </div>
        </div>
        <div style={{ position: "absolute", right: 40, bottom: 36, fontFamily: th.mono, fontSize: 28, color: th.night, background: A, borderRadius: 10, padding: "4px 14px" }}>{Math.round(100 + z * 120)}%</div>
      </div>
    );
  }
  if (kind === 3) {
    const c = progress(lt, 0.05, 0.5, "expo");
    const ins = 40 + c * 70;
    const L = (x: number, y: number, r: number) => <div style={{ position: "absolute", left: x - 4, top: y - 4, width: 46, height: 46, borderLeft: `8px solid ${A}`, borderTop: `8px solid ${A}`, transform: `rotate(${r}deg)`, transformOrigin: "4px 4px" }} />;
    return (
      <div style={panel}>
        <div style={{ position: "absolute", inset: 40, borderRadius: 12, background: th.grad }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 ${ins}px rgba(11,16,14,.72)` }} />
        {L(ins, ins, 0)}
        {L(520 - ins, ins, 90)}
        {L(520 - ins, 440 - ins, 180)}
        {L(ins, 440 - ins, 270)}
      </div>
    );
  }
  const pk = kf(lt, [[0, 0], [0.45, 0.93, "expo"], [0.8, 0.99, "out"]]);
  return (
    <div style={panel}>
      <div style={{ position: "absolute", left: 50, top: 150, display: "flex", alignItems: "center", gap: 18, fontFamily: th.body, fontSize: 30, color: th.nightInk }}>
        <Spinner t={t} size={34} color={A} /> Exporting… <span style={{ fontFamily: th.mono, color: A }}>{Math.round(pk * 100)}%</span>
      </div>
      <div style={{ position: "absolute", left: 50, right: 50, top: 230, height: 18, borderRadius: 9, background: "rgba(255,255,255,.08)" }}>
        <div style={{ width: `${pk * 100}%`, height: "100%", borderRadius: 9, background: A }} />
      </div>
    </div>
  );
};

// ── loop: the chores spin around you ──────────────────────────────────────
export const Loop: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const r = progress(t, b.ev.ring, 0.7, "expo");
  const spin = (t - b.ev.ring) * 40 + Math.max(0, t - b.ev.ring) ** 2.2 * 35;
  const collapse = progress(t, b.end - 0.35, 0.35, "in");
  const ring = (b.ring as string[]).map((w) => w.toUpperCase()).join(" · ") + " · ";
  const lines: string[] = b.text.split(/\s*\\n\s*|\n/).filter(Boolean);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 - collapse})` }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: r }}>
        <defs>
          <path id="film-ring" d="M960,540 m-360,0 a360,360 0 1,1 720,0 a360,360 0 1,1 -720,0" />
        </defs>
        <g transform={`rotate(${spin} 960 540) translate(960 540) scale(${0.7 + r * 0.3}) translate(-960 -540)`}>
          <text fontFamily={th.mono} fontSize={40} fill={th.nightAccent} letterSpacing={6}>
            <textPath href="#film-ring" textLength={2255} lengthAdjust="spacing">
              {ring.repeat(Math.max(1, Math.round(2262 / (ring.length * 30))))}
            </textPath>
          </text>
        </g>
      </svg>
      {lines.map((l, i) => (
        <Head key={i} t={t} at={(b.vo.words[b.vo.words.length - 1] ?? b.vo.start) + i * 0.35} text={l} size={Math.min(130, fit(l, 130, 560))} dark y={540 + (i - (lines.length - 1) / 2) * 140} />
      ))}
    </AbsoluteFill>
  );
};

// ── code: the answer is already in the source ─────────────────────────────
export const Code: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const inK = progress(t, b.start + 0.4, 0.8, "expo");
  const hl = progress(t, b.ev.hl, 0.5, "expo");
  const lines: string[] = b.lines;
  return (
    <>
      <DotField t={t} w={1920} h={1080} color={b.dark ? th.nightInk : th.ink} hot={th.accent} hotAt={{ x: 960, y: 720, r: 620, k: hl }} opacity={0.8} />
      <Lines t={t} b={b} text={b.text} y={190} max={140} dark={b.dark} />
      <div style={{ position: "absolute", left: 480, top: 340, width: 960, borderRadius: 24, background: "#0f1513", padding: "26px 0 30px", boxShadow: `0 50px 120px rgba(10,20,15,.28), 0 0 0 1px rgba(10,20,15,.2), 0 0 ${hl * 90}px ${th.pop}55`, opacity: inK, transform: `translateY(${(1 - inK) * 100}px) scale(${0.94 + inK * 0.06})`, fontFamily: th.mono, fontSize: 27 }}>
        <div style={{ display: "flex", gap: 10, padding: "0 28px 18px", alignItems: "center" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
          ))}
          <span style={{ marginLeft: 16, fontSize: 19, color: "#7d8782" }}>{b.file}</span>
        </div>
        {lines.map((l, i) => {
          const lk = progress(t, b.start + 0.6 + i * 0.07, 0.4, "expo");
          const hot = i === b.highlight;
          return (
            <div key={i} style={{ position: "relative", display: "flex", height: 44, alignItems: "center", paddingLeft: 28, opacity: lk * (hot ? 1 : 1 - hl * 0.55), whiteSpace: "pre" }}>
              {hot && <div style={{ position: "absolute", inset: 0, background: `${th.pop}24`, borderLeft: `4px solid ${th.pop}`, transformOrigin: "left", transform: `scaleX(${hl})` }} />}
              <span style={{ width: 44, color: "#4c5652", position: "relative" }}>{i + 1}</span>
              <span style={{ color: hot ? th.pop : "#c7cfcb", position: "relative" }}>{l}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ── reveal: meet the product ──────────────────────────────────────────────
export const Reveal: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const at = b.ev.logo;
  const flare = progress(t, at - 0.05, 0.45, "expo") * (1 - 0.65 * progress(t, at + 0.5, 1.2));
  const hasTag = Boolean(b.tagline);
  const up = hasTag ? progress(t, b.ev.tag - 0.2, 0.8, "expo") : 0;
  const pill = progress(t, b.ev.tag + 0.9, 0.6, "overshoot");
  return (
    <>
      <Flare x={960} y={500 - up * 170} r={720} color={b.dark ? th.nightAccent : th.pop} k={flare} />
      <div style={{ position: "absolute", left: 960, top: 520 - up * 190, transform: `translate(-50%,-50%) scale(${1 - up * 0.3})` }}>
        <Lockup t={t} at={at} size={190} onDark={b.dark} />
      </div>
      {hasTag && <Lines t={t} b={{ ...b, vo: { ...b.vo, words: [b.ev.tag, b.ev.tag + 0.45] } }} text={splitTag(b.tagline)} y={600} max={140} dark={b.dark} />}
      {b.pill && (
        <div style={{ position: "absolute", left: 960, top: 850, transform: `translate(-50%,-50%) scale(${pill})`, opacity: Math.min(1, pill * 2) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: th.body, fontSize: 28, color: th.ink, background: "#fff", borderRadius: 999, padding: "14px 30px", boxShadow: "0 16px 40px rgba(10,20,15,.1)", whiteSpace: "nowrap" }}>
            <span style={{ width: 13, height: 13, borderRadius: "50%", background: th.accent }} />
            {b.pill}
          </div>
        </div>
      )}
    </>
  );
};

/** A long tagline goes on two lines; accent the second half unless the writer marked one. */
function splitTag(s: string) {
  if (s.includes("*")) return s.length > 34 && s.includes(",") ? s.replace(/,\s*/, ",\\n") : s;
  const words = s.split(" ");
  if (s.length <= 30) return s;
  const half = Math.ceil(words.length / 2);
  return `${words.slice(0, half).join(" ")}\\n*${words.slice(half).join(" ")}*`;
}

// ── prompt: ask the agent, watch it run the product ───────────────────────
const COMPOSER = { x: 385, y: 430, w: 1150, h: 222 };
const PANEL = { x: 100, y: 120, w: 720, h: 840 };
const BROWSER = { x: 880, y: 120, w: 940 };

export const Prompt: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const ev = b.ev;
  const m = progress(t, ev.morph, 0.85, "expo");
  const bIn = progress(t, ev.app.enter - 0.1, 0.8, "expo");
  const box = { x: lerp(COMPOSER.x, PANEL.x, m), y: lerp(COMPOSER.y, PANEL.y, m), w: lerp(COMPOSER.w, PANEL.w, m), h: lerp(COMPOSER.h, PANEL.h, m) };
  const prompt: string = b.prompt;
  const slash = prompt.startsWith("/") ? prompt.split(" ")[0] : null;
  const step = { font: th.body, mono: th.mono, ink: "#0d1412", muted: "#5f6763", accent: th.pop, accentInk: th.popInk };
  const label = (
    <>
      <span style={{ color: "#d97757", fontSize: 26, lineHeight: 1 }}>✻</span>
      <span style={{ fontWeight: 600, color: "#0d1412" }}>{b.agent}</span>
    </>
  );
  return (
    <>
      {t < ev.morph ? (
        <div style={{ position: "absolute", left: COMPOSER.x, top: COMPOSER.y }}>
          <ChatComposer
            t={t}
            width={COMPOSER.w}
            label={label}
            text={prompt}
            placeholder={`Ask ${b.agent}…`}
            typingAt={ev.typeAt}
            typingDur={ev.typeDur}
            sendAt={ev.send}
            commands={slash ? [{ name: slash, desc: "Run the command" }, { name: "/clear", desc: "Clear the conversation" }, { name: "/compact", desc: "Summarize context" }] : undefined}
            commandsFrom={ev.typeAt + 0.05}
            commandsTo={ev.typeAt + 0.55}
            font={th.body}
            mono={th.mono}
            ink="#0d1412"
            muted="#5f6763"
            accent={th.pop}
            accentInk={th.popInk}
          />
        </div>
      ) : (
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 30, background: "rgba(255,255,255,.92)", boxShadow: "0 40px 90px rgba(10,20,15,.14), 0 0 0 1px rgba(10,20,15,.07)", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 720, height: 840, padding: 36, opacity: clamp01((m - 0.35) / 0.5), fontFamily: th.body }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 21, color: "#5f6763", paddingBottom: 22, borderBottom: "1px solid rgba(10,20,15,.08)" }}>{label}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
              <div style={{ maxWidth: 580, background: "#0d1412", color: "#f3f5f2", borderRadius: 22, borderTopRightRadius: 8, padding: "18px 24px", fontFamily: th.mono, fontSize: 24, lineHeight: 1.45 }}>
                {slash && <span style={{ color: th.nightAccent }}>{slash}</span>}
                {slash ? prompt.slice(slash.length) : prompt}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: 44 }}>
              {(b.steps as { title: string; sub: string }[]).map((s, i) => (
                <AgentStep key={i} t={t} at={ev.steps[i][0]} doneAt={i < b.steps.length - 1 || t < b.end - 0.2 ? ev.steps[i][1] : undefined} title={s.title} sub={s.sub || undefined} {...step} />
              ))}
            </div>
          </div>
        </div>
      )}
      {t >= ev.app.enter - 0.1 && (
        <div style={{ position: "absolute", left: BROWSER.x, top: BROWSER.y, opacity: bIn, transform: `translateX(${(1 - bIn) * 140}px) scale(${0.94 + bIn * 0.06})`, filter: bIn < 1 ? `blur(${(1 - bIn) * 12}px)` : undefined }}>
          <AppWindow w={BROWSER.w} t={t} a={b.app as AppFields} T={ev.app as AppTimes} label={th.brand.name} right={<RecChip t={t} />} />
        </div>
      )}
    </>
  );
};

const RecChip: React.FC<{ t: number }> = ({ t }) => {
  const th = useFilm();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: th.mono, fontSize: 16, fontWeight: 500, color: th.popInk, background: th.pop, borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: RED, opacity: Math.floor(t * 2.5) % 2 ? 1 : 0.4 }} />
      REC
    </div>
  );
};

// ── app: the product doing its thing ──────────────────────────────────────
export const App: React.FC<P> = ({ t, b }) => {
  const k = progress(t, b.ev.enter, 0.8, "expo");
  const hasText = Boolean(b.text);
  const w = hasText ? 1000 : 1080;
  return (
    <>
      {hasText && <Lines t={t} b={b} text={b.text} y={130} max={110} dark={b.dark} />}
      <div style={{ position: "absolute", left: 960 - w / 2, top: hasText ? 230 : 70, opacity: k, transform: `translateY(${(1 - k) * 80}px) scale(${0.95 + k * 0.05})` }}>
        <AppWindow w={w} t={t} a={b.app} T={b.ev.app} />
      </div>
    </>
  );
};

// ── screenshot: the real product, crisp, with a slow camera ───────────────
export const Screenshot: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const k = progress(t, b.start + 0.1, 0.9, "expo");
  const pan = progress(t, b.start, b.end - b.start, "smooth");
  const hasText = Boolean(b.text);
  const co = progress(t, b.ev.callout, 0.6, "overshoot");
  return (
    <>
      {hasText && <Lines t={t} b={b} text={b.text} y={120} max={110} dark={b.dark} />}
      <div style={{ position: "absolute", left: 210, top: hasText ? 220 : 90, opacity: k, transform: `translateY(${(1 - k) * 80}px)` }}>
        <BrowserFrame width={1500} height={hasText ? 820 : 900} url={(th.brand.url ?? "").replace(/^https?:\/\//, "")} font={th.body}>
          <Img src={asset(b.src)!} style={{ width: "100%", position: "absolute", top: 0, transform: `translateY(${-pan * 12}%) scale(${1 + pan * 0.06})`, transformOrigin: "50% 0" }} />
        </BrowserFrame>
      </div>
      {b.callout && (
        <div style={{ position: "absolute", right: 150, top: 300, transform: `scale(${co})`, opacity: Math.min(1, co * 2), fontFamily: th.body, fontWeight: 600, fontSize: 32, color: th.popInk, background: th.pop, borderRadius: 999, padding: "16px 30px", boxShadow: "0 20px 44px rgba(10,20,15,.2)", whiteSpace: "nowrap" }}>{b.callout}</div>
      )}
    </>
  );
};

// ── result: the finished film ─────────────────────────────────────────────
export const Result: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const g = progress(t, b.start + 0.05, 0.9, "expo");
  const push = progress(t, b.start + 0.8, b.end - b.start, "smooth");
  const play = clamp01((t - b.start) / (b.end - b.start));
  const PL = { x: 300, y: 250, w: 1320, h: 760 };
  const chips: string[] = b.chips;
  const app = b.app as AppFields | undefined;
  const T: AppTimes = { enter: 0, clickInput: 0, typeAt: 0, typeDur: 0.01, clickBtn: 0.1, results: 0.2 };
  return (
    <>
      <Head t={t} at={b.vo.start} text={b.text} size={fit(b.text, 130)} y={130} dark={b.dark} />
      <div style={{ position: "absolute", left: PL.x, top: PL.y, width: PL.w, height: PL.h, borderRadius: 28, overflow: "hidden", boxShadow: "0 50px 120px rgba(10,20,15,.22), 0 0 0 1px rgba(10,20,15,.08)", opacity: g, transform: `scale(${0.9 + g * 0.1})` }}>
        <div style={{ position: "absolute", inset: 0, background: th.grad }} />
        {app ? (
          <div style={{ position: "absolute", left: PL.w / 2 - 340, top: 40, transform: `scale(${1 + push * 0.06})`, transformOrigin: "50% 30%" }}>
            <AppWindow w={680} t={5} a={app} T={T} cursor={false} />
          </div>
        ) : th.brand.screenshots?.[0] ? (
          <div style={{ position: "absolute", left: 120, top: 50, width: PL.w - 240, height: PL.h - 50, borderRadius: "14px 14px 0 0", overflow: "hidden" }}>
            <Img src={asset(th.brand.screenshots[0])!} style={{ width: "100%", transform: `scale(${1 + push * 0.06})`, transformOrigin: "50% 0" }} />
          </div>
        ) : (
          <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center" }}>
            <Lockup t={t} at={b.start} size={120} />
          </div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 86, background: "linear-gradient(0deg,rgba(8,12,10,.78),rgba(8,12,10,0))", display: "flex", alignItems: "center", gap: 22, padding: "0 30px" }}>
          <svg width={28} height={28} viewBox="0 0 24 24">
            <path d="M7 5 L19 12 L7 19 Z" fill="#fff" />
          </svg>
          <div style={{ position: "relative", flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,.25)" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${play * 100}%`, borderRadius: 4, background: th.pop }} />
            {[0.2, 0.47, 0.74].map((p, i) => (
              <div key={p} style={{ position: "absolute", left: `${p * 100}%`, top: -9, width: 3, height: 26, background: "#fff", transform: `scaleY(${progress(t, (b.ev.chips?.[0] ?? b.start + 1) + i * 0.08, 0.35, "overshoot")})` }} />
            ))}
          </div>
          <span style={{ fontFamily: th.mono, fontSize: 19, color: "#fff" }}>{b.file}</span>
        </div>
      </div>
      {chips.map((c, i) => {
        const k = progress(t, b.ev.chips[i], 0.55, "overshoot");
        const last = i === chips.length - 1;
        return (
          <div key={i} style={{ position: "absolute", left: PL.x + PL.w - 90, top: 360 + i * 110, opacity: clamp01(k * 2), transform: `translateX(${(1 - k) * 120}px) scale(${0.8 + k * 0.2})`, fontFamily: last ? th.mono : th.body, fontWeight: 600, fontSize: 34, color: last ? th.popInk : "#0d1412", background: last ? th.pop : "#fff", borderRadius: 999, padding: "16px 30px", boxShadow: "0 20px 44px rgba(10,20,15,.16)", whiteSpace: "nowrap" }}>
            {!last && <span style={{ color: th.accent, marginRight: 12 }}>✓</span>}
            {c}
          </div>
        );
      })}
    </>
  );
};

// ── carousel: every feature ───────────────────────────────────────────────
export const Carousel: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const items: string[] = b.items;
  const drift = (t - b.ev.enter) * 110;
  const total = items.length * 580 - 60;
  const x0 = 960 - total / 2 + 200;
  return (
    <>
      <Head t={t} at={b.vo.start} text={b.text} size={fit(b.text, 130)} y={200} dark={b.dark} />
      {items.map((label, i) => {
        const k = progress(t, b.ev.enter + i * 0.12, 0.8, "expo");
        return (
          <div key={i} style={{ position: "absolute", left: x0 + i * 580 - drift + (1 - k) * 500, top: 414, width: 520, height: 293, opacity: k, transform: `perspective(1400px) rotateY(${(1 - k) * -25}deg)` }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 22, overflow: "hidden", background: th.grad, boxShadow: "0 30px 70px rgba(10,20,15,.18)" }}>
              <div style={{ position: "absolute", left: 50, right: 50, top: 34, bottom: 0, borderRadius: "14px 14px 0 0", background: "#fff", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ width: "50%", height: 16, borderRadius: 8, background: "#dfe2e0" }} />
                <div style={{ width: "85%", height: 44, borderRadius: 10, background: "#f1f2f1" }} />
                <div style={{ width: 120, height: 34, borderRadius: 10, background: i % 2 ? "#111" : th.pop }} />
              </div>
            </div>
            <div style={{ position: "absolute", left: 0, top: 293 + 26, fontFamily: th.mono, fontSize: 26, color: b.dark ? th.nightInk : th.ink, opacity: progress(t, b.ev.enter + 0.4 + i * 0.1, 0.4), whiteSpace: "nowrap" }}>{label}</div>
          </div>
        );
      })}
    </>
  );
};

// ── close: phrases, lockup, call to action ────────────────────────────────
export const Close: React.FC<P> = ({ t, b }) => {
  const th = useFilm();
  const phrases: string[] = b.phrases;
  const ev = b.ev;
  const pill = progress(t, ev.cta, 0.6, "overshoot");
  const press = clamp01(1 - Math.abs(t - ev.click) / 0.12);
  const flare = progress(t, ev.lockup, 1.2) * 0.45;
  const cur = cursorAt([{ t: ev.click - 0.8, x: 1560, y: 1060 }, { t: ev.click, x: 1010, y: 760, click: true }, { t: ev.click + 1.2, x: 1130, y: 880 }], t);
  const all = phrases.join(" ");
  const size = Math.min(150, fit(all, 150, 1700, 0.46));
  const dark = b.dark;
  return (
    <>
      <Flare x={960} y={300} r={700} color={th.pop} k={flare} />
      <div style={{ position: "absolute", left: 960, top: 290, transform: "translate(-50%,-50%)" }}>{t >= ev.lockup - 0.05 && <Lockup t={t} at={ev.lockup} size={120} onDark={dark} />}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 520, display: "flex", justifyContent: "center", gap: size * 0.3, transform: "translateY(-50%)" }}>
        {phrases.map((p, i) => (
          <Words key={i} t={t} at={ev.phrases[i]} words={parse(p)} size={size} font={th.display} accentFont={th.display} monoFont={th.mono} color={dark ? th.nightInk : th.ink} accentColor={dark ? th.nightAccent : th.accent} monoBg={th.ink} monoColor={th.pop} stagger={0.1} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 960, top: 740, transform: `translate(-50%,-50%) scale(${pill})`, opacity: clamp01(pill * 2) }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, fontFamily: th.body, fontWeight: 600, fontSize: 38, color: th.popInk, background: th.pop, borderRadius: 999, padding: "24px 46px", boxShadow: `0 ${18 - press * 12}px 40px ${th.pop}66`, transform: `scale(${1 - press * 0.06})`, whiteSpace: "nowrap" }}>
          {b.cta}
          <svg width={36} height={36} viewBox="0 0 24 24">
            <path d="M4 12 H19 M13 6 L19 12 L13 18" fill="none" stroke={th.popInk} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {b.url && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 865, textAlign: "center", fontFamily: th.mono, fontSize: 32, color: dark ? th.nightMuted : th.muted, opacity: progress(t, ev.cta + 0.4, 0.5) }}>{b.url}</div>
      )}
      <NamedCursor {...cur} opacity={progress(t, ev.click - 0.8, 0.3) * (1 - progress(t, ev.click + 1.1, 0.4))} />
    </>
  );
};

export const BEATS: Record<string, React.FC<P>> = {
  headline: Headline,
  shipped: Shipped,
  checklist: Checklist,
  grind: Grind,
  loop: Loop,
  code: Code,
  reveal: Reveal,
  prompt: Prompt,
  app: App,
  screenshot: Screenshot,
  result: Result,
  carousel: Carousel,
  close: Close,
};
