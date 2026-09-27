import React from "react";
import { useKitTheme } from "../theme/ThemeProvider";
import { alpha } from "../lib/color";

/** Small deterministic JS/TS/JSX/shell tokenizer — enough for believable, on-brand code shots. */
const RULES: [RegExp, string][] = [
  [/^(\/\/.*|#.*)/, "comment"],
  [/^("[^"]*"|'[^']*'|`[^`]*`)/, "string"],
  [/^\b(import|from|export|default|const|let|var|function|return|async|await|if|else|new|class|extends|type|interface|for|of|in|true|false|null|undefined)\b/, "keyword"],
  [/^\b\d+(\.\d+)?\b/, "number"],
  [/^<\/?[A-Za-z][\w.-]*/, "tag"],
  [/^\b[A-Z][A-Za-z0-9_]*\b/, "type"],
  [/^\b[a-zA-Z_]\w*(?=\()/, "fn"],
  [/^[a-zA-Z_][\w-]*(?==)/, "attr"],
  [/^\s+/, "ws"],
  [/^./, "plain"],
];

export function tokenize(line: string) {
  const out: { text: string; kind: string }[] = [];
  let rest = line;
  while (rest.length) {
    for (const [re, kind] of RULES) {
      const m = rest.match(re);
      if (m) {
        const last = out[out.length - 1];
        if (last && last.kind === kind && (kind === "plain" || kind === "ws")) last.text += m[0];
        else out.push({ text: m[0], kind });
        rest = rest.slice(m[0].length);
        break;
      }
    }
  }
  return out;
}

export function useCodePalette() {
  const theme = useKitTheme();
  const dark = true;
  return {
    bg: "#0D0E12",
    fg: "#E6E6E9",
    comment: "#6B7080",
    string: "#A5E3A0",
    keyword: "#C792EA",
    number: "#F78C6C",
    tag: "#7FDBCA",
    type: "#FFCB6B",
    fn: "#82AAFF",
    attr: theme.accent,
    plain: "#E6E6E9",
    ws: "#E6E6E9",
    lineNo: "rgba(255,255,255,.22)",
    highlight: alpha(theme.primary.startsWith("#") ? theme.primary : "#3B6FE0", 0.18),
    dark,
  } as Record<string, string | boolean>;
}

export const CodeLine: React.FC<{ line: string; visibleChars?: number }> = ({ line, visibleChars }) => {
  const pal = useCodePalette();
  let budget = visibleChars ?? Infinity;
  return (
    <>
      {tokenize(line).map((tok, i) => {
        if (budget <= 0) return null;
        const text = tok.text.slice(0, budget);
        budget -= tok.text.length;
        return (
          <span key={i} style={{ color: pal[tok.kind] as string, whiteSpace: "pre" }}>
            {text}
          </span>
        );
      })}
    </>
  );
};

/** Editor window with line numbers, optional per-line highlight and typing. */
export const CodeWindow: React.FC<{
  lines: string[];
  fontSize?: number;
  title?: string;
  highlight?: number[];
  highlightOpacity?: number;
  /** Total characters revealed (typing). Omit for fully shown. */
  typed?: number;
  width?: number | string;
  style?: React.CSSProperties;
}> = ({ lines, fontSize = 22, title = "index.tsx", highlight = [], highlightOpacity = 1, typed, width = 900, style }) => {
  const theme = useKitTheme();
  const pal = useCodePalette();
  let remaining = typed ?? Infinity;
  return (
    <div
      style={{
        width,
        background: pal.bg as string,
        borderRadius: theme.radius,
        border: "1px solid rgba(255,255,255,.08)",
        boxShadow: "0 40px 90px rgba(0,0,0,.45)",
        overflow: "hidden",
        fontFamily: theme.fontMono,
        fontSize,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          color: "rgba(255,255,255,.5)",
          fontSize: fontSize * 0.62,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
        <span style={{ marginLeft: 12 }}>{title}</span>
      </div>
      <div style={{ padding: `${fontSize * 0.8}px 0` }}>
        {lines.map((line, i) => {
          const vis = Math.max(0, Math.min(line.length, remaining));
          remaining -= line.length + 1;
          const hl = highlight.includes(i + 1);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                lineHeight: 1.65,
                padding: `0 ${fontSize}px 0 0`,
                background: hl ? (pal.highlight as string) : undefined,
                opacity: highlight.length && !hl ? 1 - 0.55 * highlightOpacity : 1,
                boxShadow: hl ? `inset 3px 0 0 ${theme.primary}` : undefined,
              }}
            >
              <span style={{ width: fontSize * 2.6, textAlign: "right", paddingRight: fontSize, color: pal.lineNo as string, flex: "none" }}>
                {i + 1}
              </span>
              <span>{typed === undefined || vis > 0 ? <CodeLine line={line} visibleChars={typed === undefined ? undefined : vis} /> : null}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
