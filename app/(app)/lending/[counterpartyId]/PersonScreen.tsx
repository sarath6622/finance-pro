"use client";

import { useState } from "react";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AgeBucketChip } from "@/components/AgeBucketChip";
import { ReceivableCard } from "@/components/ReceivableCard";
import { useReceivablesByCounterparty, type ApiReceivable } from "@/lib/api/receivables";
import { AddRepaymentDialog } from "../AddRepaymentDialog";
import { WriteOffDialog } from "../WriteOffDialog";

export function PersonScreen({ counterpartyId }: { counterpartyId: string }) {
  const { data, isLoading, error } = useReceivablesByCounterparty(counterpartyId);
  const [repayTarget, setRepayTarget] = useState<ApiReceivable | null>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<ApiReceivable | null>(null);

  return (
    <Stack spacing={3}>
      <Box>
        <Button component={Link} href={"/lending" as never} size="small">
          ← Lending
        </Button>
      </Box>
      {isLoading && <Typography variant="body2">Loading…</Typography>}
      {error && <Alert severity="error">{(error as Error).message}</Alert>}

      {data && (
        <>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={3}
                alignItems={{ sm: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h1">{data.counterparty.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.counterparty.type}
                  </Typography>
                </Box>
                <Box textAlign={{ sm: "right" }}>
                  <Typography variant="caption" color="text.secondary">
                    Total owed
                  </Typography>
                  <MoneyDisplay
                    paise={data.totalOutstandingPaise}
                    size="large"
                    monospace
                  />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    {data.bucketCounts["0-30"] > 0 && (
                      <AgeBucketChip bucket="0-30" count={data.bucketCounts["0-30"]} />
                    )}
                    {data.bucketCounts["30-90"] > 0 && (
                      <AgeBucketChip bucket="30-90" count={data.bucketCounts["30-90"]} />
                    )}
                    {data.bucketCounts["90+"] > 0 && (
                      <AgeBucketChip bucket="90+" count={data.bucketCounts["90+"]} />
                    )}
                    {data.hasPayWhenAble && <AgeBucketChip bucket="pay-when-able" />}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {data.openOrPartial.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="h2">Open</Typography>
              {data.openOrPartial.map((r) => (
                <ReceivableCard
                  key={r._id}
                  receivable={r}
                  onAddRepayment={() => setRepayTarget(r)}
                  onWriteOff={() => setWriteOffTarget(r)}
                />
              ))}
            </Stack>
          )}

          {data.closed.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="h2">Closed</Typography>
              {data.closed.map((r) => (
                <ReceivableCard key={r._id} receivable={r} />
              ))}
            </Stack>
          )}

          {data.writtenOff.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="h2">Written off</Typography>
              {data.writtenOff.map((r) => (
                <ReceivableCard key={r._id} receivable={r} />
              ))}
            </Stack>
          )}

          {data.openOrPartial.length === 0 &&
            data.closed.length === 0 &&
            data.writtenOff.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No receivables with {data.counterparty.displayName}.
              </Typography>
            )}
        </>
      )}

      <AddRepaymentDialog receivable={repayTarget} onClose={() => setRepayTarget(null)} />
      <WriteOffDialog receivable={writeOffTarget} onClose={() => setWriteOffTarget(null)} />
    </Stack>
  );
}
