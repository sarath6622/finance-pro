"use client";

import { useMemo, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import {
  useEndRecurringRule,
  useRecurringRules,
  useUpdateRecurringRule,
  type ApiRecurringRule,
} from "@/lib/api/recurring";
import { useAccounts } from "@/lib/api/accounts";
import { flowTypeLabel } from "@/lib/flow/labels";
import { NewRuleDialog } from "./NewRuleDialog";

function statusColor(s: ApiRecurringRule["status"]): "success" | "warning" | "default" {
  if (s === "active") return "success";
  if (s === "paused") return "warning";
  return "default";
}

function frequencyLabel(r: ApiRecurringRule): string {
  if (r.frequency === "monthly") return `Day ${r.dayOfMonth ?? "?"} · monthly`;
  if (r.frequency === "weekly") return "weekly";
  return r.frequency;
}

export function RecurringScreen() {
  const { data: rules = [], isLoading, error } = useRecurringRules();
  const { data: accounts = [] } = useAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuRule, setMenuRule] = useState<{ rule: ApiRecurringRule; anchor: HTMLElement } | null>(
    null,
  );
  const [opError, setOpError] = useState<string | null>(null);

  const accountName = useMemo(
    () => (id: string) => accounts.find((a) => a._id === id)?.name ?? id,
    [accounts],
  );

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          Recurring rules
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          New rule
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Dad support, rent, SIPs, EMIs. Skipped cycles surface as arrears on the dashboard.
      </Typography>
      {opError && <Alert severity="error">{opError}</Alert>}
      {error && <Alert severity="error">{(error as Error).message}</Alert>}

      <Card>
        <CardContent>
          {isLoading && <Typography variant="body2">Loading…</Typography>}
          {!isLoading && rules.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No recurring rules yet. Click <strong>New rule</strong> to add one.
            </Typography>
          )}
          <Stack divider={<Divider />}>
            {rules.map((r) => (
              <Stack key={r._id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.5 }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h3">{r.label}</Typography>
                    <Chip size="small" color={statusColor(r.status)} label={r.status} />
                    {r.endDate && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`ends ${r.endDate}`}
                      />
                    )}
                    {r.arrearsPolicy === "skip" && (
                      <Chip size="small" variant="outlined" label="skip arrears" />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {flowTypeLabel(r.flowType)} · {accountName(r.accountId)} · {frequencyLabel(r)} · start {r.startDate}
                  </Typography>
                </Box>
                <MoneyDisplay paise={r.amountPaise} monospace />
                <IconButton
                  size="small"
                  onClick={(e) => setMenuRule({ rule: r, anchor: e.currentTarget })}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
      <NewRuleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <RuleMenu
        state={menuRule}
        onClose={() => setMenuRule(null)}
        onError={setOpError}
      />
    </Stack>
  );
}

interface RuleMenuProps {
  state: { rule: ApiRecurringRule; anchor: HTMLElement } | null;
  onClose: () => void;
  onError: (msg: string | null) => void;
}

function RuleMenu({ state, onClose, onError }: RuleMenuProps) {
  const updateMutation = useUpdateRecurringRule(state?.rule._id ?? "");
  const endMutation = useEndRecurringRule();
  if (!state) return null;
  const { rule, anchor } = state;
  async function toggle(target: "active" | "paused") {
    try {
      await updateMutation.mutateAsync({ status: target });
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed");
    }
  }
  async function end() {
    try {
      await endMutation.mutateAsync(rule._id);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <Menu anchorEl={anchor} open onClose={onClose}>
      {rule.status === "active" ? (
        <MenuItem onClick={() => toggle("paused")}>Pause</MenuItem>
      ) : rule.status === "paused" ? (
        <MenuItem onClick={() => toggle("active")}>Resume</MenuItem>
      ) : null}
      {rule.status !== "ended" && (
        <MenuItem onClick={end} sx={{ color: "error.main" }}>
          End rule
        </MenuItem>
      )}
    </Menu>
  );
}
