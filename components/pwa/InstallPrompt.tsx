"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import InstallMobileIcon from "@mui/icons-material/InstallMobileOutlined";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwaInstallDismissed";

function readPersistedDismissal(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writePersistedDismissal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* storage blocked — best-effort */
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    setDismissed(readPersistedDismissal());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
      writePersistedDismissal();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred || dismissed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const result = await deferred.userChoice;
    if (result.outcome === "dismissed") {
      writePersistedDismissal();
      setDismissed(true);
    }
    setDeferred(null);
  }

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<InstallMobileIcon fontSize="small" />}
      onClick={install}
    >
      Install
    </Button>
  );
}
