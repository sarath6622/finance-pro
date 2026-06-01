"use client";

import { useEffect, useMemo, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import {
  createBrowserSwUpdateWatcher,
  type SwUpdateState,
} from "@/lib/pwa/sw-update";

export function UpdateBanner() {
  const watcher = useMemo(() => createBrowserSwUpdateWatcher(), []);
  const [state, setState] = useState<SwUpdateState>({ kind: "idle" });

  useEffect(() => {
    const unsubscribe = watcher.subscribe(setState);
    return () => {
      unsubscribe();
      watcher.dispose();
    };
  }, [watcher]);

  const open = state.kind === "waiting";

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ bottom: { xs: "calc(72px + env(safe-area-inset-bottom))", md: 24 } }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <Button color="inherit" size="small" onClick={() => watcher.applyUpdate()}>
            Reload
          </Button>
        }
      >
        A new version is ready.
      </Alert>
    </Snackbar>
  );
}
