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
import Typography from "@mui/material/Typography";
import { MoneyInput } from "@/components/MoneyInput";
import { CounterpartyPicker } from "@/components/CounterpartyPicker";
import { DueModelSelector } from "@/components/DueModelSelector";
import { useImportReceivable, type DueModel } from "@/lib/api/receivables";

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportReceivableDialog({ open, onClose }: Props) {
  const importRec = useImportReceivable();
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [principalPaise, setPrincipalPaise] = useState<number | null>(null);
  const [dateIncurred, setDateIncurred] = useState(todayIst);
  const [dueModel, setDueModel] = useState<DueModel>("none");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      importRec.reset();
      setCounterpartyId(null);
      setPrincipalPaise(null);
      setDateIncurred(todayIst());
      setDueModel("none");
      setExpectedReturnDate("");
      setNotes("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit =
    !!counterpartyId &&
    principalPaise !== null &&
    principalPaise > 0 &&
    !!dateIncurred &&
    (dueModel !== "on_date" || !!expectedReturnDate) &&
    !importRec.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await importRec.mutateAsync({
        counterpartyId: counterpartyId!,
        principalPaise: principalPaise!,
        dateIncurred,
        dueModel,
        ...(dueModel === "on_date" && expectedReturnDate
          ? { expectedReturnDate }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Import existing loan</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Record a loan that pre-dates this tracker. Creates a receivable
            without <strong>debiting any bank account</strong> — the money already
            left your account before you started using this app. When the
            repayment arrives, mark it from the lending page; that will hit
            your bank correctly.
          </Alert>
          <CounterpartyPicker
            value={counterpartyId}
            onChange={(cp) => setCounterpartyId(cp?._id ?? null)}
            label="Who owes you?"
          />
          <MoneyInput
            label="Principal (₹)"
            valuePaise={principalPaise ?? 0}
            onChangePaise={(v) => setPrincipalPaise(v ?? 0)}
            fullWidth
          />
          <TextField
            label="Date the loan was given"
            type="date"
            value={dateIncurred}
            onChange={(e) => setDateIncurred(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Drives aging — 0-30d / 30-90d / 90+d buckets"
          />
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              When do you expect this back?
            </Typography>
            <DueModelSelector value={dueModel} onChange={setDueModel} />
            {dueModel === "on_date" && (
              <TextField
                label="Expected return date"
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mt: 1 }}
              />
            )}
          </Stack>
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 2000 }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          {importRec.error && (
            <Alert severity="error">{(importRec.error as Error).message}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {importRec.isPending ? "Importing…" : "Import"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
