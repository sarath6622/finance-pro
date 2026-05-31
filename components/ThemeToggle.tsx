"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import { useThemeMode } from "./ThemeModeProvider";

/** Toolbar icon button. Cycles: system → light → dark → system. */
export function ThemeToggleButton() {
  const { preference, resolvedMode, setPreference } = useThemeMode();
  const next: Record<typeof preference, typeof preference> = {
    system: "light",
    light: "dark",
    dark: "system",
  };
  const label =
    preference === "system"
      ? `System (${resolvedMode})`
      : preference === "dark"
        ? "Dark"
        : "Light";
  const Icon =
    preference === "system"
      ? SettingsBrightnessIcon
      : preference === "dark"
        ? DarkModeIcon
        : LightModeIcon;
  return (
    <Tooltip title={`Theme: ${label} — click for next`}>
      <IconButton
        size="small"
        onClick={() => setPreference(next[preference])}
        aria-label={`Theme: ${label}`}
        color="inherit"
      >
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
