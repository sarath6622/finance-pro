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
import { useUpdatePrice, type PriceCurrency } from "@/lib/api/holdings";

interface Props {
  open: boolean;
  onClose: () => void;
  holdingId: string;
  priceCurrency: PriceCurrency;
}

export function PriceDialog({ open, onClose, holdingId, priceCurrency }: Props) {
  const update = useUpdatePrice(holdingId);
  const [unitPricePaise, setUnitPricePaise] = useState<number | null>(null);
  const [fxRate, setFxRate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      update.reset();
      setUnitPricePaise(null);
      setFxRate("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fxNum = Number.parseFloat(fxRate);
  const usdRequiresFx = priceCurrency === "USD" && (!Number.isFinite(fxNum) || fxNum <= 0);
  const canSubmit =
    unitPricePaise !== null && unitPricePaise > 0 && !usdRequiresFx && !update.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await update.mutateAsync({
        unitPricePaise: unitPricePaise!,
        source: "manual",
        ...(priceCurrency === "USD" ? { fxRateToInr: fxNum, priceCurrency: "USD" } : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Price update failed");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Update price</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <MoneyInput
            label={priceCurrency === "USD" ? "Price (USD/unit, ×100)" : "Price (₹/unit)"}
            valuePaise={unitPricePaise ?? 0}
            onChangePaise={(v) => setUnitPricePaise(v ?? 0)}
            fullWidth
          />
          {priceCurrency === "USD" && (
            <TextField
              label="FX rate (INR per 1 USD)"
              type="number"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              inputProps={{ inputMode: "decimal", step: "0.01", min: 0 }}
              helperText="Required for USD-priced holdings"
              error={usdRequiresFx && fxRate !== ""}
            />
          )}
          <Alert severity="info">
            Source <strong>manual</strong> — overrides anything an auto-feed would
            otherwise set (E30). Stale-after-24h badge resets on save.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {update.error && <Alert severity="error">{(update.error as Error).message}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
