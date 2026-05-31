"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { NeedWant } from "@/lib/schemas/common";

export interface NeedWantToggleProps {
  value: NeedWant | null;
  onChange: (v: NeedWant | null) => void;
}

export function NeedWantToggle({ value, onChange }: NeedWantToggleProps) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_e, v) => onChange((v as NeedWant | null) ?? null)}
    >
      <ToggleButton value="need">Need</ToggleButton>
      <ToggleButton value="want">Want</ToggleButton>
    </ToggleButtonGroup>
  );
}
