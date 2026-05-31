"use client";

import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { PeriodMode } from "@/lib/api/reports";

export interface PeriodSelectorState {
  year: number;
  month: number;
  mode: PeriodMode;
}

export interface PeriodSelectorProps {
  value: PeriodSelectorState;
  onChange: (next: PeriodSelectorState) => void;
  label?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function shift(state: PeriodSelectorState, delta: number): PeriodSelectorState {
  const total = state.year * 12 + (state.month - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return { ...state, year, month };
}

export function PeriodSelector({ value, onChange, label }: PeriodSelectorProps) {
  const titlePart = label ?? `${MONTH_NAMES[value.month - 1]} ${value.year}`;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems="center"
      spacing={{ xs: 1, sm: 1.5 }}
      sx={{ width: "100%", justifyContent: { sm: "flex-end" } }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => onChange(shift(value, -1))} aria-label="Previous period">
          <ChevronLeftIcon />
        </IconButton>
        <Typography
          variant="h2"
          sx={{ minWidth: { xs: 140, sm: 180 }, textAlign: "center" }}
        >
          {titlePart}
          {value.mode === "pay_cycle" && (
            <Typography variant="caption" component="span" sx={{ ml: 1, color: "text.secondary" }}>
              cycle
            </Typography>
          )}
        </Typography>
        <IconButton onClick={() => onChange(shift(value, 1))} aria-label="Next period">
          <ChevronRightIcon />
        </IconButton>
      </Stack>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value.mode}
        onChange={(_e, v) => v && onChange({ ...value, mode: v as PeriodMode })}
      >
        <ToggleButton value="calendar" sx={{ px: 1.75, textTransform: "none" }}>
          Calendar
        </ToggleButton>
        <ToggleButton value="pay_cycle" sx={{ px: 1.75, textTransform: "none" }}>
          Pay-cycle
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
