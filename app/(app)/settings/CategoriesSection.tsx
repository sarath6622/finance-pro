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
  useCategories,
  useArchiveCategory,
  useRestoreCategory,
} from "@/lib/api/categories";
import { CategoryDialog } from "./CategoryDialog";
import { ApiClientError } from "@/lib/api/client";
import type { ApiCategory } from "@/lib/api/types";

export function CategoriesSection() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: cats = [], isLoading } = useCategories({ includeInactive });
  const archive = useArchiveCategory();
  const restore = useRestoreCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCategory | undefined>(undefined);

  function onAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function onEdit(c: ApiCategory) {
    setEditing(c);
    setDialogOpen(true);
  }

  async function onArchive(c: ApiCategory) {
    try {
      await archive.mutateAsync(c._id);
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
            <Typography variant="h2">Categories</Typography>
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
          ) : cats.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No categories yet. Add the spend / income / investment buckets you care
              about.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {cats.map((c) => (
                <Stack
                  key={c._id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ py: 1.25 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {c.name}
                      </Typography>
                      {c.defaultFlowType && (
                        <Chip
                          label={c.defaultFlowType.replace("_", " ")}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {!c.isActive && (
                        <Chip label="archived" size="small" color="default" />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      slug: {c.slug}
                    </Typography>
                  </Box>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => onEdit(c)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {c.isActive ? (
                    <Tooltip title="Archive">
                      <IconButton size="small" onClick={() => onArchive(c)}>
                        <ArchiveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Restore">
                      <IconButton size="small" onClick={() => restore.mutate(c._id)}>
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
      <CategoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        category={editing}
      />
    </Card>
  );
}
