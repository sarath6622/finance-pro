export type PeriodMode = "calendar" | "pay_cycle";

export interface PeriodInput {
  mode: PeriodMode;
  anchorDay: number;
  year: number;
  month: number;
}

export interface Period {
  mode: PeriodMode;
  anchorDay: number;
  year: number;
  month: number;
  start: string;
  endInclusive: string;
  label: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function addDays(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function buildPeriod(input: PeriodInput): Period {
  const { mode, anchorDay, year, month } = input;
  if (month < 1 || month > 12) throw new Error(`invalid month: ${month}`);
  if (anchorDay < 1 || anchorDay > 31) throw new Error(`invalid anchorDay: ${anchorDay}`);

  if (mode === "calendar") {
    const last = daysInMonth(year, month);
    return {
      ...input,
      start: ymd(year, month, 1),
      endInclusive: ymd(year, month, last),
      label: `${MONTH_NAMES[month - 1]} ${year}`,
    };
  }

  // pay_cycle: starts at anchorDay of month, ends day-before anchorDay of next month
  const startDay = Math.min(anchorDay, daysInMonth(year, month));
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextStartDay = Math.min(anchorDay, daysInMonth(nextYear, nextMonth));
  const start = ymd(year, month, startDay);
  const endInclusive = addDays(ymd(nextYear, nextMonth, nextStartDay), -1);
  return {
    ...input,
    start,
    endInclusive,
    label: `${MONTH_NAMES[month - 1]} ${year} cycle`,
  };
}

export function periodForDate(
  iso: string,
  mode: PeriodMode,
  anchorDay: number,
): Period {
  const date = iso.slice(0, 10);
  if (mode === "calendar") {
    const [yStr, mStr] = date.split("-");
    return buildPeriod({
      mode,
      anchorDay,
      year: parseInt(yStr!, 10),
      month: parseInt(mStr!, 10),
    });
  }
  // pay_cycle: a date on or after the anchorDay belongs to that month's cycle;
  // a date before the anchorDay belongs to the previous month's cycle.
  const [yStr, mStr, dStr] = date.split("-");
  const year = parseInt(yStr!, 10);
  const month = parseInt(mStr!, 10);
  const day = parseInt(dStr!, 10);
  if (day >= Math.min(anchorDay, daysInMonth(year, month))) {
    return buildPeriod({ mode, anchorDay, year, month });
  }
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return buildPeriod({ mode, anchorDay, year: prevYear, month: prevMonth });
}

export function shiftPeriod(p: Period, delta: number): Period {
  const totalMonths = p.year * 12 + (p.month - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return buildPeriod({
    mode: p.mode,
    anchorDay: p.anchorDay,
    year: newYear,
    month: newMonth,
  });
}

export function isInPeriod(valueDate: string, p: Period): boolean {
  const d = valueDate.slice(0, 10);
  return d >= p.start && d <= p.endInclusive;
}

export function periodKey(p: Period): string {
  return `${p.year}-${pad2(p.month)}`;
}
