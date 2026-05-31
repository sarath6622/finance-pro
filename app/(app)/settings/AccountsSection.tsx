"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import {
  useAccounts,
  useArchiveAccount,
  useRestoreAccount,
} from "@/lib/api/accounts";
import { AccountDialog } from "./AccountDialog";
import { ApiClientError } from "@/lib/api/client";
import type { ApiAccount } from "@/lib/api/types";

export function AccountsSection() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: accounts = [], isLoading } = useAccounts({ includeInactive });
  const archive = useArchiveAccount();
  const restore = useRestoreAccount();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiAccount | undefined>(undefined);

  function onEdit(a: ApiAccount) {
    setEditing(a);
    setDialogOpen(true);
  }

  function onAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  async function onArchive(a: ApiAccount) {
    try {
      await archive.mutateAsync(a._id);
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Archive failed");
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            flexWrap="wrap"
          >
            <Typography variant="h2">Accounts</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                  />
                }
                label="Show archived"
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAdd}
              >
                Add
              </Button>
            </Stack>
          </Stack>
          {isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          ) : accounts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No accounts yet. Add your bank, cards, cash, loans, and investment platforms.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {accounts.map((a) => (
                <AccountRow
                  key={a._id}
                  account={a}
                  onEdit={() => onEdit(a)}
                  onArchive={() => onArchive(a)}
                  onRestore={() => restore.mutate(a._id)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
      <AccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        account={editing}
      />
    </Card>
  );
}

function AccountRow({
  account,
  onEdit,
  onArchive,
  onRestore,
}: {
  account: ApiAccount;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  // hover the detail query only when opening the edit dialog — skip here to avoid N requests
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ py: 1.25 }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {account.name}
          </Typography>
          <Chip
            label={account.kind.replace("_", " ")}
            size="small"
            variant="outlined"
          />
          {!account.isActive && <Chip label="archived" size="small" color="default" />}
          {account.last4Label && (
            <Typography variant="caption" color="text.secondary">
              ••{account.last4Label}
            </Typography>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Opening: <MoneyDisplay paise={account.openingBalancePaise} /> · Current:{" "}
          <MoneyDisplay paise={account.balancePaise} />
        </Typography>
      </Box>
      <Tooltip title="Edit">
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {account.isActive ? (
        <Tooltip title="Archive">
          <IconButton size="small" onClick={onArchive}>
            <ArchiveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Restore">
          <IconButton size="small" onClick={onRestore}>
            <UnarchiveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

