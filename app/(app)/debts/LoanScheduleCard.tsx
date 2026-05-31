"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useLoanSchedule } from "@/lib/api/debts";

export function LoanScheduleCard({ loanId }: { loanId: string }) {
  const { data, isLoading, error } = useLoanSchedule(loanId);
  const [open, setOpen] = useState(false);
  if (isLoading) return null;
  if (error) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="error">
            {(error as Error).message}
          </Typography>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const paidPct = data.account.openingBalancePaise
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            // eslint-disable-next-line no-restricted-syntax -- progress %, not money math
            ((data.account.openingBalancePaise - data.outstandingPaise) /
              data.account.openingBalancePaise) *
              100,
          ),
        ),
      )
    : 0;
  const rows = data.remaining?.rows ?? data.contractual.rows;
  const totalInterest = data.remaining?.totalInterestPaise ?? data.contractual.totalInterestPaise;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="h3">{data.account.name}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                variant="outlined"
                label={`${data.account.interestRatePA.toFixed(2)}% p.a.`}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`tenure ${data.account.tenureMonths}m`}
              />
              {data.account.emiAmountPaise && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={
                    <Box component="span">
                      EMI <MoneyDisplay paise={data.account.emiAmountPaise} />
                    </Box>
                  }
                />
              )}
            </Stack>
            <LinearProgress
              variant="determinate"
              value={paidPct}
              sx={{ mt: 1, height: 6, borderRadius: 3 }}
              color="primary"
            />
            <Typography variant="caption" color="text.secondary">
              {paidPct}% paid down · remaining interest{" "}
              <MoneyDisplay paise={totalInterest} />
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="caption" color="text.secondary">
              outstanding
            </Typography>
            <MoneyDisplay paise={data.outstandingPaise} monospace size="large" />
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button size="small" variant="outlined" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide schedule" : "Show schedule"}
          </Button>
        </Stack>

        <Collapse in={open} unmountOnExit>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mo</TableCell>
                  <TableCell align="right">Payment</TableCell>
                  <TableCell align="right">Interest</TableCell>
                  <TableCell align="right">Principal</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 60).map((r) => (
                  <TableRow key={r.monthIndex}>
                    <TableCell>{r.monthIndex}</TableCell>
                    <TableCell align="right">
                      <MoneyDisplay paise={r.paymentPaise} monospace />
                    </TableCell>
                    <TableCell align="right">
                      <MoneyDisplay paise={r.interestPaise} monospace />
                    </TableCell>
                    <TableCell align="right">
                      <MoneyDisplay paise={r.principalPaise} monospace />
                    </TableCell>
                    <TableCell align="right">
                      <MoneyDisplay paise={r.balancePaise} monospace />
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length > 60 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="caption" color="text.secondary">
                        {rows.length - 60} more rows hidden — schedule continues.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
