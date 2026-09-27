import React from "react";
import { progress, clamp01 } from "@/kit/motion";
import { NamedCursor, cursorAt, typed, Caret, Skel, Spinner, CursorKey, BrowserFrame } from "@/kit/ui/promo";
import { useFilm } from "./theme";

// A recreated product UI (input → action → results): the one flow almost every
// product has. Text comes from the script; times from the planner.
export type AppFields = {
  name: string;
  title: string;
  subtitle: string;
  placeholder: string;
  query: string;
  button: string;
  results: { tag: string; title: string }[];
};
export type AppTimes = { enter: number; clickInput: number; typeAt: number; typeDur: number; clickBtn: number; results: number; zoom?: number[] };

const UI = "#4f46e5"; // the user's app keeps a neutral indigo so it never reads as the video's brand

export function appPath(T: AppTimes): CursorKey[] {
  return [
    { t: T.enter, x: 820, y: 700 },
    { t: T.clickInput, x: 460, y: 196, click: true },
    { t: T.clickBtn - 0.3, x: 470, y: 210 },
    { t: T.clickBtn, x: 362, y: 290, click: true },
    { t: T.results + 1.2, x: 640, y: 560 },
  ];
}

export const FilmApp: React.FC<{ t: number; a: AppFields; T: AppTimes; cursor?: boolean; label?: string }> = ({ t, a, T, cursor = true, label }) => {
  const th = useFilm();
  const zk = T.zoom ? progress(t, T.zoom[0], 0.55, "smooth") * (1 - progress(t, T.zoom[1], 0.7, "smooth")) : 0;
  const cur = cursor ? cursorAt(appPath(T), t) : null;
  const focus = t >= T.clickInput;
  const q = typed(a.query, t, T.typeAt, T.typeDur);
  const pressed = t >= T.clickBtn;
  const pk = clamp01(1 - Math.abs(t - T.clickBtn) / 0.12);
  const loading = pressed && t < T.results;
  const font = "Inter, system-ui, sans-serif";
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: "362px 290px", transform: `scale(${1 + zk * 0.45})`, fontFamily: font, background: "#fbfbfc" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 190, background: "#f1f2f6", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 22, color: "#1e1b4b", whiteSpace: "nowrap" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: UI, flex: "none" }} /> {a.name}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ marginTop: i ? 16 : 40, height: 14, width: 110 - i * 14, borderRadius: 7, background: i === 0 ? "#c7c9f5" : "#dcdee6" }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 240, top: 44, fontSize: 40, fontWeight: 700, color: "#111", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{a.title}</div>
      <div style={{ position: "absolute", left: 240, top: 100, fontSize: 21, color: "#6b7280", whiteSpace: "nowrap" }}>{a.subtitle}</div>
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 160,
          width: 640,
          height: 74,
          borderRadius: 14,
          background: "#fff",
          boxShadow: focus ? `0 0 0 3px ${UI}55, 0 0 0 1.5px ${UI}` : "0 0 0 1.5px #dfe1e8",
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          fontSize: 25,
          color: "#111",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {q ? q : <span style={{ color: "#a0a4b0" }}>{a.placeholder}</span>}
        {focus && t < T.clickBtn && <Caret t={t} color={UI} h={30} solid={t < T.typeAt + T.typeDur} />}
      </div>
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 258,
          minWidth: 244,
          padding: "0 26px",
          height: 64,
          borderRadius: 14,
          background: UI,
          color: "#fff",
          fontSize: 23,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          transform: `scale(${1 - pk * 0.06})`,
          boxShadow: `0 10px 24px ${UI}44`,
          whiteSpace: "nowrap",
        }}
      >
        {loading ? (
          <>
            <Spinner t={t} size={24} color="#fff" /> Working…
          </>
        ) : (
          a.button
        )}
      </div>
      <div style={{ position: "absolute", left: 240, top: 360, width: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        {pressed &&
          a.results.map((r, i) => {
            if (t < T.results)
              return (
                <div key={i} style={{ height: 112, borderRadius: 16, background: "#fff", boxShadow: "0 0 0 1.5px #eceef2", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                  <Skel t={t} w="60%" h={18} />
                  <Skel t={t} w="90%" h={14} />
                </div>
              );
            const k = progress(t, T.results + i * 0.2, 0.5, "expo");
            return (
              <div key={i} style={{ height: 112, borderRadius: 16, background: "#fff", boxShadow: "0 0 0 1.5px #eceef2, 0 8px 20px rgba(20,20,60,.05)", padding: "18px 22px", display: "flex", gap: 18, alignItems: "center", opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: UI, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.tag}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: "#111", marginTop: 8, lineHeight: 1.25 }}>{r.title}</div>
                </div>
                {i === 0 && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                    {[0.3, 0.45, 0.6, 0.78, 1].map((b, j) => (
                      <div key={j} style={{ width: 16, height: 70 * b * k, borderRadius: 4, background: j === 4 ? UI : "#c7c9f5" }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
      {cur && <NamedCursor {...cur} label={label} color={th.pop} labelColor={th.popInk} opacity={progress(t, T.enter, 0.35)} />}
    </div>
  );
};

/** The app in a browser window, `w` px wide. */
export const AppWindow: React.FC<{ w: number; t: number; a: AppFields; T: AppTimes; cursor?: boolean; label?: string; right?: React.ReactNode }> = ({ w, t, a, T, cursor, label, right }) => (
  <div style={{ width: w, height: (w / 940) * 840 }}>
    <div style={{ transform: `scale(${w / 940})`, transformOrigin: "0 0" }}>
      <BrowserFrame width={940} height={840} url={`app.${a.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`} font="Inter, system-ui, sans-serif" right={right}>
        <FilmApp t={t} a={a} T={T} cursor={cursor} label={label} />
      </BrowserFrame>
    </div>
  </div>
);
