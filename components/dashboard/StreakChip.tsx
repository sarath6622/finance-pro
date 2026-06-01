"use client";

import { useMemo } from "react";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartmentOutlined";
import { useTransactions } from "@/lib/api/transactions";
import { computeStreak, type StreakTxn } from "@/lib/streak/compute";

function todayIstYmd(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function StreakChip() {
  // Pulls the most recent 500 txns; enough to compute a multi-month
  // streak for any single-owner-app cadence. The cache-bridge means
  // this hits idb when offline.
  const { data } = useTransactions({ limit: 500 });
  const today = useMemo(todayIstYmd, []);

  const result = useMemo(() => {
    const items = data?.items ?? [];
    const txns: StreakTxn[] = items.map((t) => ({
      valueDate: t.valueDate,
      source: t.source,
      isDeleted: t.isDeleted,
    }));
    return computeStreak(txns, today);
  }, [data, today]);

  if (result.current === 0 && result.longest === 0) return null;

  const label =
    result.current > 0
      ? `${result.current}-day streak`
      : `Last logged ${result.lastLoggedDate}`;
  const tooltip =
    result.current > 0
      ? `Longest streak: ${result.longest} days. Keep it alive by adding today.`
      : `Streak broken. Best ever: ${result.longest} days.`;

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        size="small"
        color={result.current > 0 ? "warning" : "default"}
        variant={result.current > 0 ? "filled" : "outlined"}
        icon={<LocalFireDepartmentIcon fontSize="small" />}
        label={label}
      />
    </Tooltip>
  );
}
