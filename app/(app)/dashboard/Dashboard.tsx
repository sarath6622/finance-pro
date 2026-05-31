"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { PeriodSelector, type PeriodSelectorState } from "@/components/PeriodSelector";
import { useSettings } from "@/lib/api/settings";
import { useBudgetVsActual, useMonthOverview } from "@/lib/api/reports";
import type { BudgetVsActualRow } from "@/lib/api/reports";
import { ObligationsCard } from "./ObligationsCard";
import { OwedToMeTile } from "./OwedToMeTile";
import { NetWorthTile } from "./NetWorthTile";
import { LiquidityTile } from "./LiquidityTile";

function todayIst(): { year: number; month: number; day: number } {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function statusColor(s: BudgetVsActualRow["status"]): "success" | "error" | "default" {
  if (s === "under") return "success";
  if (s === "over") return "error";
  return "default";
}

export function Dashboard() {
  const { data: settings } = useSettings();
  const today = useMemo(todayIst, []);
  const [periodState, setPeriodState] = useState<PeriodSelectorState>({
    year: today.year,
    month: today.month,
    mode: "pay_cycle",
  });
  useEffect(() => {
    if (settings?.payCycleMode) {
      setPeriodState((prev) => ({ ...prev, mode: settings.payCycleMode }));
    }
  }, [settings?.payCycleMode]);

  const overview = useMonthOverview(periodState);
  const budgets = useBudgetVsActual(periodState);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} spacing={2}>
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          Dashboard
        </Typography>
        <PeriodSelector value={periodState} onChange={setPeriodState} />
      </Stack>

      {(overview.error || budgets.error) && (
        <Alert severity="error">
          {(overview.error as Error)?.message ?? (budgets.error as Error)?.message}
        </Alert>
      )}

      <NetWorthTile />
      <ObligationsCard />
      <LiquidityTile />
      <OwedToMeTile />

      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h2">Month overview</Typography>
            <Typography variant="caption" color="text.secondary">
              {overview.data
                ? `${overview.data.period.start} → ${overview.data.period.endInclusive}`
                : ""}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                md: "repeat(4, 1fr)",
              },
              gap: 1.5,
            }}
          >
            {overview.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <BucketTileSkeleton key={i} />
                ))
              : (
                <>
                  <BucketTile label="Income" paise={overview.data?.income ?? 0} positive />
                  <BucketTile
                    label="True spend"
                    paise={overview.data?.spend.total ?? 0}
                    hint={
                      overview.data
                        ? `need ${formatMini(overview.data.spend.need)} · want ${formatMini(overview.data.spend.want)}${overview.data.spend.unclassified ? ` · ?${formatMini(overview.data.spend.unclassified)}` : ""}`
                        : undefined
                    }
                    negative
                  />
                  <BucketTile label="Family support" paise={overview.data?.familySupport ?? 0} />
                  <BucketTile label="Debt repayment" paise={overview.data?.debtRepayment ?? 0} />
                  <BucketTile label="Investment" paise={overview.data?.investment ?? 0} />
                  <BucketTile
                    label="Lending out"
                    paise={overview.data?.lendingOut ?? 0}
                    hint="receivable, not spend"
                  />
                  <BucketTile
                    label="Card settlement"
                    paise={overview.data?.cardSettlement ?? 0}
                    hint="excluded from spend"
                  />
                  <BucketTile label="Fees" paise={overview.data?.spend.fee ?? 0} />
                </>
              )}
          </Box>
          {overview.data && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              {overview.data.txnCount} transactions in this period.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h2">Budget vs actual</Typography>
            {budgets.data && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "auto auto auto" },
                  gap: { xs: 1, sm: 2 },
                  mt: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Budgeted
                  </Typography>
                  <MoneyDisplay paise={budgets.data.totals.budgetedPaise} monospace />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Actual
                  </Typography>
                  <MoneyDisplay paise={budgets.data.totals.actualPaise} monospace />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Variance
                  </Typography>
                  <MoneyDisplay paise={budgets.data.totals.variancePaise} signed monospace />
                </Box>
              </Box>
            )}
          </Box>
          {budgets.isLoading && (
            <Stack divider={<Divider />}>
              {[0, 1, 2, 3].map((i) => (
                <Stack key={i} spacing={1} sx={{ py: 2 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Skeleton variant="text" width={140} height={24} />
                    <Skeleton variant="text" width={120} height={20} />
                  </Stack>
                  <Skeleton variant="rounded" height={8} sx={{ borderRadius: 999 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Skeleton variant="text" width={70} height={14} />
                    <Skeleton variant="text" width={80} height={14} />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
          {budgets.data && budgets.data.byCategory.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No budgets set for this period. Open <strong>Budgets</strong> to add some.
            </Typography>
          )}
          <Stack divider={<Divider />}>
            {budgets.data?.byCategory.map((row) => {
              const pct = Math.min(100, row.utilizationPct);
              return (
                <Stack key={row.categoryId} spacing={1} sx={{ py: 2 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1}
                  >
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ minWidth: 0 }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {row.categoryName}
                      </Typography>
                      <Chip
                        size="small"
                        color={statusColor(row.status)}
                        label={row.status}
                      />
                      {row.rollover && <Chip size="small" variant="outlined" label="rollover" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                      <MoneyDisplay paise={row.actualPaise} monospace /> /{" "}
                      <MoneyDisplay paise={row.budgetPaise} monospace />
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    color={row.status === "over" ? "error" : "primary"}
                    sx={{ height: 8, borderRadius: 999 }}
                  />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      {row.utilizationPct.toFixed(1)}% used
                    </Typography>
                    <Typography variant="caption" color={row.status === "over" ? "error" : "text.secondary"}>
                      <MoneyDisplay paise={row.variancePaise} signed monospace />
                    </Typography>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>

          {budgets.data && budgets.data.unbudgeted.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h3" gutterBottom>
                Unbudgeted activity
              </Typography>
              <Stack divider={<Divider />}>
                {budgets.data.unbudgeted.map((row) => (
                  <Stack
                    key={row.categoryId}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ py: 1 }}
                  >
                    <Typography variant="body2">{row.categoryName}</Typography>
                    <MoneyDisplay paise={row.actualPaise} monospace />
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

interface BucketTileProps {
  label: string;
  paise: number;
  hint?: string;
  positive?: boolean;
  negative?: boolean;
}

function BucketTileSkeleton() {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: "divider",
        bgcolor: (t) =>
          t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "background.default",
        minHeight: 88,
      }}
    >
      <Skeleton variant="text" width={70} height={14} />
      <Skeleton variant="text" width={100} height={32} sx={{ mt: 0.5 }} />
    </Box>
  );
}

function BucketTile({ label, paise, hint, positive, negative }: BucketTileProps) {
  const colorize = positive || negative;
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: "divider",
        bgcolor: (t) =>
          t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "background.default",
        minHeight: 88,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <MoneyDisplay paise={paise} size="large" colorize={colorize} monospace />
      </Box>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5, fontSize: "0.7rem", lineHeight: 1.3 }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function formatMini(paise: number): string {
  const abs = Math.abs(paise);
  const rupees = abs / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return `₹${rupees.toFixed(0)}`;
}
