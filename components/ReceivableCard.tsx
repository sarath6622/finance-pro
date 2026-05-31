"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import LinearProgress from "@mui/material/LinearProgress";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { AgeBucketChip } from "@/components/AgeBucketChip";
import type { ApiReceivable } from "@/lib/api/receivables";

function statusColor(s: ApiReceivable["status"]): "default" | "warning" | "success" | "error" {
  if (s === "open") return "warning";
  if (s === "partial") return "warning";
  if (s === "closed") return "success";
  if (s === "written_off") return "error";
  return "default";
}

export interface ReceivableCardProps {
  receivable: ApiReceivable;
  onAddRepayment?: () => void;
  onWriteOff?: () => void;
}

export function ReceivableCard({
  receivable,
  onAddRepayment,
  onWriteOff,
}: ReceivableCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const pct =
    receivable.principalPaise === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            // eslint-disable-next-line no-restricted-syntax -- progress %, not money math
            ((receivable.principalPaise - receivable.outstandingPaise) /
              receivable.principalPaise) *
              100,
          ),
        );
  const canRepay =
    receivable.status !== "closed" && receivable.status !== "written_off";

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h3">
                <MoneyDisplay paise={receivable.principalPaise} monospace />
              </Typography>
              <Chip size="small" color={statusColor(receivable.status)} label={receivable.status} />
              <AgeBucketChip bucket={receivable.ageBucket} />
              {receivable.kind === "split_iou" && (
                <Chip size="small" variant="outlined" label="split" />
              )}
              {receivable.overpaymentPaise > 0 && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="info"
                  label={`advance ₹${(receivable.overpaymentPaise / 100).toFixed(0)}`}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {receivable.dateIncurred}
              {receivable.expectedReturnDate && ` · expected ${receivable.expectedReturnDate}`}
              {receivable.dueModel === "when_able" && " · when able"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {canRepay && onAddRepayment && (
              <Button size="small" variant="contained" onClick={onAddRepayment}>
                Add repayment
              </Button>
            )}
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              {canRepay && onWriteOff && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onWriteOff();
                  }}
                  sx={{ color: "error.main" }}
                >
                  Write off
                </MenuItem>
              )}
            </Menu>
          </Stack>
        </Stack>
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{ height: 6, borderRadius: 3 }}
            color={canRepay ? "primary" : "success"}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {pct}% returned
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <MoneyDisplay paise={receivable.outstandingPaise} monospace /> outstanding
            </Typography>
          </Stack>
        </Box>
        {receivable.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {receivable.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
