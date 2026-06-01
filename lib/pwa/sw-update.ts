/**
 * Observe service-worker update lifecycle and expose a primitive the UI
 * can hook into to prompt "Reload to update" (CLAUDE.md risk #5: never
 * silent-swap a new SW mid-session).
 *
 * Pure of the DOM apart from the ServiceWorkerRegistration interface,
 * which is injected so tests can stub it.
 */

export type SwUpdateState =
  | { kind: "idle" }
  | { kind: "waiting"; worker: ServiceWorker };

export type SwUpdateListener = (state: SwUpdateState) => void;

export interface SwUpdateWatcherDeps {
  /** Resolves to the active registration, or null when SW is unavailable. */
  getRegistration: () => Promise<ServiceWorkerRegistration | null>;
  /** Reload the page once the new SW has taken control. */
  reload: () => void;
  /** Subscribe to controllerchange (a new SW has activated). */
  onControllerChange: (cb: () => void) => () => void;
}

export interface SwUpdateWatcher {
  subscribe: (listener: SwUpdateListener) => () => void;
  /** Tell the waiting SW to activate; page reloads on controllerchange. */
  applyUpdate: () => void;
  /** Stop all internal listeners. */
  dispose: () => void;
}

export function createSwUpdateWatcher(deps: SwUpdateWatcherDeps): SwUpdateWatcher {
  let state: SwUpdateState = { kind: "idle" };
  const listeners = new Set<SwUpdateListener>();
  const cleanups: Array<() => void> = [];
  let disposed = false;

  function emit(next: SwUpdateState): void {
    state = next;
    for (const l of listeners) l(state);
  }

  function trackRegistration(reg: ServiceWorkerRegistration): void {
    if (reg.waiting) {
      emit({ kind: "waiting", worker: reg.waiting });
    }
    const onUpdateFound = (): void => {
      const installing = reg.installing;
      if (!installing) return;
      const onStateChange = (): void => {
        if (installing.state === "installed" && reg.waiting) {
          emit({ kind: "waiting", worker: reg.waiting });
        }
      };
      installing.addEventListener("statechange", onStateChange);
      cleanups.push(() => installing.removeEventListener("statechange", onStateChange));
    };
    reg.addEventListener("updatefound", onUpdateFound);
    cleanups.push(() => reg.removeEventListener("updatefound", onUpdateFound));
  }

  void deps.getRegistration().then((reg) => {
    if (disposed || !reg) return;
    trackRegistration(reg);
  });

  const unsubscribeController = deps.onControllerChange(() => {
    if (state.kind === "waiting") {
      deps.reload();
    }
  });
  cleanups.push(unsubscribeController);

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    applyUpdate() {
      if (state.kind !== "waiting") return;
      state.worker.postMessage({ type: "SKIP_WAITING" });
    },
    dispose() {
      disposed = true;
      listeners.clear();
      while (cleanups.length) {
        const fn = cleanups.pop();
        try {
          fn?.();
        } catch {
          /* ignore cleanup errors */
        }
      }
    },
  };
}

/**
 * Browser-bound factory: wires `createSwUpdateWatcher` to the real
 * `navigator.serviceWorker` if available, otherwise returns a no-op
 * watcher (SSR, unsupported browsers, dev where SW is disabled).
 */
export function createBrowserSwUpdateWatcher(): SwUpdateWatcher {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return {
      subscribe: (l) => {
        l({ kind: "idle" });
        return () => undefined;
      },
      applyUpdate: () => undefined,
      dispose: () => undefined,
    };
  }
  return createSwUpdateWatcher({
    getRegistration: () => navigator.serviceWorker.getRegistration().then((r) => r ?? null),
    reload: () => window.location.reload(),
    onControllerChange: (cb) => {
      navigator.serviceWorker.addEventListener("controllerchange", cb);
      return () => navigator.serviceWorker.removeEventListener("controllerchange", cb);
    },
  });
}
