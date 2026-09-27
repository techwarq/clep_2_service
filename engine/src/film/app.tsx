import React from "react";
import { progress, clamp01 } from "@/kit/motion";
import { NamedCursor, cursorAt, typed, Caret, Skel, Spinner, CursorKey, BrowserFrame } from "@/kit/ui/promo";
import { useFilm } from "./theme";

// A recreated product UI (input → action → results): the one flow almost every
// product has. Text comes from the script; times from the planner.
export type AppLayout = "search" | "list" | "dashboard" | "chat";
export type AppFields = {
  layout?: AppLayout;
  /** dashboard: the insight that appears after the ask; chat: the assistant's lead sentence */
  insight?: string;
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

/** Where the input and the action button sit in each layout (app coordinates, 940×782). */
const HOT: Record<AppLayout, { input: [number, number]; button: [number, number] }> = {
  search: { input: [460, 196], button: [362, 290] },
  list: { input: [430, 170], button: [806, 292] },
  dashboard: { input: [470, 178], button: [838, 178] },
  chat: { input: [470, 716], button: [846, 716] },
};

export function appPath(T: AppTimes, layout: AppLayout = "search"): CursorKey[] {
  const h = HOT[layout] ?? HOT.search;
  return [
    { t: T.enter, x: 820, y: 640 },
    { t: T.clickInput, x: h.input[0], y: h.input[1], click: true },
    { t: T.clickBtn - 0.3, x: h.input[0] + 10, y: h.input[1] + 14 },
    { t: T.clickBtn, x: h.button[0], y: h.button[1], click: true },
    { t: T.results + 1.2, x: 640, y: 520 },
  ];
}

export const FilmApp: React.FC<{ t: number; a: AppFields; T: AppTimes; cursor?: boolean; label?: string }> = (props) => {
  const layout = props.a.layout ?? "search";
  if (layout === "search") return <SearchApp {...props} />;
  const { t, a, T, cursor = true, label } = props;
  const th = useFilm();
  const h = HOT[layout];
  const zk = T.zoom ? progress(t, T.zoom[0], 0.55, "smooth") * (1 - progress(t, T.zoom[1], 0.7, "smooth")) : 0;
  const cur = cursor ? cursorAt(appPath(T, layout), t) : null;
  const Body = layout === "list" ? ListBody : layout === "dashboard" ? DashBody : ChatBody;
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: `${h.button[0]}px ${h.button[1]}px`, transform: `scale(${1 + zk * 0.4})`, fontFamily: FONT, background: "#fbfbfc" }}>
      <Sidebar name={a.name} />
      <div style={{ position: "absolute", left: 240, top: 36, right: 40, display: "flex", alignItems: "baseline", gap: 18, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>{a.title}</span>
        <span style={{ fontSize: 19, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>{a.subtitle}</span>
      </div>
      <Body t={t} a={a} T={T} />
      {cur && <NamedCursor {...cur} label={label} color={th.pop} labelColor={th.popInk} opacity={progress(t, T.enter, 0.35)} />}
    </div>
  );
};

const FONT = "Inter, system-ui, sans-serif";

const Sidebar: React.FC<{ name: string }> = ({ name }) => (
  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 190, background: "#f1f2f6", padding: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 22, color: "#1e1b4b", whiteSpace: "nowrap" }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: UI, flex: "none" }} /> {name}
    </div>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} style={{ marginTop: i ? 16 : 40, height: 14, width: 110 - i * 14, borderRadius: 7, background: i === 0 ? "#c7c9f5" : "#dcdee6" }} />
    ))}
  </div>
);

type BodyP = { t: number; a: AppFields; T: AppTimes };

const Input: React.FC<BodyP & { x: number; y: number; w: number; icon?: string }> = ({ t, a, T, x, y, w, icon = "⌕" }) => {
  const focus = t >= T.clickInput;
  const q = typed(a.query, t, T.typeAt, T.typeDur);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: 60, borderRadius: 14, background: "#fff", boxShadow: focus ? `0 0 0 3px ${UI}44, 0 0 0 1.5px ${UI}` : "0 0 0 1.5px #dfe1e8", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", fontSize: 22, color: "#111", whiteSpace: "nowrap", overflow: "hidden" }}>
      <span style={{ color: "#9ca3af" }}>{icon}</span>
      {q ? q : <span style={{ color: "#a0a4b0" }}>{a.placeholder}</span>}
      {focus && t < T.clickBtn && <Caret t={t} color={UI} h={26} solid={t < T.typeAt + T.typeDur} />}
    </div>
  );
};

