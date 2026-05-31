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
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { MoneyInput } from "@/components/MoneyInput";
import { useCreateAccount, useUpdateAccount } from "@/lib/api/accounts";
import { ApiClientError } from "@/lib/api/client";
import type { ApiAccount } from "@/lib/api/types";
import type {
  AccountClassification,
  AccountKind,
} from "@/lib/schemas/common";

const KIND_OPTIONS: Array<{ value: AccountKind; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "credit_card", label: "Credit card" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "wallet", label: "Wallet" },
];

const CLASSIFICATION_OPTIONS: Array<{ value: AccountClassification; label: string }> = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
];

const DEFAULT_CLASSIFICATION: Record<AccountKind, AccountClassification> = {
  bank: "asset",
  cash: "asset",
  investment: "asset",
  wallet: "asset",
  credit_card: "liability",
  loan: "liability",
};

export interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
  account?: ApiAccount;
}

export function AccountDialog({ open, onClose, account }: AccountDialogProps) {
  const isEdit = !!account;
  const create = useCreateAccount();
  const update = useUpdateAccount(account?._id ?? "");

  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [classification, setClassification] = useState<AccountClassification>("asset");
  const [institution, setInstitution] = useState("");
  const [last4Label, setLast4Label] = useState("");
  const [openingPaise, setOpeningPaise] = useState<number | null>(0);
  const [interestRatePA, setInterestRatePA] = useState<string>("");
  const [tenureMonths, setTenureMonths] = useState<string>("");
  const [emiPaise, setEmiPaise] = useState<number | null>(null);
  const [statementDay, setStatementDay] = useState<string>("");
  const [dueDay, setDueDay] = useState<string>("");
  const [acceptCascade, setAcceptCascade] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAcceptCascade(false);
    if (account) {
      setName(account.name);
      setKind(account.kind);
      setClassification(account.classification);
      setInstitution(account.institution ?? "");
      setLast4Label(account.last4Label ?? "");
      setOpeningPaise(account.openingBalancePaise);
      setInterestRatePA(account.interestRatePA?.toString() ?? "");
      setTenureMonths(account.tenureMonths?.toString() ?? "");
      setEmiPaise(account.emiAmountPaise ?? null);
      setStatementDay(account.statementDay?.toString() ?? "");
      setDueDay(account.dueDay?.toString() ?? "");
    } else {
      setName("");
      setKind("bank");
      setClassification("asset");
      setInstitution("");
      setLast4Label("");
      setOpeningPaise(0);
      setInterestRatePA("");
      setTenureMonths("");
      setEmiPaise(null);
      setStatementDay("");
      setDueDay("");
    }
  }, [account, open]);

  function onKindChange(next: AccountKind) {
    setKind(next);
    if (!isEdit) setClassification(DEFAULT_CLASSIFICATION[next]);
  }

  const showLoanFields = kind === "loan";
  const showCardFields = kind === "credit_card";
  const openingChanged =
    isEdit && account && openingPaise !== null && openingPaise !== account.openingBalancePaise;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (openingPaise === null) return setError("Opening balance is required");
    if (openingChanged && !acceptCascade) {
      return setError(
        "Confirm the cascade: changing opening balance will shift every downstream balance.",
      );
    }

    const payload = {
      name: name.trim(),
      kind,
      classification,
      ...(institution.trim() ? { institution: institution.trim() } : {}),
      ...(last4Label.trim() ? { last4Label: last4Label.trim() } : {}),
      openingBalancePaise: openingPaise,
      ...(showLoanFields && interestRatePA
        ? { interestRatePA: Number.parseFloat(interestRatePA) }
        : {}),
      ...(showLoanFields && tenureMonths
        ? { tenureMonths: Number.parseInt(tenureMonths, 10) }
        : {}),
      ...(showLoanFields && emiPaise !== null ? { emiAmountPaise: emiPaise } : {}),
      ...(showCardFields && statementDay
        ? { statementDay: Number.parseInt(statementDay, 10) }
        : {}),
      ...(showCardFields && dueDay ? { dueDay: Number.parseInt(dueDay, 10) } : {}),
    };

    try {
      if (isEdit) {
        await update.mutateAsync({
          ...payload,
          ...(openingChanged ? { acceptOpeningBalanceCascade: true } : {}),
        });
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
        <DialogTitle>{isEdit ? `Edit ${account!.name}` : "Add account"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Kind"
                value={kind}
                onChange={(e) => onKindChange(e.target.value as AccountKind)}
                fullWidth
              >
                {KIND_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Classification"
                value={classification}
                onChange={(e) =>
                  setClassification(e.target.value as AccountClassification)
                }
                fullWidth
              >
                {CLASSIFICATION_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                fullWidth
              />
              <TextField
                label="Mask label (last4)"
                value={last4Label}
                onChange={(e) => setLast4Label(e.target.value)}
                helperText="Masked label only — never full account/card numbers"
                inputProps={{ maxLength: 10 }}
                fullWidth
              />
            </Stack>
            <MoneyInput
              label={
                classification === "liability" ? "Opening outstanding" : "Opening balance"
              }
              valuePaise={openingPaise ?? 0}
              onChangePaise={(v) => setOpeningPaise(v)}
              fullWidth
            />
            {openingChanged && (
              <Alert severity="warning">
                <Typography variant="body2">
                  Changing the opening balance shifts every downstream balance for this
                  account. Live transactions are not edited — only the starting point
                  changes.
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={acceptCascade}
                      onChange={(e) => setAcceptCascade(e.target.checked)}
                    />
                  }
                  label="I understand — apply the cascade"
                />
              </Alert>
            )}
            {showCardFields && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Statement day"
                  type="number"
                  inputProps={{ min: 1, max: 31 }}
                  value={statementDay}
                  onChange={(e) => setStatementDay(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Due day"
                  type="number"
                  inputProps={{ min: 1, max: 31 }}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  fullWidth
                />
              </Stack>
            )}
            {showLoanFields && (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Interest rate (% p.a.)"
                    type="number"
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                    value={interestRatePA}
                    onChange={(e) => setInterestRatePA(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Tenure (months)"
                    type="number"
                    inputProps={{ min: 1 }}
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    fullWidth
                  />
                </Stack>
                <MoneyInput
                  label="EMI amount"
                  valuePaise={emiPaise ?? 0}
                  onChangePaise={(v) => setEmiPaise(v)}
                  fullWidth
                />
              </>
            )}
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
