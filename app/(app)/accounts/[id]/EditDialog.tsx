"use client";

import { useEffect, useState } from "react";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import type { ApiTransaction } from "@/lib/api/types";
import { MoneyInput } from "@/components/MoneyInput";
import { AccountPicker } from "@/components/AccountPicker";
import { useUpdateTransaction } from "@/lib/api/transactions";
import { ApiClientError } from "@/lib/api/client";

export interface EditDialogProps {
  txn: ApiTransaction | null;
  /** True when this txn has live split children — server blocks most edits. */
  isContainer?: boolean;
  onClose: () => void;
}

/**
 * Returns a reason the account cannot be moved on this txn, or null if it can.
 * Mirrors the server-side rules in /api/transactions/[id]/route.ts so the UI
 * doesn't promise something the API will 409 on.
 */
function accountLockReason(
  txn: ApiTransaction,
  isContainer: boolean,
): string | null {
  if (isContainer) {
    return "Split-parent containers can only edit description / notes / date. Move the children individually instead.";
  }
  if (txn.receivableId) {
    return "Receivable-linked transactions (loans, repayments, IOUs) can't change account. Delete and re-create on the right account.";
  }
  if (txn.flowType === "transfer") {
    return "Transfer legs are paired — moving one leg would break the link. Delete the transfer and re-create it.";
  }
  return null;
}

export function EditDialog({ txn, isContainer = false, onClose }: EditDialogProps) {
  const open = !!txn;
  const update = useUpdateTransaction(txn?._id ?? "");
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (txn) {
      setAmountPaise(txn.amountPaise);
      setDescription(txn.description ?? "");
      setNotes(txn.notes ?? "");
      setAccountId(txn.accountId);
      setError(null);
    }
  }, [txn]);

  if (!txn) return null;

  const lockReason = accountLockReason(txn, isContainer);
  const accountChanged = accountId !== null && accountId !== txn.accountId;

  async function onSave() {
    setError(null);
    const patch: Record<string, unknown> = {};
    if (amountPaise !== null && amountPaise !== txn!.amountPaise) {
      patch.amountPaise = amountPaise;
    }
    if (description !== (txn!.description ?? "")) patch.description = description;
    if (notes !== (txn!.notes ?? "")) patch.notes = notes;
    if (accountChanged && accountId) patch.accountId = accountId;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    try {
      await update.mutateAsync(patch);
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to save");
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit transaction</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <MoneyInput
            label="Amount"
            valuePaise={amountPaise}
            onChangePaise={setAmountPaise}
            fullWidth
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />
          {lockReason ? (
            <Alert severity="info" variant="outlined">
              {lockReason}
            </Alert>
          ) : (
            <Stack spacing={0.75}>
              <AccountPicker
                value={accountId}
                onChange={setAccountId}
                label="Account"
                required
              />
              {accountChanged && (
                <Alert severity="warning" variant="outlined">
                  Moving this transaction will update both account balances.
                </Alert>
              )}
            </Stack>
          )}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
