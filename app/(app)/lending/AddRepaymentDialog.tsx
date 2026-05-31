"use client";

import { useEffect, useState, type FormEvent } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { MoneyInput } from "@/components/MoneyInput";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AccountPicker } from "@/components/AccountPicker";
import { useCreateTransaction } from "@/lib/api/transactions";
import { ApiClientError } from "@/lib/api/client";
import type { ApiReceivable } from "@/lib/api/receivables";

export interface AddRepaymentDialogProps {
  receivable: ApiReceivable | null;
  onClose: () => void;
}

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function AddRepaymentDialog({ receivable, onClose }: AddRepaymentDialogProps) {
  const open = !!receivable;
  const create = useCreateTransaction();
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [valueDate, setValueDate] = useState<string>(todayIst());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [acceptOver, setAcceptOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (receivable) {
      setAmountPaise(receivable.outstandingPaise);
      setValueDate(todayIst());
      setAccountId(receivable.accountId ?? null);
      setNotes("");
      setAcceptOver(false);
      setError(null);
    }
  }, [receivable?._id, receivable?.outstandingPaise, receivable?.accountId, receivable]);

  if (!receivable) return null;

  const isOverpayment =
    amountPaise !== null && amountPaise > receivable.outstandingPaise;
  const overBy = isOverpayment
    ? amountPaise! - receivable.outstandingPaise
    : 0;
  const canSubmit =
    !!accountId && amountPaise !== null && amountPaise > 0 && (!isOverpayment || acceptOver);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!receivable) return;
    if (!accountId) return setError("Pick an account");
    if (amountPaise === null || amountPaise <= 0) return setError("Amount must be > 0");
    const flowType =
      receivable.kind === "split_iou" ? "reimbursement_in" : "lending_repaid";
    try {
      await create.mutateAsync({
        valueDate,
        amountPaise,
        direction: "in",
        flowType,
        accountId,
        counterpartyId: receivable.counterpartyId,
        receivableId: receivable._id,
        ...(notes ? { notes } : {}),
        ...(isOverpayment ? { acceptOverpayment: true } : {}),
      } as Parameters<typeof create.mutateAsync>[0]);
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to record repayment");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>
          Add repayment · outstanding <MoneyDisplay paise={receivable.outstandingPaise} monospace />
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <MoneyInput
              label="Amount received"
              valuePaise={amountPaise}
              onChangePaise={setAmountPaise}
              required
              fullWidth
              autoFocus
            />
            {isOverpayment && (
              <Alert severity="warning">
                Overpayment by <MoneyDisplay paise={overBy} />. Will be flagged as an advance on
                the receivable.
                <FormControlLabel
                  sx={{ mt: 1, display: "flex" }}
                  control={
                    <Checkbox
                      size="small"
                      checked={acceptOver}
                      onChange={(_e, v) => setAcceptOver(v)}
                    />
                  }
                  label="Record as advance"
                />
              </Alert>
            )}
            <TextField
              label="Value date"
              type="date"
              value={valueDate}
              onChange={(e) => setValueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <AccountPicker value={accountId} onChange={setAccountId} required />
            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Saving…" : "Save repayment"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
