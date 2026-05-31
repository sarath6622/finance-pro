"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1F6FEB" },
    secondary: { main: "#7C3AED" },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    background: { default: "#F7F8FA", paper: "#FFFFFF" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: "1.75rem", fontWeight: 700 },
    h2: { fontSize: "1.4rem", fontWeight: 700 },
    h3: { fontSize: "1.15rem", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", borderRadius: 10 } },
    },
    MuiCard: {
      styleOverrides: { root: { boxShadow: "0 1px 3px rgba(16,24,40,0.08)" } },
    },
  },
});
