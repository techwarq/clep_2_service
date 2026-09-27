import React, { createContext, useContext } from "react";
import { KitTheme, defaultTheme } from "./defaultTheme";

const ThemeContext = createContext<KitTheme>(defaultTheme);

export const useKitTheme = () => useContext(ThemeContext);

/**
 * Wrap a video's root in this with its brand's KitTheme. Sets the CSS custom
 * properties every shadcn / Magic UI / 21st.dev component in kit/components/ui
 * reads (var(--primary), var(--card) …) so imported components re-theme with
 * zero edits, and exposes the raw values via context for kit code that needs
 * them in JS (gradients, canvas, SVG fills).
 */
export const ThemeProvider: React.FC<{ theme: KitTheme; children: React.ReactNode }> = ({ theme, children }) => {
  return (
    <ThemeContext.Provider value={theme}>
      <div
        className={theme.mode === "dark" ? "dark" : undefined}
        style={
          {
            "--background": theme.background,
            "--foreground": theme.foreground,
            "--card": theme.card,
            "--card-foreground": theme.cardForeground,
            "--primary": theme.primary,
            "--primary-foreground": theme.primaryForeground,
            "--secondary": theme.secondary,
            "--secondary-foreground": theme.secondaryForeground,
            "--muted": theme.muted,
            "--muted-foreground": theme.mutedForeground,
            "--accent": theme.secondary,
            "--accent-foreground": theme.secondaryForeground,
            "--border": theme.border,
            "--input": theme.border,
            "--ring": theme.primary,
            "--radius": `${theme.radius}px`,
            "--font-display": theme.fontDisplay,
            "--font-body": theme.fontBody,
            "--font-mono": theme.fontMono,
            fontFamily: theme.fontBody,
            color: theme.foreground,
            height: "100%",
            width: "100%",
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
