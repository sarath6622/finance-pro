"use client";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useCounterparties } from "@/lib/api/counterparties";
import type { ApiCounterparty } from "@/lib/api/types";

export interface CounterpartyPickerProps {
  value: string | null;
  onChange: (cp: ApiCounterparty | null) => void;
  label?: string;
}

export function CounterpartyPicker({
  value,
  onChange,
  label = "Counterparty",
}: CounterpartyPickerProps) {
  const { data: items = [], isLoading } = useCounterparties();
  const selected = items.find((c) => c._id === value) ?? null;
  return (
    <Autocomplete<ApiCounterparty>
      options={items}
      value={selected}
      getOptionLabel={(o) => o.displayName}
      isOptionEqualToValue={(o, v) => o._id === v._id}
      onChange={(_e, v) => onChange(v ?? null)}
      loading={isLoading}
      renderInput={(params) => <TextField {...params} label={label} />}
      renderOption={(props, option) => (
        <li {...props} key={option._id}>
          {option.displayName}
          <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>{option.type}</span>
        </li>
      )}
    />
  );
}
