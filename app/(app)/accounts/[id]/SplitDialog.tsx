"use client";

import { useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { ApiTransaction, SplitChildBody } from "@/lib/api/types";
import type { FlowType } from "@/lib/schemas/common";
import { MoneyInput } from "@/components/MoneyInput";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { FlowTypeSelector } from "@/components/FlowTypeSelector";
import { useSplitTransaction } from "@/lib/api/transactions";
import { ApiClientError } from "@/lib/api/client";

const SPLIT_FLOW_OPTIONS = [
  { value: "spend" as FlowType, label: "Spend" },
  { value: "family_support" as FlowType, label: "Family" },
  { value: "investment" as FlowType, label: "Invest" },
  { value: "debt_repayment" as FlowType, label: "EMI" },
  { value: "lending_out" as FlowType, label: "Lend" },
  { value: "fee" as FlowType, label: "Fee" },
];

interface ChildRow {
  amountPaise: number | null;
  flowType: FlowType;
  description: string;
}

export interface SplitDialogProps {
  parent: ApiTransaction | null;
  onClose: () => void;
}

export function SplitDialog({ parent, onClose }: SplitDialogProps) {
  const open = !!parent;
  const split = useSplitTransaction(parent?._id ?? "");
  const [rows, setRows] = useState<ChildRow[]>([
    { amountPaise: null, flowType: "spend", description: "" },
    { amountPaise: null, flowType: "spend", description: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const sumPaise = useMemo(
    () => rows.reduce((s, r) => s + (r.amountPaise ?? 0), 0),
    [rows],
  );
  const targetPaise = parent?.amountPaise ?? 0;
  const diff = targetPaise - sumPaise;
  const canSave =
    !!parent && diff === 0 && rows.every((r) => (r.amountPaise ?? 0) > 0);

  if (!parent) return null;

  function setRow(i: number, patch: Partial<ChildRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { amountPaise: null, flowType: "spend", description: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function onSave() {
    setError(null);
    const children: SplitChildBody[] = rows.map((r) => ({
      amountPaise: r.amountPaise!,
      flowType: r.flowType,
      description: r.description,
    }));
    try {
      await split.mutateAsync({ children });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to split");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Split transaction · target <MoneyDisplay paise={targetPaise} monospace />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {rows.map((r, i) => (
            <Box
              key={i}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <MoneyInput
                  label={`Child ${i + 1}`}
                  valuePaise={r.amountPaise}
                  onChangePaise={(p) => setRow(i, { amountPaise: p })}
                  size="small"
                  sx={{ flexGrow: 1 }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 2}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
              <FlowTypeSelector
                value={r.flowType}
                onChange={(v) => setRow(i, { flowType: v })}
                options={SPLIT_FLOW_OPTIONS}
              />
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={addRow} variant="text">
            Add row
          </Button>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Sum
            </Typography>
            <Box>
              <MoneyDisplay paise={sumPaise} monospace />
              {diff !== 0 && (
                <Typography variant="body2" color="error" sx={{ ml: 1, display: "inline" }}>
                  diff <MoneyDisplay paise={diff} signed monospace />
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={!canSave || split.isPending}>
          {split.isPending ? "Splitting…" : "Split"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
