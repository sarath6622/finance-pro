"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useSettings, useUpdateSettings } from "@/lib/api/settings";
import {
  currentPermission,
  isIos,
  notificationSupport,
  requestPermission,
  type PermissionResult,
} from "@/lib/notifications/permission";

export function NotificationSection() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [permission, setPermission] = useState<PermissionResult>("default");
  const [reminderTime, setReminderTime] = useState<string>("21:00");
  const [enabled, setEnabled] = useState<boolean>(false);
  const supportState = useMemo(() => notificationSupport(), []);
  const ios = useMemo(() => isIos(), []);

  useEffect(() => {
    setPermission(currentPermission());
  }, []);

  useEffect(() => {
    if (settings) {
      setReminderTime(settings.reminderTime);
      setEnabled(settings.notifyEnabled);
    }
  }, [settings]);

  const dirty =
    !!settings &&
    (settings.reminderTime !== reminderTime || settings.notifyEnabled !== enabled);

  async function handleEnableToggle(next: boolean) {
    setEnabled(next);
    if (next && permission !== "granted" && supportState === "supported") {
      const result = await requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setEnabled(false);
      }
    }
  }

  function save() {
    update.mutate({ reminderTime, notifyEnabled: enabled });
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h2">Daily reminder</Typography>
          <Typography variant="body2" color="text.secondary">
            A local notification at your chosen time, nudging you to log the day.
          </Typography>

          {supportState === "unsupported" && (
            <Alert severity="warning">
              This browser doesn&apos;t support notifications. Try Chrome or Edge
              on desktop, or install the app to your home screen on mobile.
            </Alert>
          )}

          {ios && supportState === "supported" && (
            <Alert severity="info">
              <strong>On iPhone/iPad:</strong> install to your Home Screen first
              (Share → Add to Home Screen). Even then, iOS only delivers
              reminders while the app is open or recently backgrounded —
              closed-app reminders need server push, which isn&apos;t built yet.
            </Alert>
          )}

          {permission === "denied" && (
            <Alert severity="warning">
              Notifications are blocked for this site. Re-enable them in your
              browser&apos;s site settings, then toggle this on.
            </Alert>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(_, v) => void handleEnableToggle(v)}
                disabled={supportState === "unsupported"}
              />
            }
            label="Send a daily reminder"
          />

          <TextField
            label="Reminder time (24-hour HH:MM)"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            inputProps={{ inputMode: "numeric", pattern: "[0-2][0-9]:[0-5][0-9]" }}
            sx={{ maxWidth: { sm: 240 } }}
            fullWidth
            disabled={!enabled}
          />

          <Stack direction="row">
            <Button
              variant="contained"
              onClick={save}
              disabled={!dirty || update.isPending}
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
