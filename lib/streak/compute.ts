/**
 * FR-31 — lightweight "logged N days" streak indicator.
 *
 * A "logged day" = at least one *manual* (non-recurring-auto), non-deleted
 * transaction with `valueDate` equal to that day. Recurring-auto rows
 * don't count because they don't reflect a user's daily attention.
 *
 * Pure — no `Date.now()`, no DB. Inject `today` so this is testable in
 * frozen time. Day arithmetic is calendar-day in IST (the app's chosen
 * timezone; valueDate is stored as IST-normalized YYYY-MM-DD per
 * CLAUDE.md invariant #7), so simple string comparison suffices.
 */

import type { TxnSource } from "@/lib/schemas/common";

export interface StreakTxn {
  valueDate: string; // 'YYYY-MM-DD'
  source: TxnSource;
  isDeleted: boolean;
}

export interface StreakResult {
  /** Consecutive days logged ending at today (or yesterday — see below). */
  current: number;
  /** Longest run anywhere in history. */
  longest: number;
  /** Most recent date with a manual log, or null if none. */
  lastLoggedDate: string | null;
}

const AUTO_SOURCES: ReadonlySet<TxnSource> = new Set<TxnSource>(["recurring"]);

function isManualLog(t: StreakTxn): boolean {
  if (t.isDeleted) return false;
  return !AUTO_SOURCES.has(t.source);
}

function shiftDay(yyyyMmDd: string, deltaDays: number): string {
  // Parse as UTC noon to dodge DST surprises; we only care about the
  // YYYY-MM-DD output.
  const d = new Date(`${yyyyMmDd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(
  txns: readonly StreakTxn[],
  today: string,
): StreakResult {
  const loggedDays = new Set<string>();
  let lastLoggedDate: string | null = null;
  for (const t of txns) {
    if (!isManualLog(t)) continue;
    const day = t.valueDate.slice(0, 10);
    loggedDays.add(day);
    if (lastLoggedDate === null || day > lastLoggedDate) lastLoggedDate = day;
  }

  if (loggedDays.size === 0) {
    return { current: 0, longest: 0, lastLoggedDate: null };
  }

  // Current streak: walk back from today. If today isn't logged but
  // yesterday is, the streak is still "alive" — start counting from
  // yesterday. If neither today nor yesterday is logged, current = 0.
  let cursor: string;
  if (loggedDays.has(today)) {
    cursor = today;
  } else {
    const yesterday = shiftDay(today, -1);
    cursor = loggedDays.has(yesterday) ? yesterday : "";
  }
  let current = 0;
  while (cursor && loggedDays.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  // Longest: linear scan over sorted unique days, count consecutive runs.
  const sorted = [...loggedDays].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (shiftDay(prev, 1) === cur) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest, lastLoggedDate };
}
