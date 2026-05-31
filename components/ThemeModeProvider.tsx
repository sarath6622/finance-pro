"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PaletteMode } from "@/lib/theme";

export type ThemePreference = "system" | "light" | "dark";

interface Ctx {
  preference: ThemePreference;
  resolvedMode: PaletteMode;
  setPreference: (p: ThemePreference) => void;
}

const ThemeModeContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "finance.themePref";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function detectSystemMode(): PaletteMode {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemMode, setSystemMode] = useState<PaletteMode>("light");

  useEffect(() => {
    setPreferenceState(readStoredPreference());
    setSystemMode(detectSystemMode());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemMode(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, p);
    }
  }, []);

  const resolvedMode: PaletteMode = preference === "system" ? systemMode : preference;

  const value = useMemo<Ctx>(
    () => ({ preference, resolvedMode, setPreference }),
    [preference, resolvedMode, setPreference],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): Ctx {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside ThemeModeProvider");
  return ctx;
}
