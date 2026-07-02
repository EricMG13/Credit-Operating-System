// Node ≥25 defines a global `localStorage` getter that yields `undefined`
// unless the process runs with --localstorage-file. That broken global shadows
// jsdom's per-window storage in component tests, so any bare
// `localStorage.getItem/clear` throws "Cannot read properties of undefined"
// on CI (Node 26) while passing locally on older Node. Replace it with a tiny
// in-memory Storage so tests behave the same on every Node.
if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage == null) {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}
