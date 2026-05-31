"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AgeBucketChip } from "@/components/AgeBucketChip";
import { useReceivablesExposure } from "@/lib/api/receivables";
import { useCounterparties } from "@/lib/api/counterparties";
import { ImportReceivableDialog } from "./ImportReceivableDialog";

export function LendingScreen() {
  const { data: exposure, isLoading, error } = useReceivablesExposure();
  const { data: counterparties = [] } = useCounterparties();
  const [importOpen, setImportOpen] = useState(false);
  const cpName = useMemo(
    () => (id: string) => counterparties.find((c) => c._id === id)?.displayName ?? id,
    [counterparties],
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="h1">Owed to me</Typography>
        <Button size="small" variant="outlined" onClick={() => setImportOpen(true)}>
          Import existing
        </Button>
      </Stack>
      {error && <Alert severity="error">{(error as Error).message}</Alert>}
      {isLoading && <Typography variant="body2">Loading…</Typography>}

      {exposure && (
        <Card>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Total outstanding · {exposure.totals.counterpartyCount} people
                </Typography>
                <Typography variant="h1" sx={{ fontSize: "2rem" }}>
                  <MoneyDisplay paise={exposure.totals.outstandingPaise} monospace />
                </Typography>
                {exposure.totals.payWhenAblePaise > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Includes <MoneyDisplay paise={exposure.totals.payWhenAblePaise} /> pay-when-able
                  </Typography>
                )}
                {exposure.totals.overpaymentPaise > 0 && (
                  <Typography variant="body2" color="info.main" sx={{ mt: 0.5 }}>
                    + <MoneyDisplay paise={exposure.totals.overpaymentPaise} /> in advances
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <AgeBucketChip bucket="0-30" count={exposure.totals.byBucket["0-30"]} />
                <AgeBucketChip bucket="30-90" count={exposure.totals.byBucket["30-90"]} />
                <AgeBucketChip bucket="90+" count={exposure.totals.byBucket["90+"]} />
                {exposure.totals.hasPayWhenAble && <AgeBucketChip bucket="pay-when-able" />}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack spacing={1.5}>
        {exposure?.perCounterparty.map((cp) => (
          <Card key={cp.counterpartyId} variant="outlined">
            <CardActionArea component={Link} href={`/lending/${cp.counterpartyId}` as never}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="h3">{cpName(cp.counterpartyId)}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                      {cp.cashLoanPaise > 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`cash loan · ${formatRupees(cp.cashLoanPaise)}`}
                        />
                      )}
                      {cp.splitIouPaise > 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`split · ${formatRupees(cp.splitIouPaise)}`}
                        />
                      )}
                      {cp.payWhenAblePaise > 0 && <AgeBucketChip bucket="pay-when-able" />}
                      {cp.bucketCounts["90+"] > 0 && (
                        <AgeBucketChip bucket="90+" count={cp.bucketCounts["90+"]} />
                      )}
                    </Stack>
                  </Box>
                  <Box textAlign="right">
                    <MoneyDisplay paise={cp.totalOutstandingPaise} size="large" monospace />
                    <Typography variant="caption" color="text.secondary" display="block">
                      {cp.receivableIds.length} loan{cp.receivableIds.length === 1 ? "" : "s"}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        {!isLoading && exposure && exposure.perCounterparty.length === 0 && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Nobody owes you anything right now. For new lend-outs, use the{" "}
                <strong>Add</strong> screen (flow type <strong>Lend</strong>). For a
                loan that pre-dates this tracker, click <strong>Import existing</strong>{" "}
                above — it records the IOU without debiting your bank.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>
      <Divider />
      <Typography variant="caption" color="text.secondary">
        Pay-when-able loans never auto-write-off — they stay visible until you settle or write
        them off manually.
      </Typography>
      <ImportReceivableDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </Stack>
  );
}

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return `₹${rupees.toFixed(0)}`;
}
