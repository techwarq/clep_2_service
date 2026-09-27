import React from "react";
import { progress, clamp01 } from "@/kit/motion";
import { NamedCursor, cursorAt, typed, Caret, Skel, Spinner, CursorKey } from "@/kit/ui/promo";
import { C, F } from "../clep-launch/theme";

// The user's app ("Atlas" research), recreated. Neutral indigo so it reads as
// theirs, not clep's. Every action time is passed in, so one component serves
// the fumbling manual take, clep's directed run and the finished film.
export type AppTimes = {
  clickInput: number;
  typeAt: number;
  typeDur: number;
  clickBtn: number;
  results: number;
  zoom?: [number, number];
};

const QUERY = "EV charging market in Europe";

export const AtlasApp: React.FC<{
  t: number;
  T: AppTimes;
  cursor?: CursorKey[];
  cursorLabel?: string;
  cursorOpacity?: number;
  query?: string;
}> = ({ t, T, cursor, cursorLabel, cursorOpacity = 1, query = QUERY }) => {
  const zk = T.zoom ? progress(t, T.zoom[0], 0.6, "smooth") * (1 - progress(t, T.zoom[1], 0.8, "smooth")) : 0;
  const cur = cursor ? cursorAt(cursor, t) : null;
  const focus = t >= T.clickInput;
  const q = typed(query, t, T.typeAt, T.typeDur);
  const pressed = t >= T.clickBtn;
  const pk = clamp01(1 - Math.abs(t - T.clickBtn) / 0.12);
  const loading = pressed && t < T.results;
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: "362px 290px", transform: `scale(${1 + zk * 0.45})`, fontFamily: F.sans, background: "#fbfbfc" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 190, background: "#f1f2f6", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 22, color: "#1e1b4b" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: C.indigo }} /> Atlas
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ marginTop: i ? 16 : 40, height: 14, width: 110 - i * 14, borderRadius: 7, background: i === 0 ? "#c7c9f5" : "#dcdee6" }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 240, top: 44, fontSize: 40, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>Research</div>
      <div style={{ position: "absolute", left: 240, top: 100, fontSize: 21, color: "#6b7280" }}>Ask a question — get a sourced brief.</div>
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 160,
          width: 640,
          height: 74,
          borderRadius: 14,
          background: "#fff",
          boxShadow: focus ? `0 0 0 3px ${C.indigo}55, 0 0 0 1.5px ${C.indigo}` : "0 0 0 1.5px #dfe1e8",
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          fontSize: 25,
          color: "#111",
        }}
      >
        {q ? q : <span style={{ color: "#a0a4b0" }}>What do you want to research?</span>}
        {focus && t < T.clickBtn && <Caret t={t} color={C.indigo} h={30} solid={t < T.typeAt + T.typeDur} />}
      </div>
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 258,
          width: 244,
          height: 64,
          borderRadius: 14,
          background: C.indigo,
          color: "#fff",
          fontSize: 23,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          transform: `scale(${1 - pk * 0.06})`,
          boxShadow: `0 10px 24px ${C.indigo}44`,
        }}
      >
        {loading ? (
          <>
            <Spinner t={t} size={24} color="#fff" /> Researching…
          </>
        ) : (
          "Start Research"
        )}
      </div>
      <div style={{ position: "absolute", left: 240, top: 360, width: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        {pressed &&
          RESULTS.map((r, i) => {
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
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.indigo, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.src}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: "#111", marginTop: 8, lineHeight: 1.25 }}>{r.title}</div>
                </div>
                {r.bars && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                    {r.bars.map((b, j) => (
                      <div key={j} style={{ width: 16, height: 70 * b * k, borderRadius: 4, background: j === 4 ? C.indigo : "#c7c9f5" }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
      {cur && <NamedCursor {...cur} label={cursorLabel} color={C.lime} labelColor={C.limeInk} opacity={cursorOpacity} />}
    </div>
  );
};

const RESULTS = [
  { title: "Europe's EV charging market to reach €41B by 2030", src: "Market brief", bars: [0.3, 0.45, 0.6, 0.78, 1] },
  { title: "Fast-charging points grew 48% year over year", src: "Industry report" },
  { title: "Top operators: Ionity, Allego, Fastned", src: "Competitor scan" },
];

/** Directed cursor path for a run whose actions happen at T. */
export function directedPath(T: AppTimes, enter: number): CursorKey[] {
  return [
    { t: enter, x: 820, y: 700 },
    { t: T.clickInput, x: 460, y: 196, click: true },
    { t: T.clickBtn - 0.3, x: 470, y: 210 },
    { t: T.clickBtn, x: 362, y: 290, click: true },
    { t: T.results + 1.2, x: 640, y: 560 },
  ];
}
