"use client";

import { useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { MoneyInput } from "@/components/MoneyInput";
import { useThemeMode, type ThemePreference } from "@/components/ThemeModeProvider";
import { useSettings, useUpdateSettings } from "@/lib/api/settings";
import { AccountsSection } from "./AccountsSection";
import { CounterpartiesSection } from "./CounterpartiesSection";
import { CategoriesSection } from "./CategoriesSection";
import { NotificationSection } from "./NotificationSection";

export function SettingsScreen() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { preference: themePref, resolvedMode, setPreference: setThemePref } = useThemeMode();
  const [floorPaise, setFloorPaise] = useState<number | null>(null);
  const [payday, setPayday] = useState<number>(5);
  const [payCycleMode, setPayCycleMode] = useState<"calendar" | "pay_cycle">("pay_cycle");

  useEffect(() => {
    if (settings) {
      setFloorPaise(settings.liquidityFloorPaise);
      setPayday(settings.paydayDayOfMonth);
      setPayCycleMode(settings.payCycleMode);
    }
  }, [settings]);

  function save() {
    update.mutate({
      ...(floorPaise !== null ? { liquidityFloorPaise: floorPaise } : {}),
      paydayDayOfMonth: payday,
      payCycleMode,
    });
  }

  return (
    <Stack
      spacing={1.5}
      sx={{
        px: { xs: 2, md: 0 },
        py: { xs: 1.5, md: 3 },
        "& .MuiCardContent-root": {
          p: 1.5,
          "&:last-child": { pb: 1.5 },
        },
      }}
    >
      <Typography variant="h1">Settings</Typography>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h2">Appearance</Typography>
            <Typography variant="body2" color="text.secondary">
              Currently showing the <b>{resolvedMode}</b> theme.
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={themePref}
              onChange={(_, v) => v && setThemePref(v as ThemePreference)}
              sx={{ flexWrap: "wrap" }}
            >
              <ToggleButton value="system">System</ToggleButton>
              <ToggleButton value="light">Light</ToggleButton>
              <ToggleButton value="dark">Dark</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography variant="h2">Liquidity floor</Typography>
            <Typography variant="body2" color="text.secondary">
              Minimum cash you want to keep on hand before the next payday. We warn you
              when the cash-flow forecast dips below this, and lend-out actions that
              would push the projection below the floor will trigger a warning.
            </Typography>
            <MoneyInput
              label="Floor amount"
              valuePaise={floorPaise ?? 0}
              onChangePaise={(v) => setFloorPaise(v ?? 0)}
              fullWidth
            />

            <Typography variant="h2">Pay cycle</Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <TextField
                label="Payday day of month"
                type="number"
                inputProps={{ min: 1, max: 31 }}
                value={payday}
                onChange={(e) => setPayday(Number.parseInt(e.target.value, 10) || 1)}
                sx={{ maxWidth: { sm: 200 } }}
                fullWidth
              />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={payCycleMode}
                onChange={(_, v) => v && setPayCycleMode(v as "calendar" | "pay_cycle")}
              >
                <ToggleButton value="pay_cycle">Pay-cycle</ToggleButton>
                <ToggleButton value="calendar">Calendar</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Stack direction="row">
              <Button
                variant="contained"
                onClick={save}
                disabled={update.isPending}
              >
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <NotificationSection />

      <AccountsSection />
      <CounterpartiesSection />
      <CategoriesSection />
    </Stack>
  );
}
