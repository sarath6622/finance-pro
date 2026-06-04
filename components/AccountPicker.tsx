"use client";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useAccounts } from "@/lib/api/accounts";
import type { ApiAccount } from "@/lib/api/types";

export interface AccountPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  required?: boolean;
  filter?: (a: ApiAccount) => boolean;
}

export function AccountPicker({
  value,
  onChange,
  label = "Account",
  required,
  filter,
}: AccountPickerProps) {
  const { data: allAccounts = [], isLoading } = useAccounts();
  const accounts = filter ? allAccounts.filter(filter) : allAccounts;
  const selected = accounts.find((a) => a._id === value) ?? null;
  return (
    <Autocomplete<ApiAccount>
      options={accounts}
      value={selected}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(o, v) => o._id === v._id}
      onChange={(_e, v) => onChange(v?._id ?? null)}
      loading={isLoading}
      renderInput={(params) => <TextField {...params} label={label} required={required} />}
      renderOption={(props, option) => (
        <li {...props} key={option._id}>
          {option.name}
          {option.last4Label ? ` · …${option.last4Label}` : ""}
        </li>
      )}
    />
  );
}
