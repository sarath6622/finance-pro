"use client";

import { useEffect, useMemo, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { MoneyInput } from "@/components/MoneyInput";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { PeriodSelector, type PeriodSelectorState } from "@/components/PeriodSelector";
import { useCategories } from "@/lib/api/categories";
import {
  useBudgets,
  useDeleteBudget,
  useUpsertBudget,
  type ApiBudget,
} from "@/lib/api/budgets";

function todayIst(): { year: number; month: number } {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function monthStr(p: PeriodSelectorState): string {
  return `${p.year}-${pad2(p.month)}`;
}

const SPEND_LIKE_FLOWS = new Set<string | undefined>([undefined, "spend", "fee"]);

export function BudgetsScreen() {
  const today = useMemo(todayIst, []);
  const [period, setPeriod] = useState<PeriodSelectorState>({
    year: today.year,
    month: today.month,
    mode: "calendar",
  });
  const month = monthStr(period);

  const { data: categories = [] } = useCategories();
  const { data: budgets = [], isLoading } = useBudgets(month);
  const upsert = useUpsertBudget();
  const del = useDeleteBudget();
  const [error, setError] = useState<string | null>(null);

  const budgetByCat = useMemo(
    () => new Map(budgets.map((b: ApiBudget) => [b.categoryId, b])),
    [budgets],
  );

  const spendCats = useMemo(
    () =>
      categories
        .filter((c) => SPEND_LIKE_FLOWS.has(c.defaultFlowType))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  async function save(categoryId: string, amountPaise: number, rollover: boolean) {
    setError(null);
    try {
      await upsert.mutateAsync({ categoryId, month, amountPaise, rollover });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function remove(budgetId: string) {
    setError(null);
    try {
      await del.mutateAsync(budgetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} spacing={2}>
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          Budgets
        </Typography>
        <PeriodSelector
          value={period}
          onChange={(p) => setPeriod({ ...p, mode: "calendar" })}
          label={undefined}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Budgets are stored per calendar month (YYYY-MM). On the dashboard you can view actuals in
        calendar or pay-cycle mode.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          {isLoading && <Typography variant="body2">Loading…</Typography>}
          <Stack divider={<Divider />}>
            {spendCats.map((c) => {
              const existing = budgetByCat.get(c._id) ?? null;
              return (
                <BudgetRow
                  key={c._id}
                  categoryName={c.name}
                  existing={existing}
                  onSave={(amountPaise, rollover) => save(c._id, amountPaise, rollover)}
                  onDelete={() => existing && remove(existing._id)}
                />
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

interface BudgetRowProps {
  categoryName: string;
  existing: ApiBudget | null;
  onSave: (amountPaise: number, rollover: boolean) => void;
  onDelete: () => void;
}

function BudgetRow({ categoryName, existing, onSave, onDelete }: BudgetRowProps) {
  const [amount, setAmount] = useState<number | null>(existing?.amountPaise ?? null);
  const [rollover, setRollover] = useState<boolean>(existing?.rollover ?? false);

  useEffect(() => {
    setAmount(existing?.amountPaise ?? null);
    setRollover(existing?.rollover ?? false);
  }, [existing?._id, existing?.amountPaise, existing?.rollover]);

  function commit() {
    const value = amount ?? 0;
    if (value === 0 && !existing) return; // don't create a zero-budget row
    if (existing && value === existing.amountPaise && rollover === existing.rollover) return;
    onSave(value, rollover);
  }

  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1.5 }}>
      <Typography sx={{ minWidth: 200, flexGrow: 1 }}>{categoryName}</Typography>
      <MoneyInput
        valuePaise={amount}
        onChangePaise={(v) => {
          setAmount(v);
        }}
        size="small"
        sx={{ width: 180 }}
        placeholder="No budget"
        onBlur={commit}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={rollover}
            onChange={(_e, v) => {
              setRollover(v);
              if (existing) onSave(existing.amountPaise, v);
            }}
          />
        }
        label="Rollover"
        sx={{ minWidth: 110 }}
      />
      <Box sx={{ minWidth: 100, textAlign: "right" }}>
        {existing && <MoneyDisplay paise={existing.amountPaise} monospace />}
      </Box>
      <IconButton size="small" onClick={onDelete} disabled={!existing}>
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
