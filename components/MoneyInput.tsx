"use client";

import { useEffect, useState } from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { Money } from "@/lib/money";

export interface MoneyInputProps extends Omit<TextFieldProps, "onChange" | "value"> {
  valuePaise: number | null;
  onChangePaise: (paise: number | null) => void;
  withSymbol?: boolean;
}

export function MoneyInput({
  valuePaise,
  onChangePaise,
  withSymbol = true,
  ...rest
}: MoneyInputProps) {
  const [raw, setRaw] = useState<string>(
    valuePaise === null ? "" : Money.fromPaise(valuePaise).format({ withSymbol: false }),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (valuePaise === null) {
      setRaw("");
      return;
    }
    const formatted = Money.fromPaise(valuePaise).format({ withSymbol: false });
    if (formatted !== raw) setRaw(formatted);
    // raw intentionally omitted; this syncs external value changes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuePaise]);

  function commit(input: string) {
    const trimmed = input.trim();
    if (trimmed === "") {
      setError(null);
      onChangePaise(null);
      return;
    }
    try {
      const m = Money.parse(trimmed);
      setError(null);
      onChangePaise(m.paise);
    } catch {
      setError("Enter a valid amount");
    }
  }

  return (
    <TextField
      {...rest}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit((e.target as HTMLInputElement).value);
        }
      }}
      inputMode="decimal"
      error={!!error || !!rest.error}
      helperText={error ?? rest.helperText}
      InputProps={{
        startAdornment: withSymbol ? (
          <InputAdornment position="start">₹</InputAdornment>
        ) : undefined,
        ...rest.InputProps,
      }}
    />
  );
}
