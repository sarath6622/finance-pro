"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/lib/api/categories";
import { ApiClientError } from "@/lib/api/client";
import { slugify } from "@/lib/schemas/category-input";
import type { ApiCategory } from "@/lib/api/types";
import type { FlowType } from "@/lib/schemas/common";

const FLOW_OPTIONS: Array<{ value: FlowType; label: string }> = [
  { value: "spend", label: "Spend" },
  { value: "income", label: "Income" },
  { value: "family_support", label: "Family support" },
  { value: "investment", label: "Investment" },
  { value: "debt_repayment", label: "Debt repayment" },
  { value: "lending_out", label: "Lending out" },
  { value: "lending_repaid", label: "Lending repaid" },
  { value: "reimbursement_in", label: "Reimbursement in" },
  { value: "card_settlement", label: "Card settlement" },
  { value: "transfer", label: "Transfer" },
  { value: "fee", label: "Fee" },
];

export interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  category?: ApiCategory;
}

export function CategoryDialog({ open, onClose, category }: CategoryDialogProps) {
  const isEdit = !!category;
  const create = useCreateCategory();
  const update = useUpdateCategory(category?._id ?? "");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [defaultFlowType, setDefaultFlowType] = useState<FlowType | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(false);
    if (category) {
      setName(category.name);
      setSlug(category.slug);
      setDefaultFlowType(category.defaultFlowType ?? "");
    } else {
      setName("");
      setSlug("");
      setDefaultFlowType("");
    }
  }, [category, open]);

  useEffect(() => {
    if (slugTouched || isEdit) return;
    setSlug(slugify(name));
  }, [name, slugTouched, isEdit]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");

    const payload = {
      name: name.trim(),
      ...(slug ? { slug } : {}),
      ...(defaultFlowType ? { defaultFlowType: defaultFlowType as FlowType } : {}),
    };

    try {
      if (isEdit) {
        await update.mutateAsync(payload);
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed");
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>{isEdit ? `Edit ${category!.name}` : "Add category"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              helperText="Lowercase, digits, hyphens. Auto-derived from name."
              fullWidth
            />
            <TextField
              select
              label="Default flow type"
              value={defaultFlowType}
              onChange={(e) => setDefaultFlowType(e.target.value as FlowType)}
              fullWidth
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {FLOW_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save" : "Add"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}
