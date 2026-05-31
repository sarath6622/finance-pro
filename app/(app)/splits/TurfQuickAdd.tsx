"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AccountPicker } from "@/components/AccountPicker";
import { useAccounts } from "@/lib/api/accounts";
import { useCounterparties } from "@/lib/api/counterparties";
import { useCreateTurfBill } from "@/lib/api/splits";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultCounterparties: { _id: string; displayName: string }[];
  cpName: (id: string) => string;
}

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

const TURF_UNIT_PAISE_DEFAULT = 150000;

export function TurfQuickAdd({ open, onClose, defaultCounterparties, cpName }: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: counterparties = [] } = useCounterparties();
  const [accountId, setAccountId] = useState<string>("");
  const [unitRupees, setUnitRupees] = useState<string>("1500");
  const [includeOwner, setIncludeOwner] = useState<boolean>(true);
  const [selected, setSelected] = useState<string[]>(
    defaultCounterparties.map((c) => c._id),
  );
  const [valueDate, setValueDate] = useState(todayIst);
  const [description, setDescription] = useState("Turf");
  const mutation = useCreateTurfBill();

  useEffect(() => {
    if (!accountId && accounts.length) {
      const bank = accounts.find((a) => a.kind === "bank") ?? accounts[0];
      if (bank) setAccountId(bank._id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    if (!open) {
      setUnitRupees("1500");
      setDescription("Turf");
      setValueDate(todayIst());
      setIncludeOwner(true);
      setSelected(defaultCounterparties.map((c) => c._id));
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const unitPaise = useMemo(() => {
    const rupees = Number.parseFloat(unitRupees);
    if (!Number.isFinite(rupees) || rupees <= 0) return 0;
    return Math.round(rupees * 100);
  }, [unitRupees]);

  const playerCount = selected.length + (includeOwner ? 1 : 0);
  const totalPaise = unitPaise * playerCount;

  const friendOptions = useMemo(
    () =>
      counterparties.filter((c) => c.type === "friend" || c.type === "roommate"),
    [counterparties],
  );

  const canSubmit =
    !!accountId && unitPaise > 0 && selected.length > 0 && !mutation.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    await mutation.mutateAsync({
      payerAccountId: accountId,
      unitPaise,
      counterpartyIds: selected,
      includeOwner,
      valueDate,
      description: description || undefined,
    });
    onClose();
  };

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Turf quick-add</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Per-player (₹)"
            type="number"
            value={unitRupees}
            onChange={(e) => setUnitRupees(e.target.value)}
            inputProps={{ inputMode: "decimal", step: "0.01", min: 0 }}
            helperText="Default ₹1,500 per player"
            fullWidth
          />
          <AccountPicker value={accountId} onChange={(v) => setAccountId(v ?? "")} required />
          <FormControlLabel
            control={
              <Switch
                checked={includeOwner}
                onChange={(_, v) => setIncludeOwner(v)}
              />
            }
            label="Include myself in the split"
          />
          <Box>
            <Typography variant="body2" gutterBottom>
              Players
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {friendOptions.map((c) => (
                <Chip
                  key={c._id}
                  label={c.displayName}
                  color={selected.includes(c._id) ? "primary" : "default"}
                  onClick={() => toggle(c._id)}
                  variant={selected.includes(c._id) ? "filled" : "outlined"}
                />
              ))}
              {friendOptions.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No friend/roommate counterparties found. Add some in Settings.
                </Typography>
              )}
            </Stack>
            {selected.length === 0 && (
              <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
                Pick at least one player.
              </Typography>
            )}
          </Box>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />
          <TextField
            label="Date"
            type="date"
            value={valueDate}
            onChange={(e) => setValueDate(e.target.value)}
            fullWidth
          />
          <Alert severity="info">
            Total bill <MoneyDisplay paise={totalPaise} /> ·{" "}
            <strong>{playerCount}</strong> players
            {includeOwner && (
              <>
                {" "}
                · my share <MoneyDisplay paise={unitPaise} /> stays as spend
              </>
            )}
            . {selected.length} IOU{selected.length === 1 ? "" : "s"} will be
            created: {selected.slice(0, 3).map(cpName).join(", ")}
            {selected.length > 3 && ", …"}.
          </Alert>
          {mutation.error && (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {mutation.isPending ? "Creating…" : "Create turf split"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
