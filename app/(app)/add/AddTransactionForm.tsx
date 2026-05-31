"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { MoneyInput } from "@/components/MoneyInput";
import { FlowTypeSelector } from "@/components/FlowTypeSelector";
import { NeedWantToggle } from "@/components/NeedWantToggle";
import { AccountPicker } from "@/components/AccountPicker";
import { CounterpartyPicker } from "@/components/CounterpartyPicker";
import { CategoryPicker } from "@/components/CategoryPicker";
import { DueModelSelector } from "@/components/DueModelSelector";
import { useCreateTransaction } from "@/lib/api/transactions";
import { ApiClientError } from "@/lib/api/client";
import { useAccounts } from "@/lib/api/accounts";
import { useLendSafety } from "@/lib/api/liquidity";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import type { ApiCounterparty } from "@/lib/api/types";
import type { FlowType, NeedWant } from "@/lib/schemas/common";
import type { DueModel } from "@/lib/api/receivables";
import { defaultDirectionFor } from "@/lib/flow/labels";
import { todayInIst } from "@/lib/flow/date";

const LAST_ACCOUNT = "finance:lastAccountId";
const LAST_FLOW = "finance:lastFlowType";

export function AddTransactionForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const create = useCreateTransaction();

  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [flowType, setFlowType] = useState<FlowType>("spend");
  const [needWant, setNeedWant] = useState<NeedWant | null>("want");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [valueDate, setValueDate] = useState<string>(todayInIst());
  const [description, setDescription] = useState("");
  const [dueModel, setDueModel] = useState<DueModel>("when_able");
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>("");
  const [reminderOptIn, setReminderOptIn] = useState<boolean>(false);
  const [debtAccountId, setDebtAccountId] = useState<string | null>(null);
  const [acceptUnderpayment, setAcceptUnderpayment] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const loanAccounts = accounts.filter((a) => a.kind === "loan");

  const checkLendSafety = flowType === "lending_out" && amountPaise !== null && amountPaise > 0;
  const lendSafety = useLendSafety(checkLendSafety ? amountPaise : null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const accountFromUrl = sp?.get("accountId");
    const lastAccount = accountFromUrl ?? window.localStorage.getItem(LAST_ACCOUNT);
    if (lastAccount) setAccountId(lastAccount);
    const lastFlow = window.localStorage.getItem(LAST_FLOW) as FlowType | null;
    if (lastFlow) {
      setFlowType(lastFlow);
      if (lastFlow !== "spend") setNeedWant(null);
    }
  }, [sp]);

  function onChangeFlowType(v: FlowType) {
    setFlowType(v);
    if (v === "spend") {
      if (!needWant) setNeedWant("want");
    } else {
      setNeedWant(null);
    }
  }

  function clearForReuse() {
    setAmountPaise(null);
    setDescription("");
    setCounterpartyId(null);
    setCategoryId(null);
  }

  async function submit(e: FormEvent, options: { resetAndStay: boolean }) {
    e.preventDefault();
    setError(null);
    if (amountPaise === null || amountPaise <= 0) {
      setError("Amount is required and must be > 0");
      return;
    }
    if (!accountId) {
      setError("Pick an account");
      return;
    }
    if (flowType === "lending_out") {
      if (!counterpartyId) {
        setError("Lending requires a counterparty");
        return;
      }
      if (dueModel === "on_date" && !expectedReturnDate) {
        setError("Pick an expected return date (or switch dueModel)");
        return;
      }
    }
    if (flowType === "lending_repaid" || flowType === "reimbursement_in") {
      setError(
        "Mark repayments from the lending page (per-receivable), not from Add. Pick a different flow type.",
      );
      return;
    }
    if (flowType === "debt_repayment" && loanAccounts.length > 0 && !debtAccountId) {
      setError("Pick the loan you're paying down (or change the flow type).");
      return;
    }
    try {
      await create.mutateAsync({
        valueDate,
        amountPaise,
        direction: defaultDirectionFor(flowType),
        flowType,
        ...(flowType === "spend" && needWant ? { needWant } : {}),
        accountId,
        ...(counterpartyId ? { counterpartyId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(description ? { description } : {}),
        ...(flowType === "lending_out"
          ? {
              dueModel,
              ...(dueModel === "on_date" && expectedReturnDate
                ? { expectedReturnDate }
                : {}),
              reminderOptIn,
            }
          : {}),
        ...(flowType === "debt_repayment" && debtAccountId
          ? { debtAccountId }
          : {}),
        ...(flowType === "card_settlement" && acceptUnderpayment
          ? { acceptUnderpayment: true }
          : {}),
      } as Parameters<typeof create.mutateAsync>[0]);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_ACCOUNT, accountId);
        window.localStorage.setItem(LAST_FLOW, flowType);
      }
      setToastOpen(true);
      if (options.resetAndStay) {
        clearForReuse();
      } else {
        router.push(`/accounts/${accountId}`);
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to save");
    }
  }

  function pickCounterparty(cp: ApiCounterparty | null) {
    setCounterpartyId(cp?._id ?? null);
    if (cp?.defaultFlowType && flowType === "spend") {
      onChangeFlowType(cp.defaultFlowType);
    }
    if (cp?.defaultCategoryId) setCategoryId(cp.defaultCategoryId);
  }

  return (
    <Stack component="form" onSubmit={(e) => submit(e, { resetAndStay: false })} spacing={2.5}>
      <Typography variant="h1">Add transaction</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <MoneyInput
        label="Amount"
        valuePaise={amountPaise}
        onChangePaise={setAmountPaise}
        autoFocus
        required
        fullWidth
      />
      <Stack spacing={1}>
        <Typography variant="caption" color="text.secondary">
          Flow type
        </Typography>
        <FlowTypeSelector value={flowType} onChange={onChangeFlowType} />
        {flowType === "spend" && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ pt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Need / want
            </Typography>
            <NeedWantToggle value={needWant} onChange={setNeedWant} />
          </Stack>
        )}
      </Stack>
      <AccountPicker value={accountId} onChange={setAccountId} required />
      <CounterpartyPicker value={counterpartyId} onChange={pickCounterparty} />
      <CategoryPicker value={categoryId} onChange={setCategoryId} flowType={flowType} />
      {flowType === "debt_repayment" && loanAccounts.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            Which loan is this paying down?
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {loanAccounts.map((l) => (
              <Button
                key={l._id}
                size="small"
                variant={debtAccountId === l._id ? "contained" : "outlined"}
                onClick={() => setDebtAccountId(l._id)}
              >
                {l.name}
              </Button>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Principal/interest split is computed from the loan's rate × outstanding.
          </Typography>
        </Stack>
      )}
      {flowType === "card_settlement" && (
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={acceptUnderpayment}
              onChange={(_, v) => setAcceptUnderpayment(v)}
            />
          }
          label="Allow partial settlement (silences card-in-full guard)"
        />
      )}
      {flowType === "lending_out" && (
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
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={reminderOptIn}
                onChange={(_e, v) => setReminderOptIn(v)}
              />
            }
            label="Remind me (reminders ship in P10)"
          />
          {lendSafety.data && (lendSafety.data.wouldBreachFloor || lendSafety.data.wouldOverdraw) && (
            <Alert severity={lendSafety.data.wouldOverdraw ? "error" : "warning"}>
              Lend-safety: this would push your projected balance to{" "}
              <strong>
                <MoneyDisplay paise={lendSafety.data.hypotheticalMinPaise} signed monospace />
              </strong>{" "}
              on {lendSafety.data.hypotheticalMinDate} —{" "}
              {lendSafety.data.wouldOverdraw
                ? "overdraft territory."
                : (<>below your floor of <MoneyDisplay paise={lendSafety.data.floorPaise} />.</>)}{" "}
              Safe-to-lend right now ≈{" "}
              <strong>
                <MoneyDisplay paise={lendSafety.data.safeLendCeilingPaise} monospace />
              </strong>
              .
            </Alert>
          )}
          {lendSafety.data && !lendSafety.data.wouldBreachFloor && !lendSafety.data.wouldOverdraw && (
            <Alert severity="success">
              Lend-safety clear — projected min after this lend ={" "}
              <MoneyDisplay paise={lendSafety.data.hypotheticalMinPaise} monospace />.
            </Alert>
          )}
        </Stack>
      )}
      <TextField
        label="Value date"
        type="date"
        value={valueDate}
        onChange={(e) => setValueDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Stack direction="row" spacing={2}>
        <Button type="submit" variant="contained" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outlined"
          disabled={create.isPending}
          onClick={(e) => submit(e, { resetAndStay: true })}
        >
          Save & add another
        </Button>
      </Stack>
      <Snackbar
        open={toastOpen}
        autoHideDuration={1500}
        onClose={() => setToastOpen(false)}
        message="Saved"
      />
    </Stack>
  );
}
