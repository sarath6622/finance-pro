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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useCorporateAction } from "@/lib/api/holdings";

interface Props {
  open: boolean;
  onClose: () => void;
  holdingId: string;
}

export function CorporateActionDialog({ open, onClose, holdingId }: Props) {
  const ca = useCorporateAction(holdingId);
  const [kind, setKind] = useState<"split" | "bonus">("split");
  const [num, setNum] = useState<string>("2");
  const [den, setDen] = useState<string>("1");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      ca.reset();
      setKind("split");
      setNum("2");
      setDen("1");
      setNotes("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nNum = Number.parseInt(num, 10);
  const nDen = Number.parseInt(den, 10);
  const canSubmit =
    Number.isFinite(nNum) && Number.isFinite(nDen) && nNum >= 1 && nDen >= 1 && !ca.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await ca.mutateAsync({
        kind,
        ratioNumerator: nNum,
        ratioDenominator: nDen,
        ...(notes ? { notes } : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Corporate action failed");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Corporate action</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={kind}
            onChange={(_, v) => v && setKind(v as "split" | "bonus")}
          >
            <ToggleButton value="split">Split</ToggleButton>
            <ToggleButton value="bonus">Bonus</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Ratio numerator"
              type="number"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              inputProps={{ min: 1, step: 1 }}
            />
            <TextField
              label="Ratio denominator"
              type="number"
              value={den}
              onChange={(e) => setDen(e.target.value)}
              inputProps={{ min: 1, step: 1 }}
            />
          </Stack>
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
          />
          <Alert severity="info">
            Quantities ×{nNum}/{nDen}, per-unit cost ×{nDen}/{nNum} so total basis
            is preserved. <strong>No realized P&L</strong>.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {ca.error && <Alert severity="error">{(ca.error as Error).message}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {ca.isPending ? "Saving…" : "Apply"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
