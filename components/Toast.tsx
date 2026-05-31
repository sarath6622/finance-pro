"use client";

import { useEffect, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert, { type AlertColor } from "@mui/material/Alert";

export type ToastSeverity = AlertColor;

export interface ToastMessage {
  id: number;
  message: string;
  severity: ToastSeverity;
}

type Listener = (msg: ToastMessage) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function emit(severity: ToastSeverity, message: string) {
  const msg: ToastMessage = { id: nextId++, message, severity };
  listeners.forEach((l) => l(msg));
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
  warning: (message: string) => emit("warning", message),
};

export function useToast() {
  return toast;
}

export function ToastHost() {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const [queue, setQueue] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener: Listener = (msg) => {
      setQueue((q) => [...q, msg]);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (current) return;
    const next = queue[0];
    if (!next) return;
    setCurrent(next);
    setQueue((q) => q.slice(1));
  }, [current, queue]);

  const handleClose = (_event?: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    setCurrent(null);
  };

  return (
    <Snackbar
      key={current?.id}
      open={Boolean(current)}
      autoHideDuration={current?.severity === "error" ? 6000 : 3500}
      onClose={handleClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      {current ? (
        <Alert
          onClose={() => handleClose()}
          severity={current.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {current.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
