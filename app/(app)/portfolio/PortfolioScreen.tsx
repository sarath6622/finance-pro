"use client";

import { useState } from "react";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useHoldings, usePortfolio } from "@/lib/api/holdings";
import { CreateHoldingDialog } from "./CreateHoldingDialog";

const COLORS = ["#1976d2", "#9c27b0", "#2e7d32", "#ed6c02", "#0288d1", "#7b1fa2"];

function pctLabel(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function PortfolioScreen() {
  const { data: portfolio, isLoading } = usePortfolio();
  const { data: holdingsList } = useHoldings();
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) return <Typography variant="body2">Loading…</Typography>;

  const totals = portfolio?.totals;
  const isUp = (totals?.unrealizedPnLPaise ?? 0) >= 0;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}>
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          Portfolio
        </Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New holding
        </Button>
      </Stack>

      {totals && totals.holdingCount === 0 && (
        <Alert severity="info">
          You don&apos;t have any holdings yet. Click <strong>New holding</strong> to start
          tracking a crypto / stock / mutual-fund position. Each position has FIFO
          lots, live-or-last-known price, and feeds your net worth automatically.
        </Alert>
      )}

      {totals && totals.holdingCount > 0 && (
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={3}
              alignItems={{ sm: "center" }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Total value · {totals.holdingCount} holdings
                </Typography>
                <Typography variant="h1" sx={{ fontSize: "2rem" }}>
                  <MoneyDisplay paise={totals.marketValuePaise} monospace />
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color={isUp ? "success" : "error"}
                    label={
                      <Box component="span">
                        Unrealized{" "}
                        <MoneyDisplay paise={totals.unrealizedPnLPaise} signed />
                      </Box>
                    }
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      <Box component="span">
                        Cost basis <MoneyDisplay paise={totals.costBasisPaise} />
                      </Box>
                    }
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      <Box component="span">
                        Realized <MoneyDisplay paise={totals.realizedPnLPaise} signed />
                      </Box>
                    }
                  />
                  {totals.stalePriceCount > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={`${totals.stalePriceCount} stale price${totals.stalePriceCount === 1 ? "" : "s"}`}
                    />
                  )}
                </Stack>
              </Box>
              <Box sx={{ width: { xs: "100%", sm: 240 }, height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolio.byAssetType.map((b) => ({
                        name: b.key,
                        value: b.marketValuePaise,
                        pct: b.pct,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {portfolio.byAssetType.map((_, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        `₹${(v / 100).toLocaleString("en-IN")} (${name})`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                By asset type
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {portfolio.byAssetType.map((b, i) => (
                  <Chip
                    key={b.key}
                    label={
                      <Box component="span">
                        <strong>{b.key.replace("_", " ")}</strong>{" "}
                        <MoneyDisplay paise={b.marketValuePaise} />{" "}
                        <Box component="span" sx={{ opacity: 0.7 }}>
                          {pctLabel(b.pct)}
                        </Box>
                      </Box>
                    }
                    sx={{ borderColor: COLORS[i % COLORS.length] }}
                    variant="outlined"
                  />
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                By platform
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {portfolio.byPlatform.map((b) => (
                  <Chip
                    key={b.key}
                    variant="outlined"
                    label={
                      <Box component="span">
                        {b.key} <MoneyDisplay paise={b.marketValuePaise} />{" "}
                        <Box component="span" sx={{ opacity: 0.7 }}>
                          {pctLabel(b.pct)}
                        </Box>
                      </Box>
                    }
                  />
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack spacing={1.5}>
        {holdingsList?.items.map((h) => (
          <Card key={h._id} variant="outlined">
            <CardActionArea component={Link} href={`/portfolio/${h._id}` as never}>
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={2}
                >
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="h3" sx={{ flexShrink: 0 }}>
                        {h.symbol}
                      </Typography>
                      <Chip size="small" variant="outlined" label={h.platform} />
                      <Chip size="small" label={h.assetType.replace("_", " ")} />
                      {h.priceCurrency === "USD" && (
                        <Chip size="small" variant="outlined" label="USD-priced" />
                      )}
                      {h.isStalePrice && !h.isInvestmentPartial && (
                        <Chip size="small" color="warning" label="stale price" />
                      )}
                      {h.isInvestmentPartial && (
                        <Chip size="small" color="warning" label="no price" />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {h.name} · qty {h.quantity.toLocaleString("en-IN", { maximumFractionDigits: 8 })}
                      {h.priceUpdatedAt &&
                        ` · price as of ${new Date(h.priceUpdatedAt).toISOString().slice(0, 10)}`}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <MoneyDisplay paise={h.marketValuePaise} monospace size="large" />
                    <Typography
                      variant="caption"
                      color={h.unrealizedPnLPaise >= 0 ? "success.main" : "error.main"}
                      display="block"
                    >
                      <MoneyDisplay paise={h.unrealizedPnLPaise} signed monospace />
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        {holdingsList && holdingsList.items.length === 0 && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                No holdings yet — create one above.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      <CreateHoldingDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}
