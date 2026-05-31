"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useAccount } from "@/lib/api/accounts";
import { useDeleteTransaction, useTransactions } from "@/lib/api/transactions";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { TransactionRow } from "./TransactionRow";
import { EditDialog } from "./EditDialog";
import { SplitDialog } from "./SplitDialog";
import { SplitBillDialog } from "./SplitBillDialog";
import type { ApiTransaction } from "@/lib/api/types";
import { ApiClientError } from "@/lib/api/client";

export default function AccountDrillIn() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { data: account, isLoading: aLoading, error: aErr } = useAccount(id);
  const { data: txnPage, isLoading: tLoading, error: tErr } = useTransactions({
    accountId: id,
    limit: 100,
  });
  const del = useDeleteTransaction();
  const [editing, setEditing] = useState<ApiTransaction | null>(null);
  const [splitting, setSplitting] = useState<ApiTransaction | null>(null);
  const [billing, setBilling] = useState<ApiTransaction | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const items = txnPage?.items ?? [];
  const containerIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of items) {
      if (t.isDeleted) continue;
      if (t.parentTransactionId) set.add(t.parentTransactionId);
    }
    return set;
  }, [items]);

  async function onDelete(t: ApiTransaction) {
    setOpError(null);
    try {
      await del.mutateAsync(t._id);
    } catch (e) {
      setOpError(e instanceof ApiClientError ? e.message : "Failed to delete");
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {(aErr || tErr) && (
          <Alert severity="error">
            {(aErr as Error)?.message ?? (tErr as Error)?.message}
          </Alert>
        )}
        {opError && <Alert severity="error">{opError}</Alert>}
        {aLoading && <CircularProgress />}
        {account && (
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h1">{account.name}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} alignItems="center">
                    <Chip size="small" label={account.kind.replace("_", " ")} />
                    {account.last4Label && (
                      <Typography variant="body2" color="text.secondary">
                        …{account.last4Label}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Box textAlign="right">
                  <MoneyDisplay
                    paise={account.balancePaise}
                    size="large"
                    colorize
                    monospace
                  />
                  {account.classification === "liability" && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      owed
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  component={Link}
                  href={`/add?accountId=${account._id}` as never}
                  variant="contained"
                  size="small"
                >
                  Add transaction
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Transactions ({items.length})
            </Typography>
            {tLoading && <CircularProgress size={20} />}
            <Stack divider={<Divider />} sx={{ mt: 1 }}>
              {items.map((t) => (
                <TransactionRow
                  key={t._id}
                  txn={t}
                  isContainer={containerIds.has(t._id)}
                  onEdit={() => setEditing(t)}
                  onSplit={() => setSplitting(t)}
                  onSplitWithOthers={() => setBilling(t)}
                  onDelete={() => onDelete(t)}
                />
              ))}
              {!tLoading && items.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No transactions yet.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <EditDialog txn={editing} onClose={() => setEditing(null)} />
      <SplitDialog parent={splitting} onClose={() => setSplitting(null)} />
      <SplitBillDialog txn={billing} onClose={() => setBilling(null)} />
    </Container>
  );
}
