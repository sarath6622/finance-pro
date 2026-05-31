"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import type { ApiTransaction } from "@/lib/api/types";
import { MoneyInput } from "@/components/MoneyInput";
import { useUpdateTransaction } from "@/lib/api/transactions";
import { ApiClientError } from "@/lib/api/client";

export interface EditDialogProps {
  txn: ApiTransaction | null;
  onClose: () => void;
}

export function EditDialog({ txn, onClose }: EditDialogProps) {
  const open = !!txn;
  const update = useUpdateTransaction(txn?._id ?? "");
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (txn) {
      setAmountPaise(txn.amountPaise);
      setDescription(txn.description ?? "");
      setNotes(txn.notes ?? "");
      setError(null);
    }
  }, [txn]);

  if (!txn) return null;

  async function onSave() {
    setError(null);
    const patch: Record<string, unknown> = {};
    if (amountPaise !== null && amountPaise !== txn!.amountPaise) {
      patch.amountPaise = amountPaise;
    }
    if (description !== (txn!.description ?? "")) patch.description = description;
    if (notes !== (txn!.notes ?? "")) patch.notes = notes;
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
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
    </Dialog>
  );
}
