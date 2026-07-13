"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const URL_STATE_EVENT = "caos:url-state";

export type TypedUrlValues<Key extends string> = Readonly<Record<Key, string | null>>;
export type TypedUrlUpdate<Key extends string> = Partial<Record<Key, string | null | undefined>>;

export function mergeAllowedUrlState<Key extends string>(
  current: URLSearchParams,
  updates: TypedUrlUpdate<Key>,
  allowedKeys: readonly Key[],
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  const allowed = new Set<string>(allowedKeys);
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.has(key)) {
      throw new Error(`URL state key "${key}" is not allow-listed.`);
    }
    if (value === undefined) continue;
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(URL_STATE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(URL_STATE_EVENT, listener);
  };
}

function browserSnapshot() {
  return window.location.search;
}

function serverSnapshot() {
  return "";
}

export function useTypedUrlState<const Key extends string>(allowedKeys: readonly Key[]) {
  const search = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  const keySignature = allowedKeys.join("\u0000");
  const values = useMemo(() => {
    const params = new URLSearchParams(search);
    return Object.fromEntries(allowedKeys.map((key) => [key, params.get(key)])) as TypedUrlValues<Key>;
    // keySignature captures the primitive key list without requiring adapter callers to memoize it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, keySignature]);

  const update = useCallback((
    changes: TypedUrlUpdate<Key>,
    mode: "push" | "replace" = "push",
  ) => {
    const next = mergeAllowedUrlState(
      new URLSearchParams(window.location.search),
      changes,
      allowedKeys,
    );
    const query = next.toString();
    const href = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    const method = mode === "replace" ? "replaceState" : "pushState";
    window.history[method](window.history.state, "", href);
    window.dispatchEvent(new Event(URL_STATE_EVENT));
  }, [allowedKeys]);

  return { values, update } as const;
}
