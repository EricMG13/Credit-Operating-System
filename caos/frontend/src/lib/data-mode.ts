"use client";

import { useSyncExternalStore } from "react";

export type DataMode = "live" | "reference";

type SearchReader = Pick<URLSearchParams, "get">;

export function dataModeFromSearch(search: string | SearchReader): DataMode {
  const params = typeof search === "string"
    ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    : search;
  return params.get("mode") === "reference" ? "reference" : "live";
}

function appHref(url: URL, original: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(original)) return url.href;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function withDataMode(href: string, mode: DataMode): string {
  const url = new URL(href, "https://caos.invalid");
  if (mode === "reference") url.searchParams.set("mode", "reference");
  else url.searchParams.delete("mode");
  return appHref(url, href);
}

export function preserveDataModeInHref(
  href: string,
  current: DataMode | string | SearchReader,
): string {
  const mode = current === "live" || current === "reference"
    ? current
    : dataModeFromSearch(current);
  return mode === "reference" ? withDataMode(href, "reference") : href;
}

const URL_STATE_EVENT = "caos:url-state";
type NotifyingHistory = History & { __caosUrlStateNotifications?: true };

function installHistoryNotifications() {
  const history = window.history as NotifyingHistory;
  if (history.__caosUrlStateNotifications) return;
  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);
  history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
    pushState(data, unused, url);
    queueMicrotask(() => window.dispatchEvent(new Event(URL_STATE_EVENT)));
  };
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
    replaceState(data, unused, url);
    queueMicrotask(() => window.dispatchEvent(new Event(URL_STATE_EVENT)));
  };
  history.__caosUrlStateNotifications = true;
}

function subscribe(listener: () => void) {
  installHistoryNotifications();
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  window.addEventListener(URL_STATE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
    window.removeEventListener(URL_STATE_EVENT, listener);
  };
}

const browserSearchSnapshot = () => window.location.search;
const browserHrefSnapshot = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const serverSearchSnapshot = () => "";
const serverHrefSnapshot = () => "/";

export function useDataMode(): DataMode {
  return dataModeFromSearch(useSyncExternalStore(subscribe, browserSearchSnapshot, serverSearchSnapshot));
}

export function useCurrentAppHref(): string {
  return useSyncExternalStore(subscribe, browserHrefSnapshot, serverHrefSnapshot);
}
