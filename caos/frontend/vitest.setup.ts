import { configure } from "@testing-library/react";

// @testing-library/dom's findBy*/waitFor default to a hardcoded 1000ms
// internal poll timeout — a setting this project never overrode, and one
// vitest's own (much larger) `testTimeout: 20000` does NOT cover, since it's
// enforced by testing-library itself, independent of the test runner. Under
// full-suite load (many jsdom worker threads contending for the same CPU),
// an update that would resolve well within budget can occasionally take
// longer than 1s wall-clock to flush through React's act()/microtask queue,
// producing a spurious "Unable to find element"/timeout failure even though
// the component or hook was never actually broken. Align it with the
// project's own already-generous 20s budget instead.
configure({ asyncUtilTimeout: 8000 });

// Node ≥25 defines a global `localStorage` getter that yields `undefined`
// unless the process runs with --localstorage-file. That broken global shadows
// jsdom's per-window storage in component tests, so any bare
// `localStorage.getItem/clear` throws "Cannot read properties of undefined"
// on CI (Node 26) while passing locally on older Node. Replace it with a tiny
// in-memory Storage so tests behave the same on every Node.
//
// The replacement must be a real `class` (not a plain object): several tests
// spy on `Storage.prototype.getItem` rather than the instance, because jsdom's
// real Storage silently ignores an instance-level `vi.spyOn` (its getItem is
// only reachable through the prototype). A plain-object polyfill defines
// getItem as an *own* property, which shadows anything spied on
// `Storage.prototype` — the spy would silently stop intercepting calls,
// turning a deterministic test into one that passes only by coincidence. To
// keep `vi.spyOn(Storage.prototype, "getItem")` working the same way on every
// Node version, this also swaps the `Storage` constructor itself so the
// instance actually inherits from the prototype being spied on.
if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage == null) {
  class MemoryStorage {
    private store = new Map<string, string>();
    getItem(k: string) {
      return this.store.has(k) ? this.store.get(k)! : null;
    }
    setItem(k: string, v: string) {
      this.store.set(k, String(v));
    }
    removeItem(k: string) {
      this.store.delete(k);
    }
    clear() {
      this.store.clear();
    }
    key(i: number) {
      return [...this.store.keys()][i] ?? null;
    }
    get length() {
      return this.store.size;
    }
  }
  Object.defineProperty(globalThis, "Storage", {
    value: MemoryStorage,
    configurable: true,
    writable: true,
  });
  for (const key of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, key, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
