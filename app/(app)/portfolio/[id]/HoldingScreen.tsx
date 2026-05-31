"use client";

import { useState } from "react";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useDeleteHolding, useHolding } from "@/lib/api/holdings";
import { BuyDialog } from "./BuyDialog";
import { SellDialog } from "./SellDialog";
import { PriceDialog } from "./PriceDialog";
import { TransferDialog } from "./TransferDialog";
import { CorporateActionDialog } from "./CorporateActionDialog";

export function HoldingScreen({ id }: { id: string }) {
  const { data, isLoading, error } = useHolding(id);
  const del = useDeleteHolding(id);
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [caOpen, setCaOpen] = useState(false);

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;
  if (isLoading || !data) return <Typography variant="body2">Loading…</Typography>;

  const { holding, valuation, corporateActions, transactions } = data;
  const pnlColor = valuation.unrealizedPnLPaise >= 0 ? "success.main" : "error.main";

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {holding.assetType.replace("_", " ")} · {holding.platform}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h1">{holding.symbol}</Typography>
            <Chip size="small" variant="outlined" label={holding.name} />
            {holding.priceCurrency === "USD" && (
              <Chip size="small" variant="outlined" label="USD-priced" />
            )}
            {valuation.isStalePrice && !valuation.isInvestmentPartial && (
              <Chip size="small" color="warning" label="stale price" />
            )}
            {valuation.isInvestmentPartial && (
              <Chip size="small" color="warning" label="no price yet" />
            )}
          </Stack>
        </Box>
        <Button component={Link} href={"/portfolio" as never} size="small">
          Back
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems={{ md: "center" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Market value · qty {holding.quantity.toLocaleString("en-IN", { maximumFractionDigits: 8 })}
              </Typography>
              <Typography variant="h1" sx={{ fontSize: "2rem" }}>
                <MoneyDisplay paise={valuation.marketValuePaise} monospace />
              </Typography>
              <Typography variant="body2" sx={{ color: pnlColor }}>
                Unrealized <MoneyDisplay paise={valuation.unrealizedPnLPaise} signed monospace />
                {" "}· Realized <MoneyDisplay paise={valuation.realizedPnLPaise} signed monospace />
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Cost basis <MoneyDisplay paise={valuation.costBasisPaise} />
                {valuation.priceUpdatedAt && (
                  <> · price as of {new Date(valuation.priceUpdatedAt).toISOString().slice(0, 10)}</>
                )}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" onClick={() => setBuyOpen(true)}>
                Buy
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSellOpen(true)}
                disabled={holding.quantity <= 0}
              >
                Sell
              </Button>
              <Button size="small" variant="outlined" onClick={() => setPriceOpen(true)}>
                Update price
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setTransferOpen(true)}
                disabled={holding.quantity <= 0}
              >
                Transfer
              </Button>
              <Button size="small" variant="outlined" onClick={() => setCaOpen(true)}>
                Corp. action
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            FIFO lots ({holding.lots.length})
          </Typography>
          {holding.lots.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No lots yet. Click <strong>Buy</strong> to add one.
            </Typography>
          )}
          {holding.lots.length > 0 && (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit cost</TableCell>
                    <TableCell align="right">Cost basis</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {holding.lots.map((l, i) => (
                    <TableRow key={`${l.date}-${i}`}>
                      <TableCell>{l.date}</TableCell>
                      <TableCell align="right">
                        {l.quantity.toLocaleString("en-IN", { maximumFractionDigits: 8 })}
                      </TableCell>
                      <TableCell align="right">
                        <MoneyDisplay paise={l.unitCostPaise} monospace />
                      </TableCell>
                      <TableCell align="right">
                        <MoneyDisplay paise={Math.round(l.quantity * l.unitCostPaise)} monospace />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {corporateActions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Corporate actions ({corporateActions.length})
            </Typography>
            <Stack divider={<Divider />}>
              {corporateActions.map((ca, i) => (
                <Stack
                  key={i}
                  direction="row"
                  justifyContent="space-between"
                  sx={{ py: 1 }}
                >
                  <Typography variant="body2">
                    {ca.kind} {ca.ratioNumerator}:{ca.ratioDenominator}
                    {ca.notes && <> · {ca.notes}</>}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(ca.at).toISOString().slice(0, 10)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Transactions ({transactions.length})
          </Typography>
          {transactions.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No buy/sell transactions yet.
            </Typography>
          )}
          {transactions.length > 0 && (
            <Stack divider={<Divider />}>
              {transactions.map((t) => (
                <Stack
                  key={t._id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ py: 1 }}
                >
                  <Box>
                    <Typography variant="body2">
                      {t.direction === "out" ? "Buy" : "Sell"} · {t.description || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.valueDate}
                    </Typography>
                  </Box>
                  <MoneyDisplay paise={t.direction === "out" ? -t.amountPaise : t.amountPaise} signed monospace />
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {holding.quantity === 0 && (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Quantity is 0 — this position is closed. You can archive it.
              </Typography>
              <Button
                size="small"
                color="warning"
                onClick={async () => {
                  if (!confirm("Archive this holding?")) return;
                  await del.mutateAsync();
                  history.back();
                }}
              >
                Archive
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <BuyDialog open={buyOpen} onClose={() => setBuyOpen(false)} holdingId={id} symbol={holding.symbol} />
      <SellDialog open={sellOpen} onClose={() => setSellOpen(false)} holdingId={id} symbol={holding.symbol} maxQty={holding.quantity} />
      <PriceDialog open={priceOpen} onClose={() => setPriceOpen(false)} holdingId={id} priceCurrency={holding.priceCurrency} />
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} holdingId={id} maxQty={holding.quantity} currentPlatform={holding.platform} />
      <CorporateActionDialog open={caOpen} onClose={() => setCaOpen(false)} holdingId={id} />
    </Stack>
  );
}
