import { describe, expect, it, vi } from "vitest";
import {
  createSwUpdateWatcher,
  type SwUpdateState,
  type SwUpdateWatcherDeps,
} from "./sw-update";

function makeEventTarget() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: (type: string, cb: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: EventListener) => {
      listeners.get(type)?.delete(cb);
    },
    dispatch: (type: string) => {
      const evt = new Event(type);
      listeners.get(type)?.forEach((cb) => cb(evt));
    },
    listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
  };
}

function makeWorker() {
  const target = makeEventTarget();
  return {
    state: "installing" as ServiceWorker["state"],
    postMessage: vi.fn(),
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    dispatch: target.dispatch,
  };
}

function makeRegistration() {
  const target = makeEventTarget();
  const reg = {
    waiting: null as ReturnType<typeof makeWorker> | null,
    installing: null as ReturnType<typeof makeWorker> | null,
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    dispatch: target.dispatch,
    listenerCount: target.listenerCount,
  };
  return reg;
}

function makeDeps(reg: ReturnType<typeof makeRegistration> | null) {
  let controllerCb: (() => void) | null = null;
  const deps: SwUpdateWatcherDeps = {
    getRegistration: vi.fn().mockResolvedValue(reg as unknown as ServiceWorkerRegistration),
    reload: vi.fn(),
    onControllerChange: (cb) => {
      controllerCb = cb;
      return () => {
        controllerCb = null;
      };
    },
  };
  return {
    deps,
    fireControllerChange: () => controllerCb?.(),
    hasControllerListener: () => controllerCb !== null,
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createSwUpdateWatcher", () => {
  it("emits idle when no registration is available", async () => {
    const { deps } = makeDeps(null);
    const watcher = createSwUpdateWatcher(deps);
    const states: SwUpdateState[] = [];
    watcher.subscribe((s) => states.push(s));
    await flush();
    expect(states).toEqual([{ kind: "idle" }]);
    watcher.dispose();
  });

  it("emits waiting immediately when a worker is already waiting", async () => {
    const reg = makeRegistration();
    const waiting = makeWorker();
    reg.waiting = waiting;
    const { deps } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    const states: SwUpdateState[] = [];
    watcher.subscribe((s) => states.push(s));
    await flush();
    expect(states.at(-1)).toMatchObject({ kind: "waiting" });
    watcher.dispose();
  });

  it("transitions idle → waiting when updatefound + installed fire", async () => {
    const reg = makeRegistration();
    const { deps } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    const states: SwUpdateState[] = [];
    watcher.subscribe((s) => states.push(s));
    await flush();
    expect(states.at(-1)).toEqual({ kind: "idle" });

    const installing = makeWorker();
    reg.installing = installing;
    reg.dispatch("updatefound");

    installing.state = "installed";
    reg.waiting = installing;
    installing.dispatch("statechange");

    expect(states.at(-1)).toMatchObject({ kind: "waiting" });
    watcher.dispose();
  });

  it("applyUpdate posts SKIP_WAITING to the waiting worker", async () => {
    const reg = makeRegistration();
    const waiting = makeWorker();
    reg.waiting = waiting;
    const { deps } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    await flush();
    watcher.applyUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    watcher.dispose();
  });

  it("applyUpdate is a no-op when idle", async () => {
    const reg = makeRegistration();
    const { deps } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    await flush();
    expect(() => watcher.applyUpdate()).not.toThrow();
    watcher.dispose();
  });

  it("reloads when controllerchange fires after a waiting state", async () => {
    const reg = makeRegistration();
    const waiting = makeWorker();
    reg.waiting = waiting;
    const { deps, fireControllerChange } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    await flush();
    fireControllerChange();
    expect(deps.reload).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it("does not reload on controllerchange while idle", async () => {
    const reg = makeRegistration();
    const { deps, fireControllerChange } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    await flush();
    fireControllerChange();
    expect(deps.reload).not.toHaveBeenCalled();
    watcher.dispose();
  });

  it("subscribe emits the current state synchronously", async () => {
    const reg = makeRegistration();
    const { deps } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    await flush();
    const cb = vi.fn();
    watcher.subscribe(cb);
    expect(cb).toHaveBeenCalledWith({ kind: "idle" });
    watcher.dispose();
  });

  it("subscribe returns an unsubscriber", async () => {
    const reg = makeRegistration();
    const { deps } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    await flush();
    const cb = vi.fn();
    const unsub = watcher.subscribe(cb);
    cb.mockClear();
    unsub();
    const installing = makeWorker();
    reg.installing = installing;
    reg.dispatch("updatefound");
    installing.state = "installed";
    reg.waiting = installing;
    installing.dispatch("statechange");
    expect(cb).not.toHaveBeenCalled();
    watcher.dispose();
  });

  it("dispose tears down registration listeners and controller subscription", async () => {
    const reg = makeRegistration();
    const { deps, hasControllerListener } = makeDeps(reg);
    const watcher = createSwUpdateWatcher(deps);
    await flush();
    expect(reg.listenerCount("updatefound")).toBe(1);
    expect(hasControllerListener()).toBe(true);
    watcher.dispose();
    expect(reg.listenerCount("updatefound")).toBe(0);
    expect(hasControllerListener()).toBe(false);
  });

  it("ignores registration that arrives after dispose", async () => {
    let resolveReg: (r: ServiceWorkerRegistration | null) => void = () => undefined;
    const deps: SwUpdateWatcherDeps = {
      getRegistration: () =>
        new Promise<ServiceWorkerRegistration | null>((res) => {
          resolveReg = res;
        }),
      reload: vi.fn(),
      onControllerChange: () => () => undefined,
    };
    const watcher = createSwUpdateWatcher(deps);
    watcher.dispose();
    const reg = makeRegistration();
    const waiting = makeWorker();
    reg.waiting = waiting;
    resolveReg(reg as unknown as ServiceWorkerRegistration);
    await flush();
    expect(reg.listenerCount("updatefound")).toBe(0);
  });
});
