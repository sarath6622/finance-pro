"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AgeBucketChip } from "@/components/AgeBucketChip";
import { useReceivablesExposure } from "@/lib/api/receivables";

export function OwedToMeTile() {
  const { data, isLoading } = useReceivablesExposure();
  if (isLoading) return <OwedToMeSkeleton />;
  if (!data) return null;
  const { totals } = data;
  if (totals.outstandingPaise === 0 && totals.overpaymentPaise === 0) return null;
  return (
    <Card>
      <CardActionArea component={Link} href={"/lending" as never}>
        <CardContent>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Owed to me · {totals.counterpartyCount} people
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <MoneyDisplay paise={totals.outstandingPaise} size="hero" monospace />
              </Box>
              {totals.overpaymentPaise > 0 && (
                <Typography variant="caption" color="info.main" sx={{ display: "block", mt: 0.5 }}>
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

function OwedToMeSkeleton() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Skeleton variant="text" width={180} height={14} />
            <Skeleton variant="text" width={180} height={44} sx={{ mt: 0.5 }} />
          </Box>
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={90} height={24} />
            <Skeleton variant="rounded" width={90} height={24} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
