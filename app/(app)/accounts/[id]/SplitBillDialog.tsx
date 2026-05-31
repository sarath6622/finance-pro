"use client";

import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { MoneyInput } from "@/components/MoneyInput";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useCounterparties } from "@/lib/api/counterparties";
import { useCreateSplitBill } from "@/lib/api/splits";
import type { ApiTransaction } from "@/lib/api/types";
import {
  proposeEqualParticipants,
  validateShares,
  ShareValidationError,
} from "@/lib/splits";

export interface SplitBillDialogProps {
  txn: ApiTransaction | null;
  onClose: () => void;
}

interface DraftParticipant {
  counterpartyId: string;
  sharePaise: number;
  dueModel: "on_date" | "when_able" | "none";
}

export function SplitBillDialog({ txn, onClose }: SplitBillDialogProps) {
  const open = !!txn;
  const total = txn?.amountPaise ?? 0;
  const create = useCreateSplitBill();
  const { data: counterparties = [] } = useCounterparties();
  const [includeOwner, setIncludeOwner] = useState(true);
  const [ownSharePaise, setOwnSharePaise] = useState<number | null>(null);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const friendOptions = useMemo(
    () => counterparties.filter((c) => c.type !== "merchant" && c.type !== "self"),
    [counterparties],
  );

  useEffect(() => {
    if (!open) {
      create.reset();
      setError(null);
      return;
    }
    setIncludeOwner(true);
    setOwnSharePaise(total);
    setParticipants([]);
    // `create` is a TanStack mutation object whose identity changes every
    // render; including it would re-trigger this effect on every render and
    // loop the input back to its initial value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, total]);

  function rebalanceEqualWith(nextIds: string[], includeOwnerNext: boolean) {
    if (nextIds.length === 0) {
      setParticipants([]);
      setOwnSharePaise(total);
      return;
    }
    const { ownSharePaise: ownShare, participants: pp } = proposeEqualParticipants(
      total,
      nextIds,
      { includeOwner: includeOwnerNext, dueModel: "when_able" },
    );
    setOwnSharePaise(ownShare);
    setParticipants(
      pp.map((p) => ({
        counterpartyId: p.counterpartyId,
        sharePaise: p.sharePaise,
        dueModel: (p.dueModel ?? "when_able") as DraftParticipant["dueModel"],
      })),
    );
  }

  function toggleParticipant(id: string) {
    const present = participants.some((p) => p.counterpartyId === id);
    const nextIds = present
      ? participants.filter((p) => p.counterpartyId !== id).map((p) => p.counterpartyId)
      : [...participants.map((p) => p.counterpartyId), id];
    rebalanceEqualWith(nextIds, includeOwner);
  }

  function setEvenSplit() {
    rebalanceEqualWith(
      participants.map((p) => p.counterpartyId),
      includeOwner,
    );
  }

  function setShare(idx: number, value: number) {
    setParticipants((ps) =>
      ps.map((p, i) => (i === idx ? { ...p, sharePaise: value } : p)),
    );
  }

  const remainder = useMemo(() => {
    const sum =
      (ownSharePaise ?? 0) + participants.reduce((s, p) => s + p.sharePaise, 0);
    return total - sum;
  }, [ownSharePaise, participants, total]);

  const canSubmit =
    open &&
    total > 0 &&
    participants.length >= 1 &&
    participants.every((p) => p.sharePaise > 0) &&
    remainder === 0 &&
    !create.isPending;

  async function submit() {
    if (!txn) return;
    setError(null);
    try {
      validateShares(total, ownSharePaise ?? 0, participants);
      await create.mutateAsync({
        sourceTransactionId: txn._id,
        totalPaise: total,
        ownSharePaise: ownSharePaise ?? 0,
        participants: participants.map((p) => ({
          counterpartyId: p.counterpartyId,
          sharePaise: p.sharePaise,
          dueModel: p.dueModel,
        })),
      });
      onClose();
    } catch (err) {
      if (err instanceof ShareValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to split");
      }
    }
  }

  if (!txn) return null;

  const cpName = (id: string) =>
    counterparties.find((c) => c._id === id)?.displayName ?? id;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Split bill with others</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Alert severity="info">
            Bill total <MoneyDisplay paise={total} monospace />. The original spend
            stays in your ledger; only your share counts toward this period's spend
            total. The rest becomes split IOUs.
          </Alert>
          <Box>
            <Typography variant="body2" gutterBottom>
              Participants
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {friendOptions.map((c) => {
                const selected = participants.some((p) => p.counterpartyId === c._id);
                return (
                  <Chip
                    key={c._id}
                    label={c.displayName}
                    color={selected ? "primary" : "default"}
                    variant={selected ? "filled" : "outlined"}
                    onClick={() => toggleParticipant(c._id)}
                  />
                );
              })}
              {friendOptions.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  Add friends/roommates as counterparties first.
                </Typography>
              )}
            </Stack>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={includeOwner}
                onChange={(_, v) => {
                  setIncludeOwner(v);
                  rebalanceEqualWith(
                    participants.map((p) => p.counterpartyId),
                    v,
                  );
                }}
              />
            }
            label="Include myself in the equal split"
          />
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={setEvenSplit} disabled={participants.length === 0}>
              Even split
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
              Override individual shares below
            </Typography>
          </Stack>

          <MoneyInput
            label="My share"
            valuePaise={ownSharePaise ?? 0}
            onChangePaise={(v) => setOwnSharePaise(v ?? 0)}
          />

          {participants.map((p, idx) => (
            <Stack key={p.counterpartyId} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ flexBasis: 140 }}>{cpName(p.counterpartyId)}</Typography>
              <MoneyInput
                label="Share"
                valuePaise={p.sharePaise}
                onChangePaise={(v) => setShare(idx, v ?? 0)}
                fullWidth
              />
              <IconButton
                size="small"
                onClick={() => toggleParticipant(p.counterpartyId)}
                title="Remove participant"
              >
                <RemoveCircleOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}

          <Alert severity={remainder === 0 ? "success" : "warning"}>
            Sum check: my <MoneyDisplay paise={ownSharePaise ?? 0} /> +{" "}
            {participants.length} share{participants.length === 1 ? "" : "s"} ={" "}
            <MoneyDisplay paise={total - remainder} /> · target{" "}
            <MoneyDisplay paise={total} />
            {remainder !== 0 && (
              <>
                {" "}
                · off by <MoneyDisplay paise={Math.abs(remainder)} /> {remainder > 0 ? "(short)" : "(over)"}
              </>
            )}
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {create.error && (
            <Alert severity="error">{(create.error as Error).message}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {create.isPending ? "Splitting…" : "Save split"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
