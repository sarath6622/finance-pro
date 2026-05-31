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
import {
  useCounterparties,
  useArchiveCounterparty,
  useRestoreCounterparty,
} from "@/lib/api/counterparties";
import { CounterpartyDialog } from "./CounterpartyDialog";
import { ApiClientError } from "@/lib/api/client";
import type { ApiCounterparty } from "@/lib/api/types";

export function CounterpartiesSection() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: people = [], isLoading } = useCounterparties({ includeInactive });
  const archive = useArchiveCounterparty();
  const restore = useRestoreCounterparty();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCounterparty | undefined>(undefined);

  function onAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function onEdit(cp: ApiCounterparty) {
    setEditing(cp);
    setDialogOpen(true);
  }

  async function onArchive(cp: ApiCounterparty) {
    try {
      await archive.mutateAsync(cp._id);
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
            flexWrap="wrap"
            spacing={1}
          >
            <Typography variant="h2">Counterparties</Typography>
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
          ) : people.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No counterparties yet. Add family, roommates, friends, employer, etc.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {people.map((cp) => (
                <Stack
                  key={cp._id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ py: 1.25 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {cp.displayName}
                      </Typography>
                      <Chip label={cp.type} size="small" variant="outlined" />
                      {!cp.isActive && (
                        <Chip label="archived" size="small" color="default" />
                      )}
                    </Stack>
                    {cp.aliases.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        aliases: {cp.aliases.join(", ")}
                      </Typography>
                    )}
                  </Box>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => onEdit(cp)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {cp.isActive ? (
                    <Tooltip title="Archive">
                      <IconButton size="small" onClick={() => onArchive(cp)}>
                        <ArchiveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Restore">
                      <IconButton size="small" onClick={() => restore.mutate(cp._id)}>
                        <UnarchiveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
      <CounterpartyDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        counterparty={editing}
      />
    </Card>
  );
}
