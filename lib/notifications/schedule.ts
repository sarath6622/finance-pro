/**
 * Pure scheduling math for the daily logging reminder (FR-30).
 *
 * Given an HH:MM string in the user's local timezone and a "now"
 * instant, returns the ms delay until the next fire. If the time has
 * already passed today, returns the delay to that time tomorrow.
 *
 * No `Date.now()` here — `now` is injected so tests can freeze time
 * (CLAUDE.md invariant #10: pure functions never reach for the clock).
 */

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export class InvalidReminderTimeError extends Error {
  constructor(input: string) {
    super(`Invalid reminder time '${input}'; expected HH:MM 24-hour`);
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseHhMm(input: string): { hour: number; minute: number } {
  if (!HHMM_RE.test(input)) throw new InvalidReminderTimeError(input);
  const [h, m] = input.split(":");
  return { hour: parseInt(h!, 10), minute: parseInt(m!, 10) };
}

/**
 * Build the next Date at the given local HH:MM, on or after `now`.
 * Local timezone of the device — Notification UX matches device clock.
 */
export function nextLocalFire(now: Date, time: string): Date {
  const { hour, minute } = parseHhMm(time);
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setTime(candidate.getTime() + MS_PER_DAY);
  }
  return candidate;
}

/** Ms delay until the next fire, given a clock reading and a target HH:MM. */
export function msUntilNextFire(now: Date, time: string): number {
  return nextLocalFire(now, time).getTime() - now.getTime();
}
