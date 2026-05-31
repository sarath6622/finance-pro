"use client";

import type { ReactNode } from "react";
import Dialog, { type DialogProps } from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface Props extends Omit<DialogProps, "fullScreen"> {
  children: ReactNode;
}

/**
 * Dialog that goes full-screen below the `sm` breakpoint. Use anywhere we
 * used to render `<Dialog>` directly so mobile flows stop feeling cramped.
 */
export function ResponsiveDialog({ children, ...rest }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Dialog fullScreen={fullScreen} fullWidth={!fullScreen} maxWidth="sm" {...rest}>
      {children}
    </Dialog>
  );
}
