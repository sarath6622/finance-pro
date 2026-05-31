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
import { useImportLot } from "@/lib/api/holdings";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  holdingId: string;
  symbol: string;
}

export function ImportLotDialog({ open, onClose, holdingId, symbol }: Props) {
  const importLot = useImportLot(holdingId);
  const [date, setDate] = useState(todayIst);
  const [quantity, setQuantity] = useState<string>("");
  const [unitCostPaise, setUnitCostPaise] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      importLot.reset();
      setDate(todayIst());
      setQuantity("");
      setUnitCostPaise(null);
      setNotes("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const qty = Number.parseFloat(quantity);
  const total =
    Number.isFinite(qty) && unitCostPaise !== null ? Math.round(qty * unitCostPaise) : 0;
  const canSubmit =
    Number.isFinite(qty) &&
    qty > 0 &&
    unitCostPaise !== null &&
    unitCostPaise > 0 &&
    !importLot.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await importLot.mutateAsync({
        date,
        quantity: qty,
        unitCostPaise: unitCostPaise!,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Import existing {symbol}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Backfill a position that pre-dates this tracker. Creates a FIFO lot
            with cost basis but <strong>no bank withdrawal</strong> — use this when
            the purchase already happened and you don&apos;t want to double-count
            the outflow.
          </Alert>
          <TextField
            label="Original purchase date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Drives FIFO ordering — earlier lots sell first"
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
            helperText="What you originally paid per unit. If unknown, use current market — realized P&L will be wrong when you sell."
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 2000 }}
          />
          <Alert severity="info">
            Cost basis: <MoneyDisplay paise={total} monospace />
            {Number.isFinite(qty) && qty > 0 && unitCostPaise && (
              <> · {qty.toLocaleString("en-IN", { maximumFractionDigits: 8 })} × <MoneyDisplay paise={unitCostPaise} /></>
            )}
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {importLot.error && (
            <Alert severity="error">{(importLot.error as Error).message}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {importLot.isPending ? "Importing…" : "Import"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
