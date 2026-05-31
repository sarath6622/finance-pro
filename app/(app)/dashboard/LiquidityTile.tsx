"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
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
  if (isLoading || !data) return null;

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
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Cash to next payday · {data.asOf} → {data.nextPayday}
              </Typography>
              <Typography variant="h2">
                <MoneyDisplay paise={data.startingPaise} monospace /> →{" "}
                <MoneyDisplay paise={data.minPaise} monospace />{" "}
                <Typography component="span" variant="caption" color="text.secondary">
                  min on {data.minDate}
                </Typography>
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={
                    <Box component="span">
                      Floor <MoneyDisplay paise={data.floorPaise} />
                    </Box>
                  }
                />
                <Chip
                  size="small"
                  color={status.sev}
                  label={status.label}
                />
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
          </Stack>

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

          <Box sx={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 100000
                      ? `₹${(v / 100000).toFixed(1)}L`
                      : Math.abs(v) >= 1000
                        ? `₹${(v / 1000).toFixed(0)}k`
                        : `₹${v}`
                  }
                />
                <Tooltip
                  formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                  labelFormatter={(l: string) => `Day ${l}`}
                />
                <ReferenceArea y2={floorRupees} y1={minRupees < 0 ? minRupees : 0} fill="#ffcdd2" fillOpacity={0.25} />
                <ReferenceLine
                  y={floorRupees}
                  stroke="#d32f2f"
                  strokeDasharray="4 3"
                  label={{ value: "Floor", fontSize: 11, fill: "#d32f2f" }}
                />
                <Line
                  type="monotone"
                  dataKey="rupees"
                  stroke="#1976d2"
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
