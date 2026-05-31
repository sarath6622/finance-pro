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
import { useSettings, useUpdateSettings } from "@/lib/api/settings";

export function SettingsScreen() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [floorPaise, setFloorPaise] = useState<number | null>(null);
  const [payday, setPayday] = useState<number>(5);
  const [reminderTime, setReminderTime] = useState<string>("21:00");
  const [payCycleMode, setPayCycleMode] = useState<"calendar" | "pay_cycle">("pay_cycle");

  useEffect(() => {
    if (settings) {
      setFloorPaise(settings.liquidityFloorPaise);
      setPayday(settings.paydayDayOfMonth);
      setReminderTime(settings.reminderTime);
      setPayCycleMode(settings.payCycleMode);
    }
  }, [settings]);

  function save() {
    update.mutate({
      ...(floorPaise !== null ? { liquidityFloorPaise: floorPaise } : {}),
      paydayDayOfMonth: payday,
      reminderTime,
      payCycleMode,
    });
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h1">Settings</Typography>

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
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Payday day of month"
                type="number"
                inputProps={{ min: 1, max: 31 }}
                value={payday}
                onChange={(e) => setPayday(Number.parseInt(e.target.value, 10) || 1)}
                sx={{ maxWidth: 200 }}
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

            <TextField
              label="Reminder time (HH:MM 24-hour, ships in P10)"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              sx={{ maxWidth: 240 }}
            />

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
    </Stack>
  );
}
