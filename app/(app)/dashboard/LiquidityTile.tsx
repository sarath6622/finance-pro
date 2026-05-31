"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import { alpha, useTheme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
} from "recharts";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useLiquidityForecast } from "@/lib/api/liquidity";

function paiseToRupees(p: number): number {
  return p / 100;
}

export function LiquidityTile() {
  const { data, isLoading } = useLiquidityForecast();
  const theme = useTheme();
  if (isLoading) return <LiquiditySkeleton />;
  if (!data) return null;

  const lineColor = theme.palette.primary.main;
  const breachColor = theme.palette.error.main;
  const breachFill = alpha(theme.palette.error.main, 0.18);
  const axisColor = theme.palette.text.secondary;
  const tooltipBg = theme.palette.background.paper;
  const tooltipBorder = theme.palette.divider;

  const chartData = data.days.map((d) => ({
    date: d.date.slice(5), // "MM-DD"
    rupees: paiseToRupees(d.endPaise),
    raw: d.endPaise,
  }));
  const floorRupees = paiseToRupees(data.floorPaise);
  const minRupees = paiseToRupees(data.minPaise);

  const status = data.firstOverdraftDate
    ? { sev: "error" as const, label: `Overdraft on ${data.firstOverdraftDate}` }
    : data.firstFloorBreachDate
      ? {
          sev: "warning" as const,
          label: `Floor breach on ${data.firstFloorBreachDate}`,
        }
      : { sev: "success" as const, label: "Floor headroom intact" };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Cash to next payday
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              {data.asOf} → {data.nextPayday}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
              <MoneyDisplay paise={data.startingPaise} monospace size="hero" />
              <Typography variant="body2" color="text.secondary">
                →
              </Typography>
              <MoneyDisplay paise={data.minPaise} monospace size="hero" />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              min on {data.minDate}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={
                  <Box component="span">
                    Floor <MoneyDisplay paise={data.floorPaise} />
                  </Box>
                }
              />
              <Chip size="small" color={status.sev} label={status.label} />
              {data.netChangePaise !== 0 && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={
                    <Box component="span">
                      Net change <MoneyDisplay paise={data.netChangePaise} signed />
                    </Box>
                  }
                />
              )}
            </Stack>
          </Box>

          {data.firstFloorBreachDate && (
            <Alert severity={data.firstOverdraftDate ? "error" : "warning"}>
              Projected balance will dip to{" "}
              <strong>
                <MoneyDisplay paise={data.minPaise} signed monospace />
              </strong>{" "}
              on <strong>{data.minDate}</strong> — that's below your floor of{" "}
              <MoneyDisplay paise={data.floorPaise} />.
            </Alert>
          )}

          <Box sx={{ width: "100%", height: { xs: 180, sm: 220 }, mx: -1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 100000
                      ? `₹${(v / 100000).toFixed(1)}L`
                      : Math.abs(v) >= 1000
                        ? `₹${(v / 1000).toFixed(0)}k`
                        : `₹${v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                  labelFormatter={(l: string) => `Day ${l}`}
                />
                <ReferenceArea
                  y2={floorRupees}
                  y1={minRupees < 0 ? minRupees : 0}
                  fill={breachFill}
                  fillOpacity={1}
                />
                <ReferenceLine
                  y={floorRupees}
                  stroke={breachColor}
                  strokeDasharray="4 3"
                  label={{ value: "Floor", fontSize: 11, fill: breachColor }}
                />
                <Line
                  type="monotone"
                  dataKey="rupees"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {data.flows.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {data.flows.length} scheduled flow{data.flows.length === 1 ? "" : "s"} in
              window — next:{" "}
              <strong>{data.flows[0]!.label}</strong> on {data.flows[0]!.date},{" "}
              <MoneyDisplay paise={data.flows[0]!.signedPaise} signed />
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function LiquiditySkeleton() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Skeleton variant="text" width={160} height={14} />
            <Skeleton variant="text" width={200} height={14} sx={{ mb: 1 }} />
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Skeleton variant="text" width={120} height={44} />
              <Skeleton variant="text" width={20} height={20} />
              <Skeleton variant="text" width={120} height={44} />
            </Stack>
            <Skeleton variant="text" width={140} height={14} sx={{ mt: 0.5 }} />
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Skeleton variant="rounded" width={110} height={24} />
              <Skeleton variant="rounded" width={140} height={24} />
            </Stack>
          </Box>
          <Skeleton
            variant="rounded"
            sx={{ width: "100%", height: { xs: 180, sm: 220 } }}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
