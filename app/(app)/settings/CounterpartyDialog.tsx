"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  useCreateCounterparty,
  useUpdateCounterparty,
} from "@/lib/api/counterparties";
import { ApiClientError } from "@/lib/api/client";
import type { ApiCounterparty } from "@/lib/api/types";
import type { CounterpartyType } from "@/lib/schemas/common";

const TYPE_OPTIONS: Array<{ value: CounterpartyType; label: string }> = [
  { value: "family", label: "Family" },
  { value: "roommate", label: "Roommate" },
  { value: "friend", label: "Friend" },
  { value: "merchant", label: "Merchant" },
  { value: "employer", label: "Employer" },
  { value: "self", label: "Self" },
  { value: "institution", label: "Institution" },
];

export interface CounterpartyDialogProps {
  open: boolean;
  onClose: () => void;
  counterparty?: ApiCounterparty;
}

export function CounterpartyDialog({
  open,
  onClose,
  counterparty,
}: CounterpartyDialogProps) {
  const isEdit = !!counterparty;
  const create = useCreateCounterparty();
  const update = useUpdateCounterparty(counterparty?._id ?? "");

  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<CounterpartyType>("friend");
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAliasDraft("");
    if (counterparty) {
      setDisplayName(counterparty.displayName);
      setType(counterparty.type);
      setAliases(counterparty.aliases ?? []);
      setNotes(counterparty.notes ?? "");
    } else {
      setDisplayName("");
      setType("friend");
      setAliases([]);
      setNotes("");
    }
  }, [counterparty, open]);

  function commitAlias() {
    const v = aliasDraft.trim();
    if (!v) return;
    if (!aliases.includes(v)) setAliases([...aliases, v]);
    setAliasDraft("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim()) return setError("Name is required");

    const payload = {
      displayName: displayName.trim(),
      type,
      aliases,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      if (isEdit) {
        await update.mutateAsync(payload);
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed");
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>
          {isEdit ? `Edit ${counterparty!.displayName}` : "Add counterparty"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as CounterpartyType)}
              fullWidth
            >
              {TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Aliases — strings that appear on statements (helps imports classify).
                Press Enter or Add to commit.
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Add alias"
                  size="small"
                  value={aliasDraft}
                  onChange={(e) => setAliasDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitAlias();
                    }
                  }}
                  fullWidth
                />
                <Button onClick={commitAlias} disabled={!aliasDraft.trim()}>
                  Add
                </Button>
              </Stack>
              {aliases.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {aliases.map((a) => (
                    <Chip
                      key={a}
                      label={a}
                      size="small"
                      onDelete={() =>
                        setAliases(aliases.filter((x) => x !== a))
                      }
                    />
                  ))}
                </Box>
              )}
            </Stack>
            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              maxRows={4}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save" : "Add"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}
