import type { AgeBucket, DueModel } from "./types";

const MS_PER_DAY = 86400000;

export function ageBucket(
  dateIncurred: string,
  asOf: string,
  dueModel: DueModel,
): AgeBucket {
  if (dueModel === "when_able") return "pay-when-able";
  const start = new Date(`${dateIncurred.slice(0, 10)}T00:00:00.000Z`).getTime();
  const end = new Date(`${asOf.slice(0, 10)}T00:00:00.000Z`).getTime();
  const days = Math.floor((end - start) / MS_PER_DAY);
  if (days <= 30) return "0-30";
  if (days <= 90) return "30-90";
  return "90+";
}
