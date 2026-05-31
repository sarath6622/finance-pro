"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import {
  useObligations,
  type ApiObligation,
  type ObligationStatus,
} from "@/lib/api/obligations";
import { useCreateTransaction } from "@/lib/api/transactions";
import { ApiClientError } from "@/lib/api/client";
import { defaultDirectionFor } from "@/lib/flow/labels";

function statusColor(s: ObligationStatus): "default" | "warning" | "error" | "primary" {
  if (s === "overdue") return "error";
  if (s === "due_today") return "warning";
  if (s === "upcoming") return "primary";
  return "default";
}

function statusLabel(s: ObligationStatus): string {
  if (s === "due_today") return "due today";
  if (s === "overdue") return "overdue";
  return s;
}

export function ObligationsCard() {
  const { data, isLoading, error } = useObligations({ horizonDays: 30 });
  const create = useCreateTransaction();
  const [busy, setBusy] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  async function markPaid(o: ApiObligation, paidOnExpected: boolean) {
    const key = `${o.ruleId}-${o.expectedDate}`;
    setBusy(key);
    setOpError(null);
    try {
      const valueDate = paidOnExpected ? o.expectedDate : todayIst();
      await create.mutateAsync({
        valueDate,
        amountPaise: o.amountPaise,
        direction: defaultDirectionFor(o.flowType),
        flowType: o.flowType,
        accountId: o.accountId,
        ...(o.counterpartyId ? { counterpartyId: o.counterpartyId } : {}),
        ...(o.categoryId ? { categoryId: o.categoryId } : {}),
        recurringRuleId: o.ruleId,
        description: o.ruleLabel,
      });
    } catch (e) {
      setOpError(e instanceof ApiClientError ? e.message : "Failed to record payment");
    } finally {
      setBusy(null);
    }
  }

  const arrearsTotal =
    data?.arrears.reduce((s, o) => s + o.amountPaise, 0) ?? 0;
  const items: ApiObligation[] = [
    ...(data?.arrears ?? []),
    ...(data?.upcoming ?? []),
  ];

  return (
    <Stack spacing={2}>
      {data && data.arrears.length > 0 && (
        <Alert severity="error">
          <AlertTitle>
            {data.arrears.length} overdue obligation{data.arrears.length > 1 ? "s" : ""} —{" "}
            <MoneyDisplay paise={arrearsTotal} monospace />
          </AlertTitle>
          Skipped cycles with arrears policy set to accumulate. Mark paid from the list below.
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="h2">Obligations</Typography>
            <Typography variant="body2" color="text.secondary">
              {data ? `as of ${data.asOf}` : ""}
            </Typography>
          </Stack>
          {isLoading && <Typography variant="body2">Loading…</Typography>}
          {error && <Alert severity="error">{(error as Error).message}</Alert>}
          {opError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {opError}
            </Alert>
          )}
          {!isLoading && items.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No upcoming or overdue obligations in the next 30 days.
            </Typography>
          )}
          <Stack divider={<Divider />}>
            {items.map((o) => {
              const key = `${o.ruleId}-${o.expectedDate}`;
              return (
                <Stack
                  key={key}
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ py: 1.5 }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1" noWrap>
                        {o.ruleLabel}
                      </Typography>
                      <Chip
                        size="small"
                        color={statusColor(o.status)}
                        label={statusLabel(o.status)}
                      />
                      {o.cycleIndex && o.totalCycles && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${o.cycleIndex} of ${o.totalCycles}`}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {o.expectedDate}
                    </Typography>
                  </Box>
                  <MoneyDisplay paise={o.amountPaise} monospace />
                  <Button
                    size="small"
                    variant="contained"
                    disabled={busy === key}
                    onClick={() => markPaid(o, o.status === "overdue")}
                  >
                    {busy === key ? "…" : "Mark paid"}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
