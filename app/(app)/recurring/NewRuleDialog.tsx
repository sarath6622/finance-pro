"use client";

import { useState, type FormEvent } from "react";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { MoneyInput } from "@/components/MoneyInput";
import { AccountPicker } from "@/components/AccountPicker";
import { CounterpartyPicker } from "@/components/CounterpartyPicker";
import { CategoryPicker } from "@/components/CategoryPicker";
import { FlowTypeSelector } from "@/components/FlowTypeSelector";
import { useCreateRecurringRule } from "@/lib/api/recurring";
import { ApiClientError } from "@/lib/api/client";
import type { FlowType } from "@/lib/schemas/common";

const RECURRING_FLOWS: Array<{ value: FlowType; label: string }> = [
  { value: "family_support", label: "Family" },
  { value: "spend", label: "Spend" },
  { value: "investment", label: "Invest" },
  { value: "debt_repayment", label: "EMI" },
  { value: "income", label: "Income" },
];

export interface NewRuleDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewRuleDialog({ open, onClose }: NewRuleDialogProps) {
  const create = useCreateRecurringRule();
  const [label, setLabel] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [flowType, setFlowType] = useState<FlowType>("family_support");
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [dayOfMonth, setDayOfMonth] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>(() =>
    new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState<string>("");
  const [accumulate, setAccumulate] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLabel("");
    setAmountPaise(null);
    setCounterpartyId(null);
    setCategoryId(null);
    setEndDate("");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label) return setError("Label is required");
    if (!accountId) return setError("Pick an account");
    if (amountPaise === null || amountPaise <= 0) return setError("Amount must be > 0");
    try {
      await create.mutateAsync({
        label,
        accountId,
        flowType,
        amountPaise,
        frequency,
        ...(frequency === "monthly" ? { dayOfMonth } : {}),
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(counterpartyId ? { counterpartyId } : {}),
        ...(categoryId ? { categoryId } : {}),
        arrearsPolicy: accumulate ? "accumulate" : "skip",
      });
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to create");
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>New recurring rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Dad support, Rent, AC EMI"
              required
              autoFocus
            />
            <MoneyInput
              label="Amount per cycle"
              valuePaise={amountPaise}
              onChangePaise={setAmountPaise}
              required
              fullWidth
            />
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Flow type
              </Typography>
              <FlowTypeSelector
                value={flowType}
                onChange={setFlowType}
                options={RECURRING_FLOWS}
              />
            </Stack>
            <AccountPicker value={accountId} onChange={setAccountId} required />
            <CounterpartyPicker
              value={counterpartyId}
              onChange={(c) => setCounterpartyId(c?._id ?? null)}
            />
            <CategoryPicker value={categoryId} onChange={setCategoryId} flowType={flowType} />
            <Stack direction="row" spacing={2} alignItems="center">
              <ToggleButtonGroup
                size="small"
                exclusive
                value={frequency}
                onChange={(_e, v) => v && setFrequency(v)}
              >
                <ToggleButton value="monthly">Monthly</ToggleButton>
                <ToggleButton value="weekly">Weekly</ToggleButton>
              </ToggleButtonGroup>
              {frequency === "monthly" && (
                <TextField
                  label="Day of month"
                  type="number"
                  size="small"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                  inputProps={{ min: 1, max: 31 }}
                  sx={{ width: 130 }}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="End date (optional)"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
                helperText="E.g. last AC EMI"
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={accumulate}
                  onChange={(_e, v) => setAccumulate(v)}
                />
              }
              label={`Accumulate arrears${accumulate ? "" : " (off — skipped cycles ignored)"}`}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}
