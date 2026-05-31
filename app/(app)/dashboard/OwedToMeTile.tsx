"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AgeBucketChip } from "@/components/AgeBucketChip";
import { useReceivablesExposure } from "@/lib/api/receivables";

export function OwedToMeTile() {
  const { data } = useReceivablesExposure();
  if (!data) return null;
  const { totals } = data;
  if (totals.outstandingPaise === 0 && totals.overpaymentPaise === 0) return null;
  return (
    <Card>
      <CardActionArea component={Link} href={"/lending" as never}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Owed to me · {totals.counterpartyCount} people
              </Typography>
              <Box>
                <MoneyDisplay paise={totals.outstandingPaise} size="large" monospace />
              </Box>
              {totals.overpaymentPaise > 0 && (
                <Typography variant="caption" color="info.main">
                  + advances <MoneyDisplay paise={totals.overpaymentPaise} />
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {totals.byBucket["90+"] > 0 && (
                <AgeBucketChip bucket="90+" count={totals.byBucket["90+"]} />
              )}
              {totals.byBucket["30-90"] > 0 && (
                <AgeBucketChip bucket="30-90" count={totals.byBucket["30-90"]} />
              )}
              {totals.byBucket["0-30"] > 0 && (
                <AgeBucketChip bucket="0-30" count={totals.byBucket["0-30"]} />
              )}
              {totals.hasPayWhenAble && <AgeBucketChip bucket="pay-when-able" />}
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
