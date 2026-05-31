"use client";

import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import type { FlowType } from "@/lib/schemas/common";

export interface FlowTypeOption {
  value: FlowType;
  label: string;
}

const DEFAULT_OPTIONS: FlowTypeOption[] = [
  { value: "spend", label: "Spend" },
  { value: "income", label: "Income" },
  { value: "family_support", label: "Family" },
  { value: "investment", label: "Invest" },
  { value: "debt_repayment", label: "EMI" },
  { value: "lending_out", label: "Lend" },
  { value: "lending_repaid", label: "Repaid" },
  { value: "reimbursement_in", label: "Reimburs." },
  { value: "card_settlement", label: "Card pay" },
  { value: "fee", label: "Fee" },
];

export interface FlowTypeSelectorProps {
  value: FlowType;
  onChange: (v: FlowType) => void;
  options?: FlowTypeOption[];
}

export function FlowTypeSelector({ value, onChange, options }: FlowTypeSelectorProps) {
  const opts = options ?? DEFAULT_OPTIONS;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {opts.map((o) => (
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
