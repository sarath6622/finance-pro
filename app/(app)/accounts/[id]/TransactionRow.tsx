"use client";

import { useState, type ReactNode } from "react";
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
  closingBalancePaise?: number;
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
  closingBalancePaise,
  onEdit,
  onDelete,
  onSplit,
  onSplitWithOthers,
}: TransactionRowProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const signedPaise = txn.direction === "in" ? txn.amountPaise : -txn.amountPaise;
  const muted = isContainer;

  const amountBlock: ReactNode = (
    <Box textAlign="right" sx={{ minWidth: { xs: 0, md: 120 } }}>
      <MoneyDisplay paise={signedPaise} signed colorize monospace />
      {closingBalancePaise !== undefined && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.25 }}
        >
          bal <MoneyDisplay paise={closingBalancePaise} signed monospace />
        </Typography>
      )}
    </Box>
  );

  const menuButton: ReactNode = (
    <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
      <MoreVertIcon fontSize="small" />
    </IconButton>
  );

  const description: ReactNode = (
    <Typography
      variant="body1"
      sx={{
        fontStyle: txn.description ? "normal" : "italic",
        color: txn.description ? undefined : "text.secondary",
        wordBreak: "break-word",
      }}
    >
      {txn.description || "(no description)"}
    </Typography>
  );

  const chips: ReactNode = (
    <Stack
      direction="row"
      spacing={0.75}
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
  );

  return (
    <>
      <Box
        sx={{
          py: 1.25,
          px: 1,
          borderRadius: 1,
          opacity: muted ? 0.55 : 1,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        {/* Mobile-first vertical layout; md+ collapses to a single row. */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 1, md: 2 }}
          alignItems={{ md: "center" }}
        >
          {/* Top group on mobile = date + amount + menu, justified.
              On md+, this is just the date column. */}
          <Stack
            direction="row"
            alignItems="flex-start"
            spacing={1}
            sx={{ width: { xs: "100%", md: "auto" } }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ minWidth: { md: 84 }, flexShrink: 0, pt: { xs: 0.5, md: 0 } }}
            >
              {txn.valueDate}
            </Typography>
            {/* Mobile-only: pushes amount + menu to the right of the date. */}
            <Box sx={{ flexGrow: 1, display: { md: "none" } }} />
            <Box sx={{ display: { md: "none" } }}>{amountBlock}</Box>
            <Box sx={{ display: { md: "none" } }}>{menuButton}</Box>
          </Stack>

          {/* Middle: description + chips on full width below on mobile,
              centered inline column on desktop. */}
          <Box sx={{ flexGrow: 1, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
            {description}
            {chips}
          </Box>

          {/* Desktop-only amount + menu at the far right. */}
          <Box sx={{ display: { xs: "none", md: "block" } }}>{amountBlock}</Box>
          <Box sx={{ display: { xs: "none", md: "inline-flex" } }}>{menuButton}</Box>
        </Stack>
      </Box>
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
    </>
  );
}
