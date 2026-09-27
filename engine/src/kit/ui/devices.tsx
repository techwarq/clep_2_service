import React from "react";
import { useKitTheme } from "../theme/ThemeProvider";
import { alpha, mix } from "../lib/color";

/** macOS-style browser window. Children fill the viewport area. */
export const BrowserWindow: React.FC<{
  width: number;
  height: number;
  url?: string;
  children?: React.ReactNode;
  dark?: boolean;
  style?: React.CSSProperties;
  shadow?: boolean;
}> = ({ width, height, url = "", children, dark, style, shadow = true }) => {
  const theme = useKitTheme();
  const isDark = dark ?? theme.mode === "dark";
  const chrome = isDark ? "#1C1C1F" : "#F3F3F4";
  const barH = Math.max(36, Math.round(height * 0.055));
  return (
    <div
      style={{
        width,
        height,
        borderRadius: Math.max(12, theme.radius * 0.8),
        overflow: "hidden",
        background: isDark ? "#0F0F11" : "#ffffff",
        border: `1px solid ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`,
        boxShadow: shadow ? `0 40px 90px ${alpha("#0A0F1E", isDark ? 0.55 : 0.18)}, 0 8px 24px ${alpha("#0A0F1E", 0.08)}` : undefined,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          height: barH,
          flex: "none",
          background: chrome,
          display: "flex",
          alignItems: "center",
          padding: `0 ${barH * 0.45}px`,
          gap: barH * 0.22,
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: barH * 0.3, height: barH * 0.3, borderRadius: "50%", background: c }} />
        ))}
        <div
          style={{
            margin: "0 auto",
            height: barH * 0.62,
            width: "42%",
            borderRadius: barH,
            background: isDark ? "rgba(255,255,255,.07)" : "#fff",
            border: `1px solid ${isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: barH * 0.34,
            color: isDark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.55)",
            fontFamily: theme.fontBody,
            fontWeight: 500,
          }}
        >
          {url}
        </div>
        <span style={{ width: barH * 1.4 }} />
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

/** iPhone-style device. Children render inside the rounded screen. */
export const PhoneFrame: React.FC<{
  height: number;
  children?: React.ReactNode;
  screenBg?: string;
  style?: React.CSSProperties;
  darkUi?: boolean;
}> = ({ height, children, screenBg = "#0B0B0C", style, darkUi = true }) => {
  const width = height * 0.49;
  const r = width * 0.17;
  const bezel = width * 0.035;
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: r,
        background: "linear-gradient(90deg,#3a3a3c,#6e6e71 7%,#242426 50%,#6e6e71 93%,#3a3a3c)",
        boxShadow: "0 50px 100px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.2)",
        flex: "none",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: bezel,
          borderRadius: r - bezel,
          overflow: "hidden",
          background: screenBg,
        }}
      >
        {children}
        <div
          style={{
            position: "absolute",
            top: height * 0.018,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.3,
            height: height * 0.043,
            borderRadius: 99,
            background: "#000",
            zIndex: 5,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: height * 0.012,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.36,
            height: 5,
            borderRadius: 3,
            background: darkUi ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.3)",
            zIndex: 5,
          }}
        />
      </div>
    </div>
  );
};

/** Floating card surface — the base of most UI mocks. */
export const Surface: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
  elevated?: boolean;
}> = ({ children, style, pad = 24, elevated = true }) => {
  const theme = useKitTheme();
  const dark = theme.mode === "dark";
  return (
    <div
      style={{
        background: theme.card,
        color: theme.cardForeground,
        borderRadius: theme.radius,
        padding: pad,
        border: `1px solid ${theme.border}`,
        boxShadow: elevated
          ? `0 30px 70px ${alpha("#0A0F1E", dark ? 0.5 : 0.14)}, 0 6px 16px ${alpha("#0A0F1E", dark ? 0.3 : 0.06)}`
          : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Gray placeholder bars that read as "content" without fake text. */
export const SkeletonLines: React.FC<{ lines?: number; width?: number; gap?: number; h?: number }> = ({
  lines = 3,
  width = 320,
  gap = 12,
  h = 10,
}) => {
  const theme = useKitTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{ height: h, borderRadius: h, width: width * (1 - (i % 3) * 0.18), background: mix(theme.card, theme.foreground, 0.08) }}
        />
      ))}
    </div>
  );
};
