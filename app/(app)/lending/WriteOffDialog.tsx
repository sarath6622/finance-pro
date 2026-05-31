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
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useWriteOffReceivable, type ApiReceivable } from "@/lib/api/receivables";
import { ApiClientError } from "@/lib/api/client";

export interface WriteOffDialogProps {
  receivable: ApiReceivable | null;
  onClose: () => void;
}

export function WriteOffDialog({ receivable, onClose }: WriteOffDialogProps) {
  const open = !!receivable;
  const mut = useWriteOffReceivable(receivable?._id ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (receivable) {
      setNotes("");
      setError(null);
    }
  }, [receivable?._id, receivable]);

  if (!receivable) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mut.mutateAsync({ ...(notes ? { notes } : {}) });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to write off");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>Write off as gift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              Posts a <strong>spend</strong> of{" "}
              <MoneyDisplay paise={receivable.outstandingPaise} monospace /> on the lending
              account and marks the receivable as written off. This action keeps net worth honest
              (no phantom asset).
            </Alert>
            <TextField
              label="Why?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              placeholder="They moved away · ghosted · etc."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="error" disabled={mut.isPending}>
            {mut.isPending ? "Writing off…" : "Write off"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