const pill = (tone: "todo" | "done" | "busy"): React.CSSProperties => ({
  fontSize: 15, fontWeight: 600, borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap",
  color: tone === "done" ? "#166534" : tone === "busy" ? "#92400e" : "#3730a3",
  background: tone === "done" ? "#dcfce7" : tone === "busy" ? "#fef3c7" : "#e0e7ff",
});

/** A queue/table: filter, then act on the top row; its status flips to done. */
const ListBody: React.FC<BodyP> = ({ t, a, T }) => {
  const done = t >= T.results;
  const pk = clamp01(1 - Math.abs(t - T.clickBtn) / 0.12);
  const toast = progress(t, T.results + 0.1, 0.45, "overshoot") * (1 - progress(t, T.results + 2.2, 0.4));
  const rows = a.results;
  return (
    <>
      <Input t={t} a={a} T={T} x={240} y={140} w={420} />
      <div style={{ position: "absolute", left: 240, top: 226, width: 660, borderRadius: 16, background: "#fff", boxShadow: "0 0 0 1.5px #eceef2" }}>
        {rows.map((r, i) => {
          const first = i === 0;
          const busy = first && t >= T.clickBtn && !done;
          const dim = t >= T.typeAt + T.typeDur && !first ? 0.45 : 1;
          return (
            <div key={i} style={{ height: 132, display: "flex", alignItems: "center", gap: 16, padding: "0 22px", borderTop: i ? "1px solid #f0f1f4" : undefined, opacity: dim, background: first && t >= T.clickInput ? "#f8f9ff" : undefined }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#111", lineHeight: 1.3 }}>{r.title}</div>
                <div style={{ marginTop: 8, fontSize: 16, color: "#9ca3af" }}>#{1042 + i * 7} · just now</div>
              </div>
              <span style={pill(first && done ? "done" : busy ? "busy" : "todo")}>{first && done ? "Done" : busy ? "Working…" : r.tag}</span>
              {first && (
                <div style={{ minWidth: 120, padding: "0 16px", height: 48, borderRadius: 12, background: done ? "#e5e7eb" : UI, color: done ? "#6b7280" : "#fff", fontSize: 19, fontWeight: 600, display: "grid", placeItems: "center", transform: `scale(${1 - pk * 0.06})`, whiteSpace: "nowrap" }}>{a.button}</div>
              )}
            </div>
          );
        })}
      </div>
      {toast > 0.01 && (
        <div style={{ position: "absolute", right: 40, bottom: 40, transform: `translateY(${(1 - toast) * 30}px) scale(${0.9 + toast * 0.1})`, opacity: Math.min(1, toast * 2), background: "#111827", color: "#fff", borderRadius: 14, padding: "16px 22px", fontSize: 20, fontWeight: 600, display: "flex", gap: 10, alignItems: "center", boxShadow: "0 16px 40px rgba(0,0,0,.25)" }}>
          <span style={{ color: "#4ade80" }}>✓</span> {a.insight || `${a.button} — done`}
        </div>
      )}
    </>
  );
};

/** KPI tiles + a chart; ask a question and the answer highlights. */
const DashBody: React.FC<BodyP> = ({ t, a, T }) => {
  const pk = clamp01(1 - Math.abs(t - T.clickBtn) / 0.12);
  const ans = progress(t, T.results, 0.6, "expo");
  const loading = t >= T.clickBtn && t < T.results;
  const bars = [0.42, 0.55, 0.48, 0.66, 0.6, 0.78, 0.92];
  return (
    <>
      <Input t={t} a={a} T={T} x={240} y={148} w={560} icon="✦" />
      <div style={{ position: "absolute", left: 812, top: 154, height: 48, padding: "0 18px", borderRadius: 12, background: UI, color: "#fff", fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, transform: `scale(${1 - pk * 0.06})`, whiteSpace: "nowrap" }}>
        {loading ? <Spinner t={t} size={20} color="#fff" /> : a.button}
      </div>
      <div style={{ position: "absolute", left: 240, top: 236, width: 660, display: "flex", gap: 14 }}>
        {a.results.map((r, i) => (
          <div key={i} style={{ flex: 1, borderRadius: 14, background: "#fff", boxShadow: "0 0 0 1.5px #eceef2", padding: "16px 18px", minWidth: 0 }}>
            <div style={{ fontSize: 15, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.tag}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#111", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 240, top: 356, width: 660, height: 250, borderRadius: 16, background: "#fff", boxShadow: "0 0 0 1.5px #eceef2", padding: 24, display: "flex", alignItems: "flex-end", gap: 18 }}>
        {bars.map((b, i) => {
          const hot = i === bars.length - 1 && ans > 0;
          return <div key={i} style={{ flex: 1, height: `${b * 100 * (0.5 + 0.5 * progress(t, T.enter + i * 0.06, 0.6, "expo"))}%`, borderRadius: 8, background: hot ? UI : "#c7c9f5", boxShadow: hot ? `0 0 0 ${ans * 5}px ${UI}33` : undefined }} />;
        })}
      </div>
      {ans > 0.01 && (
        <div style={{ position: "absolute", left: 240, top: 626, width: 660, borderRadius: 16, background: "#eef2ff", padding: "18px 22px", fontSize: 21, color: "#1e1b4b", fontWeight: 500, lineHeight: 1.35, opacity: ans, transform: `translateY(${(1 - ans) * 20}px)` }}>
          <span style={{ color: UI, fontWeight: 700 }}>✦ </span>
          {a.insight || a.subtitle}
        </div>
      )}
    </>
  );
};

/** The product's own assistant: ask, and it answers with cards. */
const ChatBody: React.FC<BodyP> = ({ t, a, T }) => {
  const pk = clamp01(1 - Math.abs(t - T.clickBtn) / 0.12);
  const sent = t >= T.clickBtn;
  const thinking = sent && t < T.results;
  const ans = progress(t, T.results, 0.5, "expo");
  return (
    <>
      {sent && (
        <div style={{ position: "absolute", right: 40, top: 130, maxWidth: 520, background: UI, color: "#fff", borderRadius: 20, borderBottomRightRadius: 6, padding: "14px 20px", fontSize: 21, lineHeight: 1.35, opacity: progress(t, T.clickBtn, 0.3), transform: `translateY(${(1 - progress(t, T.clickBtn, 0.4, "expo")) * 30}px)` }}>{a.query}</div>
      )}
      {thinking && (
        <div style={{ position: "absolute", left: 240, top: 230, display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: 5, background: "#9ca3af", opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i)) }} />
          ))}
        </div>
      )}
      {ans > 0.01 && (
        <div style={{ position: "absolute", left: 240, top: 220, width: 620, opacity: ans, transform: `translateY(${(1 - ans) * 20}px)` }}>
          <div style={{ fontSize: 21, color: "#111", lineHeight: 1.4, marginBottom: 16 }}>{a.insight || a.subtitle}</div>
          {a.results.map((r, i) => {
            const k = progress(t, T.results + 0.2 + i * 0.18, 0.45, "expo");
            return (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", background: "#fff", boxShadow: "0 0 0 1.5px #eceef2", borderRadius: 14, padding: "14px 18px", marginBottom: 12, opacity: k, transform: `translateY(${(1 - k) * 16}px)` }}>
                <span style={pill("todo")}>{r.tag}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#111" }}>{r.title}</span>
              </div>
            );
          })}
        </div>
      )}
      <Input t={t} a={{ ...a, query: sent ? "" : a.query }} T={sent ? { ...T, clickInput: 1e9 } : T} x={240} y={686} w={560} icon="✎" />
      <div style={{ position: "absolute", left: 816, top: 690, width: 56, height: 52, borderRadius: 14, background: UI, display: "grid", placeItems: "center", transform: `scale(${1 - pk * 0.1})` }}>
        <svg width={24} height={24} viewBox="0 0 24 24">
          <path d="M12 19 V5 M5.5 11.5 L12 5 L18.5 11.5" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </>
  );
};

/** The original input → button → results screen. */
const SearchApp: React.FC<{ t: number; a: AppFields; T: AppTimes; cursor?: boolean; label?: string }> = ({ t, a, T, cursor = true, label }) => {
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
