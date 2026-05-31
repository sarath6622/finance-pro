"use client";

import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import type { DueModel } from "@/lib/api/receivables";

const OPTIONS: Array<{ value: DueModel; label: string }> = [
  { value: "when_able", label: "Pay when able" },
  { value: "on_date", label: "By a date" },
  { value: "none", label: "No expectation" },
];

export interface DueModelSelectorProps {
  value: DueModel;
  onChange: (v: DueModel) => void;
}

export function DueModelSelector({ value, onChange }: DueModelSelectorProps) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {OPTIONS.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          color={value === o.value ? "primary" : "default"}
          variant={value === o.value ? "filled" : "outlined"}
          onClick={() => onChange(o.value)}
        />
      ))}
    </Stack>
  );
}
