/**
 * Browser-bound notification glue. Pure scheduling math lives in
 * `./schedule.ts` and is unit-tested there.
 *
 * v1 limitation (documented for the user in the Settings UI):
 *   notifications fire only while the app is open or backgrounded.
 *   When the tab/PWA is closed, the `setTimeout` underneath dies and
 *   nothing fires — true closed-app reminders require Web Push, which
 *   is explicitly deferred.
 */

import { msUntilNextFire } from "./schedule";

export type PermissionResult =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export function notificationSupport(): "supported" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  return "Notification" in window ? "supported" : "unsupported";
}

export function currentPermission(): PermissionResult {
  if (notificationSupport() === "unsupported") return "unsupported";
  return Notification.permission;
}

export async function requestPermission(): Promise<PermissionResult> {
  if (notificationSupport() === "unsupported") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export interface DailyReminderHandle {
  /** Cancel any pending timer. Idempotent. */
  cancel: () => void;
}

export interface StartDailyReminderOptions {
  time: string; // HH:MM
  title?: string;
  body?: string;
  icon?: string;
  onFire?: () => void;
}

/**
 * Schedules a recurring local notification at the user's chosen HH:MM
 * using nested `setTimeout` (re-arms itself on each fire so a long
 * clock drift can't desync it).
 *
 * No-op when permission isn't granted; the caller is responsible for
 * the permission flow.
 */
export function startDailyReminder(
  opts: StartDailyReminderOptions,
): DailyReminderHandle {
  if (notificationSupport() === "unsupported" || Notification.permission !== "granted") {
    return { cancel: () => undefined };
  }

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  function arm() {
    if (cancelled) return;
    const delay = msUntilNextFire(new Date(), opts.time);
    timerId = setTimeout(() => {
      if (cancelled) return;
      try {
        new Notification(opts.title ?? "Log your day", {
          body: opts.body ?? "Add today's transactions to keep your streak alive.",
          icon: opts.icon ?? "/icon-192.png",
          tag: "finance-daily-reminder",
          renotify: true,
        } as NotificationOptions);
        opts.onFire?.();
      } catch {
        /* showing notification can throw in restricted contexts; ignore */
      }
      arm();
    }, delay);
  }

  arm();

  return {
    cancel: () => {
      cancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}

/**
 * Heuristic — detect iOS so the Settings UI can warn that local
 * notifications won't fire when the PWA is fully closed (iOS Safari
 * doesn't keep service workers or page timers alive in the background).
 */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ identifies as Mac but has touch.
  return ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document;
}
