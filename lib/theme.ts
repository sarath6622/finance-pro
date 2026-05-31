"use client";

import { createTheme, type Theme } from "@mui/material/styles";

export type PaletteMode = "light" | "dark";

const SHARED_TYPOGRAPHY = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  h1: { fontSize: "1.75rem", fontWeight: 700 },
  h2: { fontSize: "1.4rem", fontWeight: 700 },
  h3: { fontSize: "1.15rem", fontWeight: 600 },
} as const;

function paletteFor(mode: PaletteMode) {
  if (mode === "dark") {
    return {
      mode,
      primary: { main: "#60A5FA", dark: "#3B82F6", light: "#93C5FD" },
      secondary: { main: "#A78BFA" },
      success: { main: "#34D399" },
      warning: { main: "#FBBF24" },
      error: { main: "#F87171" },
      background: { default: "#0B0F17", paper: "#141B25" },
      divider: "rgba(255, 255, 255, 0.08)",
      text: { primary: "#E5E7EB", secondary: "#9CA3AF" },
    };
  }
  return {
    mode,
    primary: { main: "#1F6FEB" },
    secondary: { main: "#7C3AED" },
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
            boxShadow: isDark
              ? "0 1px 2px rgba(0,0,0,0.4)"
              : "0 1px 3px rgba(16,24,40,0.08)",
            backgroundImage: "none",
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
