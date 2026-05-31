"use client";

import { useMemo, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Slider from "@mui/material/Slider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useNetWorth, usePayoffReport, useEmiCalendar } from "@/lib/api/debts";
import { LoanScheduleCard } from "./LoanScheduleCard";

export function DebtsScreen() {
  const { data: netWorth } = useNetWorth();
  const [surplusRupees, setSurplusRupees] = useState<number>(0);
  const surplusPaise = Math.round(surplusRupees * 100);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [redirectHorizon, setRedirectHorizon] = useState<number>(24);
  const [redirectReturn, setRedirectReturn] = useState<number>(12);
  const { data: payoff } = usePayoffReport(surplusPaise, {
    redirectReturnPct: redirectReturn,
    redirectHorizonMonths: redirectHorizon,
  });
  const { data: calendar } = useEmiCalendar(180);

  const loans = netWorth?.liabilities.perAccount.filter((l) => l.kind === "loan") ?? [];
  const totalLoanPaise = netWorth?.liabilities.loanPaise ?? 0;
  const totalCardPaise = netWorth?.liabilities.cardPaise ?? 0;

  const selectedPlan = useMemo(() => {
    if (!payoff) return null;
    return strategy === "avalanche" ? payoff.avalanche : payoff.snowball;
  }, [payoff, strategy]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ sm: "center" }}
      >
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          Debts &amp; payoff
        </Typography>
        {netWorth && (
          <Chip
            color={netWorth.netWorthPaise >= 0 ? "success" : "error"}
            label={
              <Box component="span">
                Net worth{" "}
                <MoneyDisplay paise={netWorth.netWorthPaise} signed monospace />
                {netWorth.isInvestmentPartial && " · investments live in P8"}
              </Box>
            }
          />
        )}
      </Stack>

      {netWorth && (
        <Card>
          <CardContent>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                gap: 2,
              }}
            >
              <Tile
                label="Cash & wallets"
                paise={netWorth.assets.cashPaise}
                positive
              />
              <Tile label="Investments" paise={netWorth.assets.investmentPaise} positive />
              <Tile label="Receivables" paise={netWorth.assets.receivablesPaise} positive />
              <Tile label="Card balance" paise={totalCardPaise} negative />
              <Tile label="Loan outstanding" paise={totalLoanPaise} negative />
              <Tile
                label="Total assets"
                paise={netWorth.assets.totalPaise}
                positive
              />
              <Tile
                label="Total liabilities"
                paise={netWorth.liabilities.totalPaise}
                negative
              />
              <Tile
                label="Net worth"
                paise={netWorth.netWorthPaise}
                positive={netWorth.netWorthPaise >= 0}
                negative={netWorth.netWorthPaise < 0}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Payoff scenario
          </Typography>
          {loans.length === 0 && (
            <Alert severity="info">
              No loan accounts yet. Add a <code>kind: 'loan'</code> account with{" "}
              <code>interestRatePA</code>, <code>tenureMonths</code>, and{" "}
              <code>emiAmountPaise</code> to see avalanche/snowball.
            </Alert>
          )}
          {loans.length > 0 && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Extra surplus per month: <strong>₹{surplusRupees.toLocaleString()}</strong>
                </Typography>
                <Slider
                  value={surplusRupees}
                  onChange={(_, v) => setSurplusRupees(Array.isArray(v) ? v[0]! : v)}
                  min={0}
                  max={50000}
                  step={500}
                  valueLabelDisplay="auto"
                />
              </Box>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={strategy}
                onChange={(_, v) => v && setStrategy(v as "avalanche" | "snowball")}
              >
                <ToggleButton value="avalanche">Avalanche (highest rate)</ToggleButton>
                <ToggleButton value="snowball">Snowball (smallest balance)</ToggleButton>
              </ToggleButtonGroup>

              {payoff?.avalanche && payoff.snowball && (
                <Alert
                  severity={
                    payoff.recommendation === strategy
                      ? "success"
                      : payoff.recommendation === "tied"
                        ? "info"
                        : "warning"
                  }
                >
                  Avalanche: <strong>{payoff.avalanche.totalMonths} months</strong>,
                  interest <MoneyDisplay paise={payoff.avalanche.totalInterestPaise} />.{" "}
                  Snowball: <strong>{payoff.snowball.totalMonths} months</strong>,
                  interest <MoneyDisplay paise={payoff.snowball.totalInterestPaise} />.
                  {payoff.recommendation === "avalanche" && (
                    <>
                      {" "}
                      Avalanche saves{" "}
                      <MoneyDisplay paise={Math.abs(payoff.interestDifferentialPaise)} />.
                    </>
                  )}
                  {payoff.recommendation === "snowball" && (
                    <>
                      {" "}
                      Snowball saves{" "}
                      <MoneyDisplay paise={Math.abs(payoff.interestDifferentialPaise)} />.
                    </>
                  )}
                </Alert>
              )}

              {selectedPlan && (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Per-loan payoff order ({strategy}):
                  </Typography>
                  <Stack divider={<Divider />}>
                    {selectedPlan.perLoan
                      .slice()
                      .sort((a, b) => a.payoffMonthIndex - b.payoffMonthIndex)
                      .map((p) => (
                        <Stack
                          key={p.loanId}
                          direction="row"
                          justifyContent="space-between"
                          sx={{ py: 0.75 }}
                        >
                          <Typography>{p.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            month {p.payoffMonthIndex} · interest{" "}
                            <MoneyDisplay paise={p.interestPaidPaise} />
                          </Typography>
                        </Stack>
                      ))}
                  </Stack>
                </Stack>
              )}

              {payoff?.redirect && payoff.redirect.redirectMonths > 0 && (
                <Alert severity="info">
                  Freed-EMI redirect: keep paying the same{" "}
                  <strong>
                    <MoneyDisplay
                      paise={
                        (loans.reduce((s, l) => s + (l.emiPaise ?? 0), 0)) +
                        surplusPaise
                      }
                    />
                    /mo
                  </strong>{" "}
                  for {redirectHorizon} months at {redirectReturn}% p.a. →{" "}
                  invested <MoneyDisplay paise={payoff.redirect.investedTotalPaise} /> →{" "}
                  <strong>
                    <MoneyDisplay paise={payoff.redirect.futureValuePaise} />
                  </strong>{" "}
                  future value.
                </Alert>
              )}

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Box sx={{ minWidth: 220, flexGrow: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Redirect horizon (months past debt-free)
                  </Typography>
                  <Slider
                    value={redirectHorizon}
                    onChange={(_, v) =>
                      setRedirectHorizon(Array.isArray(v) ? v[0]! : v)
                    }
                    min={0}
                    max={120}
                    step={6}
                    valueLabelDisplay="auto"
                  />
                </Box>
                <Box sx={{ minWidth: 220, flexGrow: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Annual return assumption (%)
                  </Typography>
                  <Slider
                    value={redirectReturn}
                    onChange={(_, v) =>
                      setRedirectReturn(Array.isArray(v) ? v[0]! : v)
                    }
                    min={0}
                    max={20}
                    step={1}
                    valueLabelDisplay="auto"
                  />
                </Box>
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Stack spacing={1.5}>
        <Typography variant="h2">Loan schedules</Typography>
        {loans.length === 0 && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                No loan accounts found.
              </Typography>
            </CardContent>
          </Card>
        )}
        {loans.map((l) => (
          <LoanScheduleCard key={l.accountId} loanId={l.accountId} />
        ))}
      </Stack>

      {calendar && calendar.totalEmiPaise > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              EMI calendar (next {calendar.months.length} months)
            </Typography>
            <Stack spacing={2}>
              {calendar.months.slice(0, 6).map((m) => (
                <Box key={m.yyyyMm}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="body1">
                      <strong>{m.yyyyMm}</strong> · {m.rows.length} EMI{m.rows.length === 1 ? "" : "s"}
                    </Typography>
                    <MoneyDisplay paise={m.totalPaise} monospace />
                  </Stack>
                  <Stack divider={<Divider />}>
                    {m.rows.map((r, i) => (
                      <Stack
                        key={`${r.ruleId}-${r.expectedDate}-${i}`}
                        direction="row"
                        justifyContent="space-between"
                        sx={{ py: 0.5 }}
                      >
                        <Box>
                          <Typography variant="body2">{r.ruleLabel}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {r.expectedDate} ·{" "}
                            {r.cycleIndex && r.totalCycles
                              ? `cycle ${r.cycleIndex}/${r.totalCycles}`
                              : r.status}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="small"
                            color={
                              r.status === "paid"
                                ? "success"
                                : r.status === "overdue"
                                  ? "error"
                                  : r.status === "due_today"
                                    ? "warning"
                                    : "default"
                            }
                            label={r.status}
                          />
                          <MoneyDisplay paise={r.amountPaise} monospace />
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

function Tile({
  label,
  paise,
  positive,
  negative,
}: {
  label: string;
  paise: number;
  positive?: boolean;
  negative?: boolean;
}) {
  const colorize = positive || negative;
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: "background.default" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>
        <MoneyDisplay paise={paise} size="large" colorize={colorize} monospace />
      </Box>
    </Box>
  );
}
