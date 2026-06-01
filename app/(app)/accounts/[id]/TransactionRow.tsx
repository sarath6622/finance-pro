"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { ApiTransaction } from "@/lib/api/types";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { flowTypeLabel } from "@/lib/flow/labels";

export interface TransactionRowProps {
  txn: ApiTransaction;
  isContainer: boolean;
  categoryName?: string;
  counterpartyName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onSplit: () => void;
  onSplitWithOthers?: () => void;
}

export function TransactionRow({
  txn,
  isContainer,
  categoryName,
  counterpartyName,
  onEdit,
  onDelete,
  onSplit,
  onSplitWithOthers,
}: TransactionRowProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const signedPaise = txn.direction === "in" ? txn.amountPaise : -txn.amountPaise;
  const muted = isContainer;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{
        py: 1.25,
        px: 1,
        borderRadius: 1,
        opacity: muted ? 0.55 : 1,
        "&:hover": { backgroundColor: "action.hover" },
      }}
    >
      <Box sx={{ minWidth: 84 }}>
        <Typography variant="body2" color="text.secondary">
          {txn.valueDate}
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="body1"
          noWrap
          sx={{ fontStyle: txn.description ? "normal" : "italic", color: txn.description ? undefined : "text.secondary" }}
        >
          {txn.description || "(no description)"}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 0.25 }}
        >
          <Chip size="small" label={flowTypeLabel(txn.flowType)} />
          {txn.needWant && <Chip size="small" variant="outlined" label={txn.needWant} />}
          {categoryName && (
            <Chip size="small" variant="outlined" color="primary" label={categoryName} />
          )}
          {counterpartyName && (
            <Chip size="small" variant="outlined" label={`↔ ${counterpartyName}`} />
          )}
          {isContainer && <Chip size="small" color="warning" label="split parent" />}
          {txn.source === "split_child" && <Chip size="small" variant="outlined" label="child" />}
          {txn.splitId && <Chip size="small" color="info" variant="outlined" label="bill split" />}
        </Stack>
      </Box>
      <Box textAlign="right" sx={{ minWidth: 120 }}>
        <MoneyDisplay paise={signedPaise} signed colorize monospace />
      </Box>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit();
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          disabled={isContainer || !!txn.parentTransactionId}
          onClick={() => {
            setAnchor(null);
            onSplit();
          }}
        >
          Split into multi-flow
        </MenuItem>
        <MenuItem
          disabled={
            !onSplitWithOthers ||
            txn.flowType !== "spend" ||
            !!txn.splitId ||
            isContainer ||
            !!txn.parentTransactionId
          }
          onClick={() => {
            setAnchor(null);
            onSplitWithOthers?.();
          }}
        >
          Split with others (bill split)
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onDelete();
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </Stack>
  );
}
