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
import { useTransferHolding } from "@/lib/api/holdings";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  holdingId: string;
  maxQty: number;
  currentPlatform: string;
}

export function TransferDialog({ open, onClose, holdingId, maxQty, currentPlatform }: Props) {
  const transfer = useTransferHolding(holdingId);
  const [date, setDate] = useState(todayIst);
  const [quantity, setQuantity] = useState<string>("");
  const [toPlatform, setToPlatform] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      transfer.reset();
      setDate(todayIst());
      setQuantity("");
      setToPlatform("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const qty = Number.parseFloat(quantity);
  const samePlatform = toPlatform.trim() === currentPlatform;
  const exceedsMax = Number.isFinite(qty) && qty > maxQty;
  const canSubmit =
    Number.isFinite(qty) &&
    qty > 0 &&
    !exceedsMax &&
    toPlatform.trim() !== "" &&
    !samePlatform &&
    !transfer.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await transfer.mutateAsync({
        date,
        quantity: qty,
        toPlatform: toPlatform.trim(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Transfer from {currentPlatform}</DialogTitle>
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
            helperText={exceedsMax ? `Max ${maxQty}` : `Available: ${maxQty}`}
          />
          <TextField
            label="To platform"
            value={toPlatform}
            onChange={(e) => setToPlatform(e.target.value)}
            placeholder="e.g. Ledger, Wallet, Zerodha"
            error={samePlatform}
            helperText={samePlatform ? "Pick a different platform" : "FIFO lots carved from source"}
          />
          <Alert severity="info">
            No realized P&L — cost basis is preserved. If a holding for the same
            symbol exists on the destination platform, lots are merged into it;
            otherwise a new holding is created.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {transfer.error && <Alert severity="error">{(transfer.error as Error).message}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {transfer.isPending ? "Transferring…" : "Transfer"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
