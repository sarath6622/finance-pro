"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useSplitsReport } from "@/lib/api/splits";
import { useCounterparties } from "@/lib/api/counterparties";
import { TurfQuickAdd } from "./TurfQuickAdd";

type StatusFilter = "all" | "open" | "partial" | "settled";

export function SplitsScreen() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [turfOpen, setTurfOpen] = useState(false);
  const { data: report, error, isLoading } = useSplitsReport();
  const { data: counterparties = [] } = useCounterparties();
  const cpName = useMemo(
    () => (id: string) => counterparties.find((c) => c._id === id)?.displayName ?? id,
    [counterparties],
  );

  const bills = useMemo(() => {
    if (!report) return [];
    if (filter === "all") return report.bills;
    return report.bills.filter((b) => b.status === filter);
  }, [report, filter]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ sm: "center" }}
      >
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          Splits
        </Typography>
        <Button variant="contained" onClick={() => setTurfOpen(true)}>
          Turf quick-add
        </Button>
      </Stack>

      {error && <Alert severity="error">{(error as Error).message}</Alert>}
      {isLoading && <Typography variant="body2">Loading…</Typography>}

      {report && (
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={3}
              alignItems={{ sm: "center" }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {report.totals.bills} bill{report.totals.bills === 1 ? "" : "s"} ·
                  outstanding
                </Typography>
                <Typography variant="h1" sx={{ fontSize: "2rem" }}>
                  <MoneyDisplay paise={report.totals.outstandingPaise} monospace />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Open {report.totals.openCount} · Partial {report.totals.partialCount} ·
                  Settled {report.totals.settledCount}
                </Typography>
              </Box>
              <ToggleButtonGroup
                value={filter}
                exclusive
                size="small"
                onChange={(_, v) => v && setFilter(v as StatusFilter)}
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="open">Open</ToggleButton>
                <ToggleButton value="partial">Partial</ToggleButton>
                <ToggleButton value="settled">Settled</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack spacing={1.5}>
        {bills.map((b) => {
          const pct = b.totalPaise
            ? Math.min(100, Math.round((b.settledPaise / b.totalPaise) * 100))
            : 0;
          return (
            <Card key={b.splitBillId} variant="outlined">
              <CardActionArea component={Link} href={`/splits/${b.splitBillId}` as never}>
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
                          <MoneyDisplay paise={b.totalPaise} monospace />
                        </Typography>
                        <Chip
                          size="small"
                          color={
                            b.status === "settled"
                              ? "success"
                              : b.status === "partial"
                                ? "warning"
                                : "default"
                          }
                          label={b.status}
                        />
                        {b.isTurf && <Chip size="small" variant="outlined" label="turf" />}
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        {b.participantCount} participant
                        {b.participantCount === 1 ? "" : "s"} · my share{" "}
                        <MoneyDisplay paise={b.ownSharePaise} />{" "}
                        {b.createdAt && `· ${b.createdAt.slice(0, 10)}`}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        color={b.status === "settled" ? "success" : "primary"}
                      />
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary">
                        outstanding
                      </Typography>
                      <MoneyDisplay paise={b.outstandingPaise} monospace size="large" />
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
        {!isLoading && bills.length === 0 && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                No splits in this view yet. Convert any spend into a split from the
                transaction's detail screen, or use the turf quick-add above.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      <TurfQuickAdd
        open={turfOpen}
        onClose={() => setTurfOpen(false)}
        defaultCounterparties={counterparties
          .filter((c) => c.type === "friend" || c.type === "roommate")
          .slice(0, 6)
          .map((c) => ({ _id: c._id, displayName: c.displayName }))}
        cpName={cpName}
      />
    </Stack>
  );
}
