"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useNetWorth } from "@/lib/api/debts";

export function NetWorthTile() {
  const { data } = useNetWorth();
  if (!data) return null;
  const { netWorthPaise, assets, liabilities, isInvestmentPartial } = data;
  return (
    <Card>
      <CardActionArea component={Link} href={"/debts" as never}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Net worth · assets − liabilities
              </Typography>
              <Box>
                <MoneyDisplay
                  paise={netWorthPaise}
                  size="large"
                  signed
                  colorize
                  monospace
                />
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
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
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box textAlign="right">
                <Typography variant="caption" color="text.secondary">
                  cash
                </Typography>
                <Box>
                  <MoneyDisplay paise={assets.cashPaise} monospace />
                </Box>
              </Box>
              <Box textAlign="right">
                <Typography variant="caption" color="text.secondary">
                  loans
                </Typography>
                <Box>
                  <MoneyDisplay paise={liabilities.loanPaise} monospace />
                </Box>
              </Box>
              <Box textAlign="right">
                <Typography variant="caption" color="text.secondary">
                  cards
                </Typography>
                <Box>
                  <MoneyDisplay paise={liabilities.cardPaise} monospace />
                </Box>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
