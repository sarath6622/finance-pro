"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { MoneyInput } from "@/components/MoneyInput";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AccountPicker } from "@/components/AccountPicker";
import { useBuyHolding } from "@/lib/api/holdings";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  holdingId: string;
  symbol: string;
}

export function BuyDialog({ open, onClose, holdingId, symbol }: Props) {
  const buy = useBuyHolding(holdingId);
  const [date, setDate] = useState(todayIst);
  const [quantity, setQuantity] = useState<string>("");
  const [unitCostPaise, setUnitCostPaise] = useState<number | null>(null);
  const [payerAccountId, setPayerAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      buy.reset();
      setDate(todayIst());
      setQuantity("");
      setUnitCostPaise(null);
      setPayerAccountId(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const qty = Number.parseFloat(quantity);
  const total =
    Number.isFinite(qty) && unitCostPaise !== null ? Math.round(qty * unitCostPaise) : 0;
  const canSubmit =
    Number.isFinite(qty) && qty > 0 && unitCostPaise !== null && unitCostPaise > 0 && !!payerAccountId && !buy.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await buy.mutateAsync({
        date,
        quantity: qty,
        unitCostPaise: unitCostPaise!,
        payerAccountId: payerAccountId!,
        description: `Buy ${qty} ${symbol}`,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buy failed");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Buy {symbol}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputProps={{ inputMode: "decimal", step: "0.00000001", min: 0 }}
            helperText="Up to 8 decimals for crypto"
          />
          <MoneyInput
            label="Unit cost (₹/unit)"
            valuePaise={unitCostPaise ?? 0}
            onChangePaise={(v) => setUnitCostPaise(v ?? 0)}
            fullWidth
          />
          <AccountPicker
            value={payerAccountId}
            onChange={setPayerAccountId}
            label="Pay from"
            required
          />
          <Alert severity="info">
            Total: <MoneyDisplay paise={total} monospace />
            {Number.isFinite(qty) && qty > 0 && unitCostPaise && (
              <> · {qty.toLocaleString("en-IN", { maximumFractionDigits: 8 })} × <MoneyDisplay paise={unitCostPaise} /></>
            )}
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {buy.error && <Alert severity="error">{(buy.error as Error).message}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {buy.isPending ? "Saving…" : "Buy"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
