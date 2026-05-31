"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import {
  useSplitBill,
  useWriteOffParticipant,
  type ApiSplitBill,
  type ApiSplitParticipant,
} from "@/lib/api/splits";
import { useCounterparties } from "@/lib/api/counterparties";
import type { ApiReceivable } from "@/lib/api/receivables";
import { AddRepaymentDialog } from "@/app/(app)/lending/AddRepaymentDialog";

interface Props {
  id: string;
}

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function participantToReceivable(
  bill: ApiSplitBill,
  p: ApiSplitParticipant,
): ApiReceivable | null {
  if (!p.receivableId) return null;
  const outstanding = p.outstandingPaise ?? Math.max(0, p.sharePaise - p.settledPaise);
  return {
    _id: p.receivableId,
    counterpartyId: p.counterpartyId,
    kind: "split_iou",
    principalPaise: p.sharePaise,
    outstandingPaise: outstanding,
    overpaymentPaise: 0,
    dateIncurred: bill.createdAt?.slice(0, 10) ?? todayIst(),
    accountId: bill.payerAccountId,
    dueModel: p.dueModel,
    status: (p.receivableStatus ?? p.status) as ApiReceivable["status"],
    ageBucket: p.dueModel === "when_able" ? "pay-when-able" : "0-30",
    version: 0,
    bookedAt: bill.bookedAt ?? bill.createdAt ?? new Date().toISOString(),
  };
}

export function SplitDetail({ id }: Props) {
  const { data: bill, error, isLoading } = useSplitBill(id);
  const { data: counterparties = [] } = useCounterparties();
  const [repaymentTarget, setRepaymentTarget] = useState<ApiReceivable | null>(null);
  const cpName = useMemo(
    () => (cid: string) =>
      counterparties.find((c) => c._id === cid)?.displayName ?? cid,
    [counterparties],
  );

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;
  if (isLoading || !bill) return <Typography variant="body2">Loading…</Typography>;

  const settledTotal = bill.participants.reduce(
    (s, p) => s + Math.min(p.sharePaise, p.settledPaise),
    0,
  );
  const outstandingTotal = bill.participants.reduce(
    (s, p) => s + Math.max(0, (p.outstandingPaise ?? p.sharePaise - p.settledPaise)),
    0,
  );
  const pct = bill.totalPaise
    ? Math.min(100, Math.round((settledTotal / bill.totalPaise) * 100))
    : 0;

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Split bill
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h1">
              <MoneyDisplay paise={bill.totalPaise} monospace />
            </Typography>
            <Chip
              color={
                bill.status === "settled"
                  ? "success"
                  : bill.status === "partial"
                    ? "warning"
                    : "default"
              }
              label={bill.status}
            />
          </Stack>
        </Box>
        <Button component={Link} href={"/splits" as never} size="small">
          Back to splits
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            alignItems={{ sm: "center" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" color="text.secondary">
                My share <MoneyDisplay paise={bill.ownSharePaise} monospace /> · settled{" "}
                <MoneyDisplay paise={settledTotal} monospace /> · outstanding{" "}
                <MoneyDisplay paise={outstandingTotal} monospace />
              </Typography>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
                color={bill.status === "settled" ? "success" : "primary"}
              />
              <Typography variant="caption" color="text.secondary">
                {pct}% settled
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={1.5}>
        {bill.participants.map((p) => (
          <ParticipantRow
            key={p.counterpartyId}
            billId={bill._id}
            p={p}
            name={cpName(p.counterpartyId)}
            onMarkPaid={() => {
              const rec = participantToReceivable(bill, p);
              if (rec) setRepaymentTarget(rec);
            }}
          />
        ))}
      </Stack>

      <AddRepaymentDialog
        receivable={repaymentTarget}
        onClose={() => setRepaymentTarget(null)}
      />

      <Divider />
      <Typography variant="caption" color="text.secondary">
        The source transaction stays as a single spend in your account ledger
        (<MoneyDisplay paise={bill.totalPaise} />). The report layer subtracts the
        portion others owe so only <MoneyDisplay paise={bill.ownSharePaise} /> counts
        toward your spend total.
      </Typography>
    </Stack>
  );
}

function ParticipantRow({
  billId,
  p,
  name,
  onMarkPaid,
}: {
  billId: string;
  p: ApiSplitParticipant;
  name: string;
  onMarkPaid: () => void;
}) {
  const writeOff = useWriteOffParticipant(billId, p.counterpartyId);
  const [confirming, setConfirming] = useState(false);
  const outstanding = p.outstandingPaise ?? Math.max(0, p.sharePaise - p.settledPaise);
  const settled = p.sharePaise - outstanding;
  const isWrittenOff = p.receivableStatus === "written_off";
  const color =
    p.status === "settled"
      ? isWrittenOff
        ? "warning"
        : "success"
      : p.status === "partial"
        ? "warning"
        : "default";

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h3">{name}</Typography>
              <Chip size="small" color={color} label={isWrittenOff ? "written off" : p.status} />
              {p.dueModel === "when_able" && (
                <Chip size="small" variant="outlined" label="pay-when-able" />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              share <MoneyDisplay paise={p.sharePaise} monospace /> · settled{" "}
              <MoneyDisplay paise={Math.max(0, settled)} monospace />
              {!isWrittenOff && outstanding > 0 && (
                <>
                  {" "}
                  · still owes <MoneyDisplay paise={outstanding} monospace />
                </>
              )}
            </Typography>
          </Box>
          {!isWrittenOff && outstanding > 0 && (
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={onMarkPaid}>
                Mark paid
              </Button>
              {!confirming ? (
                <Button size="small" color="warning" onClick={() => setConfirming(true)}>
                  Write off
                </Button>
              ) : (
                <>
                  <Button
                    size="small"
                    color="warning"
                    variant="contained"
                    disabled={writeOff.isPending}
                    onClick={async () => {
                      await writeOff.mutateAsync({});
                      setConfirming(false);
                    }}
                  >
                    {writeOff.isPending ? "Writing off…" : "Confirm"}
                  </Button>
                  <Button size="small" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Stack>
        {writeOff.error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {(writeOff.error as Error).message}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
