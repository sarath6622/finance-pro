"use client";

import { useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useCategories } from "@/lib/api/categories";
import type { ApiCategory } from "@/lib/api/types";
import type { FlowType } from "@/lib/schemas/common";

export interface CategoryPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  flowType?: FlowType;
  label?: string;
}

export function CategoryPicker({
  value,
  onChange,
  flowType,
  label = "Category",
}: CategoryPickerProps) {
  const { data: items = [], isLoading } = useCategories();
  const options = useMemo(() => {
    if (!flowType) return items;
    const exact = items.filter((c) => c.defaultFlowType === flowType);
    return exact.length > 0 ? [...exact, ...items.filter((c) => c.defaultFlowType !== flowType)] : items;
  }, [items, flowType]);
  const selected = options.find((c) => c._id === value) ?? null;
  return (
    <Autocomplete<ApiCategory>
      options={options}
      value={selected}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(o, v) => o._id === v._id}
      onChange={(_e, v) => onChange(v?._id ?? null)}
      loading={isLoading}
      renderInput={(params) => <TextField {...params} label={label} />}
      renderOption={(props, option) => (
        <li {...props} key={option._id}>
          {option.name}
        </li>
      )}
    />
  );
}
