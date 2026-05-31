"use client";

import { createTheme, type Theme } from "@mui/material/styles";

export type PaletteMode = "light" | "dark";

const SHARED_TYPOGRAPHY = {
  fontFamily:
    'var(--font-inter), "Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  h1: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" },
  h2: { fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.015em" },
  h3: { fontSize: "1.15rem", fontWeight: 600, letterSpacing: "-0.01em" },
  button: { fontWeight: 600, letterSpacing: 0 },
} as const;

function paletteFor(mode: PaletteMode) {
  if (mode === "dark") {
    return {
      mode,
      primary: { main: "#22C55E", dark: "#16A34A", light: "#4ADE80" },
      secondary: { main: "#16A34A" },
      success: { main: "#22C55E" },
      warning: { main: "#F59E0B" },
      error: { main: "#EF4444" },
      background: { default: "#050505", paper: "#111111" },
      divider: "#262626",
      text: { primary: "#FFFFFF", secondary: "#A3A3A3", disabled: "#737373" },
    };
  }
  return {
    mode,
    primary: { main: "#22C55E", dark: "#16A34A", light: "#4ADE80" },
    secondary: { main: "#16A34A" },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    background: { default: "#F7F8FA", paper: "#FFFFFF" },
  };
}

export function getTheme(mode: PaletteMode): Theme {
  const isDark = mode === "dark";
  return createTheme({
    palette: paletteFor(mode),
    shape: { borderRadius: 12 },
    typography: SHARED_TYPOGRAPHY,
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: "none", borderRadius: 10 } },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: isDark ? "none" : "0 1px 3px rgba(16,24,40,0.08)",
            backgroundImage: "none",
            border: isDark ? "1px solid #262626" : undefined,
            borderRadius: 20,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
    },
  });
}

/** @deprecated Prefer `useThemeMode()` + `getTheme(mode)` — kept for legacy imports. */
export const theme = getTheme("light");
