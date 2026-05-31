"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useNetWorth } from "@/lib/api/debts";

export function NetWorthTile() {
  const { data, isLoading } = useNetWorth();
  if (isLoading) return <NetWorthSkeleton />;
  if (!data) return null;
  const { netWorthPaise, assets, liabilities, isInvestmentPartial } = data;
  return (
    <Card>
      <CardActionArea component={Link} href={"/debts" as never}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Net worth · assets − liabilities
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <MoneyDisplay
                  paise={netWorthPaise}
                  size="hero"
                  signed
                  colorize
                  monospace
                />
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={
                    <Box component="span">
                      Assets <MoneyDisplay paise={assets.totalPaise} />
                    </Box>
                  }
                />
                <Chip
                  size="small"
                  label={
                    <Box component="span">
                      Liabilities <MoneyDisplay paise={liabilities.totalPaise} />
                    </Box>
                  }
                />
                {isInvestmentPartial && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="warning"
                    label="investments full value lands P8"
                  />
                )}
              </Stack>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                pt: 1.5,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <MiniStat label="Cash" paise={assets.cashPaise} />
              <MiniStat label="Loans" paise={liabilities.loanPaise} />
              <MiniStat label="Cards" paise={liabilities.cardPaise} />
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function NetWorthSkeleton() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Skeleton variant="text" width={180} height={16} />
            <Skeleton variant="text" width={220} height={48} sx={{ mt: 0.5 }} />
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Skeleton variant="rounded" width={110} height={24} />
              <Skeleton variant="rounded" width={130} height={24} />
            </Stack>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1,
              pt: 1.5,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            {[0, 1, 2].map((i) => (
              <Box key={i}>
                <Skeleton variant="text" width={50} height={14} />
                <Skeleton variant="text" width={90} height={28} />
              </Box>
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, paise }: { label: string; paise: number }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <MoneyDisplay paise={paise} monospace size="large" />
    </Box>
  );
}
