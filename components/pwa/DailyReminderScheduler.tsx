"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/api/settings";
import {
  currentPermission,
  startDailyReminder,
} from "@/lib/notifications/permission";

/**
 * Mounted once inside the authenticated app shell. Re-arms the daily
 * notification timer whenever the user's reminder settings change.
 *
 * Renders nothing. The actual notification is fired by the in-process
 * `setTimeout` registered in `startDailyReminder`; this will not
 * deliver after the tab closes — by design for v1 (see FR-30 notes).
 */
export function DailyReminderScheduler() {
  const { data: settings } = useSettings();
  const reminderTime = settings?.reminderTime;
  const notifyEnabled = settings?.notifyEnabled;

  useEffect(() => {
    if (!notifyEnabled || !reminderTime) return;
    if (currentPermission() !== "granted") return;
    const handle = startDailyReminder({ time: reminderTime });
    return () => handle.cancel();
  }, [notifyEnabled, reminderTime]);

  return null;
}
