"use client";

import { useEffect, useState } from "react";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
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
import { useSellHolding } from "@/lib/api/holdings";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  holdingId: string;
  symbol: string;
  maxQty: number;
}

export function SellDialog({ open, onClose, holdingId, symbol, maxQty }: Props) {
  const sell = useSellHolding(holdingId);
  const [date, setDate] = useState(todayIst);
  const [quantity, setQuantity] = useState<string>("");
  const [unitPricePaise, setUnitPricePaise] = useState<number | null>(null);
  const [receiverAccountId, setReceiverAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      sell.reset();
      setDate(todayIst());
      setQuantity("");
      setUnitPricePaise(null);
      setReceiverAccountId(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const qty = Number.parseFloat(quantity);
  const total =
    Number.isFinite(qty) && unitPricePaise !== null ? Math.round(qty * unitPricePaise) : 0;
  const exceedsMax = Number.isFinite(qty) && qty > maxQty;
  const canSubmit =
    Number.isFinite(qty) &&
    qty > 0 &&
    !exceedsMax &&
    unitPricePaise !== null &&
    unitPricePaise > 0 &&
    !!receiverAccountId &&
    !sell.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await sell.mutateAsync({
        date,
        quantity: qty,
        unitPricePaise: unitPricePaise!,
        receiverAccountId: receiverAccountId!,
        description: `Sell ${qty} ${symbol}`,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sell failed");
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Sell {symbol} (have {maxQty.toLocaleString("en-IN", { maximumFractionDigits: 8 })})</DialogTitle>
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
            inputProps={{ inputMode: "decimal", step: "0.00000001", min: 0, max: maxQty }}
            error={exceedsMax}
            helperText={exceedsMax ? `Max ${maxQty}` : "FIFO — oldest lots sold first"}
          />
          <MoneyInput
            label="Sell price (₹/unit)"
            valuePaise={unitPricePaise ?? 0}
            onChangePaise={(v) => setUnitPricePaise(v ?? 0)}
            fullWidth
          />
          <AccountPicker
            value={receiverAccountId}
            onChange={setReceiverAccountId}
            label="Credit to"
            required
          />
          <Alert severity="info">
            Proceeds: <MoneyDisplay paise={total} monospace />
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {sell.error && <Alert severity="error">{(sell.error as Error).message}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={submit} disabled={!canSubmit}>
          {sell.isPending ? "Saving…" : "Sell"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
