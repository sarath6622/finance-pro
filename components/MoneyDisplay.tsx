import Box from "@mui/material/Box";
import { Money } from "@/lib/money";

export interface MoneyDisplayProps {
  paise: number;
  signed?: boolean;
  withSymbol?: boolean;
  colorize?: boolean;
  /** @deprecated kept for API compatibility — numbers always render in the app font with tabular-nums */
  monospace?: boolean;
  size?: "inherit" | "small" | "medium" | "large" | "hero";
}

const SIZE: Record<NonNullable<MoneyDisplayProps["size"]>, string | undefined> = {
  inherit: undefined,
  small: "0.875rem",
  medium: "1rem",
  large: "1.25rem",
  hero: "2rem",
};

const WEIGHT: Record<NonNullable<MoneyDisplayProps["size"]>, number | undefined> = {
  inherit: undefined,
  small: undefined,
  medium: undefined,
  large: 600,
  hero: 600,
};

const LETTER_SPACING: Record<NonNullable<MoneyDisplayProps["size"]>, string | undefined> = {
  inherit: undefined,
  small: undefined,
  medium: undefined,
  large: "-0.01em",
  hero: "-0.025em",
};

export function MoneyDisplay({
  paise,
  signed = false,
  withSymbol = true,
  colorize = false,
  monospace: _monospace = false,
  size = "inherit",
}: MoneyDisplayProps) {
  const text = Money.fromPaise(paise).format({ signed, withSymbol });
  let color: string | undefined;
  if (colorize) {
    if (paise > 0) color = "success.main";
    else if (paise < 0) color = "error.main";
  }
  return (
    <Box
      component="span"
      sx={{
        color,
        fontVariantNumeric: "tabular-nums",
        fontSize: SIZE[size],
        fontWeight: WEIGHT[size],
        letterSpacing: LETTER_SPACING[size],
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </Box>
  );
}
