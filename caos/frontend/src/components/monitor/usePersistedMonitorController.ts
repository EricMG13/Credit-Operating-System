"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWatchRule,
  getAlertEventPage,
  getSettings,
  getWatchRule,
  getWatchRulePage,
  patchAlertEvent,
  toErrorMessage,
  updateWatchRule,
  type AlertEventDTO,
  type AlertEventPageDTO,
  type WatchRuleDTO,
  type WatchRulePageDTO,
  type WatchRuleWriteDTO,
} from "@/lib/api";

export type MonitorAlertFilter = "all" | AlertEventDTO["state"];
export type PersistedLoadStatus = "loading" | "error" | "ready";
export type BatchErrorAction = "retry" | "reload" | "review" | null;
export type WatchRuleAvailability = "checking" | "enabled" | "disabled" | "unavailable";

const ALERT_PAGE_LIMIT = 200;
const RULE_PAGE_LIMIT = 100;
const ALERT_AUTHORITY_NOT_READY = "Persisted alert list authority is not ready; reload before updating";
const RULE_AUTHORITY_NOT_READY = "Persisted watch-rule list authority is not ready; reload before updating";
const RULE_ACTIVATION_NOT_ENABLED = "Watch-rule activation is not enabled by a verified workspace-settings snapshot";

function authorityHasError(ref: { current: PersistedLoadStatus }): boolean {
  return ref.current === "error";
}

function selectionIdentity(ids: readonly string[]): string {
  return [...ids].sort().join("\u0000");
}

function validIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function alertObservationTimestamp(event: AlertEventDTO): string | null {
  const observed = event.evidence.observed_at;
  if (validIsoTimestamp(observed)) return observed;
  return validIsoTimestamp(event.created_at) ? event.created_at : null;
}

export function explicitAlertChunkIds(event: AlertEventDTO): string[] {
  const ids = new Set<string>();
  const exact = event.evidence.chunk_id;
  if (typeof exact === "string" && exact.trim()) ids.add(exact.trim());
  const explicit = event.evidence.chunk_ids;
  if (Array.isArray(explicit)) {
    for (const id of explicit) if (typeof id === "string" && id.trim()) ids.add(id.trim());
  }
  const refs = event.evidence.source_artifact_refs;
  if (Array.isArray(refs)) {
    for (const ref of refs) {
      if (typeof ref !== "string" || !ref.startsWith("chunk:")) continue;
      const id = ref.slice("chunk:".length).trim();
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export function alertIssuerLabel(event: AlertEventDTO): string {
  return event.issuer_id?.trim() || "Unscoped alert";
}

export function isAlertLifecycleConflict(reason: unknown): boolean {
  return (reason as { response?: { status?: number } })?.response?.status === 409;
}

async function drainPages<T>(
  loadPage: (cursor: string | undefined, signal: AbortSignal) => Promise<{ items: T[]; nextCursor: string | null }>,
  signal: AbortSignal,
  repeatedCursorMessage: string,
): Promise<T[]> {
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const page = await loadPage(cursor, signal);
    items.push(...page.items);
    if (!page.nextCursor) return items;
    if (seenCursors.has(page.nextCursor)) throw new Error(repeatedCursorMessage);
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

export interface PersistedWatchRuleController {
  availability: WatchRuleAvailability;
  activationError: string | null;
  status: PersistedLoadStatus;
  error: string | null;
  rules: WatchRuleDTO[];
  retryActivation: () => Promise<void>;
  refresh: () => Promise<void>;
  create: (body: WatchRuleWriteDTO) => Promise<WatchRuleDTO>;
  update: (id: string, expectedVersion: number, patch: WatchRuleWriteDTO) => Promise<WatchRuleDTO>;
  reloadOne: (id: string) => Promise<WatchRuleDTO>;
}

export function usePersistedWatchRuleController(): PersistedWatchRuleController {
  const [availability, setAvailability] = useState<WatchRuleAvailability>("checking");
  const [activationError, setActivationError] = useState<string | null>(null);
  const [status, setStatus] = useState<PersistedLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<WatchRuleDTO[]>([]);
  const availabilityRef = useRef<WatchRuleAvailability>("checking");
  const activationEpochRef = useRef(0);
  const settingsRequestRef = useRef(0);
  const settingsAbortRef = useRef<AbortController | null>(null);
  const listRequestRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);
  const statusRef = useRef<PersistedLoadStatus>("loading");
  const publishStatus = useCallback((next: PersistedLoadStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const publishAvailability = useCallback((next: WatchRuleAvailability) => {
    availabilityRef.current = next;
    setAvailability(next);
  }, []);
  const fenceListLoad = useCallback(() => {
    listRequestRef.current += 1;
    listAbortRef.current?.abort();
  }, []);
  const loadRules = useCallback(async (activationEpoch: number) => {
    if (availabilityRef.current !== "enabled" || activationEpochRef.current !== activationEpoch) {
      throw new Error(RULE_ACTIVATION_NOT_ENABLED);
    }
    const request = listRequestRef.current + 1;
    listRequestRef.current = request;
    listAbortRef.current?.abort();
    const abort = new AbortController();
    listAbortRef.current = abort;
    publishStatus("loading");
    setError(null);
    try {
      const loaded = await drainPages<WatchRuleDTO>(
        (cursor, signal) => getWatchRulePage({ limit: RULE_PAGE_LIMIT, cursor, signal }) as Promise<WatchRulePageDTO>,
        abort.signal,
        "Persisted watch-rule pagination repeated a cursor.",
      );
      if (
        listRequestRef.current !== request
        || abort.signal.aborted
        || availabilityRef.current !== "enabled"
        || activationEpochRef.current !== activationEpoch
      ) return;
      const unique = new Map(loaded.map((rule) => [rule.id, rule]));
      setRules([...unique.values()]);
      publishStatus("ready");
    } catch (reason) {
      if (
        listRequestRef.current !== request
        || abort.signal.aborted
        || availabilityRef.current !== "enabled"
        || activationEpochRef.current !== activationEpoch
      ) return;
      setError(toErrorMessage(reason, "Persisted watch rules are unavailable"));
      publishStatus("error");
    }
  }, [publishStatus]);

  const refresh = useCallback(async () => {
    if (availabilityRef.current !== "enabled") throw new Error(RULE_ACTIVATION_NOT_ENABLED);
    await loadRules(activationEpochRef.current);
  }, [loadRules]);

  const retryActivation = useCallback(async () => {
    const request = settingsRequestRef.current + 1;
    settingsRequestRef.current = request;
    settingsAbortRef.current?.abort();
    const abort = new AbortController();
    settingsAbortRef.current = abort;
    activationEpochRef.current += 1;
    const activationEpoch = activationEpochRef.current;
    fenceListLoad();
    setRules([]);
    setError(null);
    setActivationError(null);
    publishStatus("loading");
    publishAvailability("checking");
    try {
      const settings = await getSettings({ signal: abort.signal });
      if (settingsRequestRef.current !== request || abort.signal.aborted) return;
      const flag = (settings as { features?: { alert_rules_v1_enabled?: unknown } })?.features?.alert_rules_v1_enabled;
      if (flag === false) {
        publishAvailability("disabled");
        publishStatus("ready");
        return;
      }
      if (flag !== true) {
        setActivationError("Workspace settings did not provide a valid watch-rule activation flag.");
        publishAvailability("unavailable");
        publishStatus("error");
        return;
      }
      publishAvailability("enabled");
      await loadRules(activationEpoch);
    } catch (reason) {
      if (settingsRequestRef.current !== request || abort.signal.aborted) return;
      setActivationError(toErrorMessage(reason, "Watch-rule activation could not be verified"));
      publishAvailability("unavailable");
      publishStatus("error");
    }
  }, [fenceListLoad, loadRules, publishAvailability, publishStatus]);

  useEffect(() => {
    void retryActivation();
    return () => {
      settingsRequestRef.current += 1;
      settingsAbortRef.current?.abort();
      activationEpochRef.current += 1;
      fenceListLoad();
    };
  }, [fenceListLoad, retryActivation]);

  const replaceRule = useCallback((next: WatchRuleDTO) => {
    setRules((current) => {
      const index = current.findIndex((rule) => rule.id === next.id);
      if (index < 0) return [next, ...current];
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
    return next;
  }, []);

  const activationIsCurrent = useCallback((activationEpoch: number) => {
    if (availabilityRef.current !== "enabled" || activationEpochRef.current !== activationEpoch) {
      throw new Error(RULE_ACTIVATION_NOT_ENABLED);
    }
  }, []);
  const finishMutation = useCallback((next: WatchRuleDTO, activationEpoch: number) => {
    activationIsCurrent(activationEpoch);
    // A list read may have started after this write. Fence it again so its
    // pre-write snapshot cannot replace the persisted write response.
    fenceListLoad();
    const replaced = replaceRule(next);
    // A completed write must not erase a list error that won the race.
    if (!authorityHasError(statusRef)) publishStatus("ready");
    return replaced;
  }, [activationIsCurrent, fenceListLoad, publishStatus, replaceRule]);
  const requireReadyAuthority = useCallback(() => {
    if (availabilityRef.current !== "enabled") throw new Error(RULE_ACTIVATION_NOT_ENABLED);
    if (statusRef.current !== "ready") throw new Error(RULE_AUTHORITY_NOT_READY);
    return activationEpochRef.current;
  }, []);
  const create = useCallback(async (body: WatchRuleWriteDTO) => {
    const activationEpoch = requireReadyAuthority();
    fenceListLoad();
    return finishMutation(await createWatchRule(body), activationEpoch);
  }, [fenceListLoad, finishMutation, requireReadyAuthority]);
  const update = useCallback(async (id: string, expectedVersion: number, patch: WatchRuleWriteDTO) => {
    const activationEpoch = requireReadyAuthority();
    fenceListLoad();
    return finishMutation(await updateWatchRule(id, expectedVersion, patch), activationEpoch);
  }, [fenceListLoad, finishMutation, requireReadyAuthority]);
  const reloadOne = useCallback(async (id: string) => {
    const activationEpoch = requireReadyAuthority();
    fenceListLoad();
    return finishMutation(await getWatchRule(id), activationEpoch);
  }, [fenceListLoad, finishMutation, requireReadyAuthority]);

  return {
    availability,
    activationError,
    status,
    error,
    rules,
    retryActivation,
    refresh,
    create,
    update,
    reloadOne,
  };
}

export interface PersistedMonitorController {
  status: PersistedLoadStatus;
  error: string | null;
  events: AlertEventDTO[];
  visibleEvents: AlertEventDTO[];
  counts: Record<AlertEventDTO["state"], number>;
  filter: MonitorAlertFilter;
  setFilter: (filter: MonitorAlertFilter) => void;
  activeEventId: string | null;
  setActiveEvent: (id: string | null) => void;
  selectedIds: string[];
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  pendingIds: ReadonlySet<string>;
  mutateEvent: (
    id: string,
    state: AlertEventDTO["state"],
    opts?: { assignee?: string; note?: string; resolutionNote?: string },
  ) => Promise<AlertEventDTO>;
  acknowledgeSelected: () => Promise<void>;
  batchPending: boolean;
  batchError: string | null;
  batchErrorAction: BatchErrorAction;
  lastMutationMessage: string | null;
  requiresAuthoritativeReload: boolean;
  refresh: (options?: { preserveReadyView?: boolean }) => Promise<boolean>;
  rules: PersistedWatchRuleController;
}

export function usePersistedMonitorController(initialActiveEventId: string | null = null): PersistedMonitorController {
  const [status, setStatus] = useState<PersistedLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<AlertEventDTO[]>([]);
  const [filter, setFilterState] = useState<MonitorAlertFilter>("all");
  const [activeEventId, setActiveEventId] = useState<string | null>(initialActiveEventId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [batchPending, setBatchPending] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchErrorAction, setBatchErrorAction] = useState<BatchErrorAction>(null);
  const [lastMutationMessage, setLastMutationMessage] = useState<string | null>(null);
  const [requiresAuthoritativeReload, setRequiresAuthoritativeReload] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const initialActiveRef = useRef(initialActiveEventId);
  const statusRef = useRef<PersistedLoadStatus>("loading");
  const eventsRef = useRef<AlertEventDTO[]>([]);
  const filterRef = useRef<MonitorAlertFilter>("all");
  const selectedIdsRef = useRef<string[]>([]);
  const batchErrorSelectionRef = useRef<string | null>(null);
  const pendingRef = useRef(new Set<string>());
  const pendingPromisesRef = useRef(new Map<string, { intent: string; promise: Promise<AlertEventDTO> }>());
  const batchRef = useRef(false);
  const authorityReloadRequiredRef = useRef(false);
  const authorityFenceEpochRef = useRef(0);
  const authorityPendingMutationsRef = useRef(new Set<Promise<AlertEventDTO>>());
  const rules = usePersistedWatchRuleController();
  const publishStatus = useCallback((next: PersistedLoadStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);
  const selectionKey = selectionIdentity(selectedIds);
  selectedIdsRef.current = selectedIds;

  useEffect(() => {
    if (batchErrorSelectionRef.current === null || batchErrorSelectionRef.current === selectionKey) return;
    batchErrorSelectionRef.current = null;
    setBatchError(null);
    setBatchErrorAction(null);
  }, [selectionKey]);

  const requireAuthoritativeReload = useCallback(() => {
    authorityFenceEpochRef.current += 1;
    authorityReloadRequiredRef.current = true;
    for (const pending of pendingPromisesRef.current.values()) {
      authorityPendingMutationsRef.current.add(pending.promise);
    }
    if (batchErrorSelectionRef.current !== null) {
      setBatchErrorAction("reload");
      setBatchError("Persisted alert authority changed in another session. An authoritative reload is required; review persisted state and make a fresh selection before another batch action.");
    }
    setRequiresAuthoritativeReload(true);
  }, []);

  const refresh = useCallback(async (options?: { preserveReadyView?: boolean }) => {
    const preserveReadyView = options?.preserveReadyView === true
      && (statusRef.current === "ready" || authorityReloadRequiredRef.current);
    const request = requestRef.current + 1;
    requestRef.current = request;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    if (preserveReadyView) statusRef.current = "loading";
    else publishStatus("loading");
    setError(null);
    if (authorityReloadRequiredRef.current) {
      // A GET cannot be the final authority while an older PATCH can still
      // publish afterward. Drain the exact mutation set captured when the
      // lifecycle conflict raised the barrier; new writes are already fenced.
      await Promise.allSettled([...authorityPendingMutationsRef.current]);
      if (requestRef.current !== request || abort.signal.aborted) return false;
    }
    // Another captured mutation may itself have raised a conflict while the
    // drain was in progress. The post-drain epoch is the one this GET proves.
    const authorityFenceEpoch = authorityFenceEpochRef.current;
    try {
      const loaded = await drainPages<AlertEventDTO>(
        (cursor, signal) => getAlertEventPage({ limit: ALERT_PAGE_LIMIT, cursor, signal }) as Promise<AlertEventPageDTO>,
        abort.signal,
        "Persisted alert pagination repeated a cursor.",
      );
      if (requestRef.current !== request || abort.signal.aborted) return false;
      if (authorityReloadRequiredRef.current && authorityFenceEpochRef.current !== authorityFenceEpoch) return false;
      const unique = new Map(loaded.map((event) => [event.id, event]));
      const next = [...unique.values()];
      const currentFilter = filterRef.current;
      const visible = (event: AlertEventDTO | undefined): event is AlertEventDTO => event !== undefined
        && (currentFilter === "all" || event.state === currentFilter);
      eventsRef.current = next;
      setEvents(next);
      setSelectedIds((current) => {
        const retainedIds = current.filter((id) => {
          const retained = unique.get(id);
          return visible(retained) && retained.state !== "resolved";
        });
        selectedIdsRef.current = retainedIds;
        return retainedIds;
      });
      setActiveEventId((current) => {
        if (current && visible(unique.get(current))) return current;
        if (initialActiveRef.current && visible(unique.get(initialActiveRef.current))) return initialActiveRef.current;
        return next.find((event) => visible(event))?.id ?? null;
      });
      if (authorityReloadRequiredRef.current) {
        // A lifecycle conflict invalidates every captured batch intent. Even
        // when the same rows survive the reload, the analyst must choose them
        // again against the newly persisted state.
        selectedIdsRef.current = [];
        setSelectedIds([]);
        authorityReloadRequiredRef.current = false;
        authorityPendingMutationsRef.current.clear();
        setRequiresAuthoritativeReload(false);
      }
      publishStatus("ready");
      return true;
    } catch (reason) {
      if (requestRef.current !== request || abort.signal.aborted) return false;
      setError(toErrorMessage(reason, "Persisted alert events are unavailable"));
      if (preserveReadyView && authorityReloadRequiredRef.current) {
        // Keep the analyst's draft mounted, but leave mutation authority
        // closed until a later persisted reload succeeds.
        statusRef.current = "error";
        return false;
      }
      publishStatus("error");
      return false;
    }
  }, [publishStatus]);

  useEffect(() => {
    void refresh();
    return () => {
      requestRef.current += 1;
      abortRef.current?.abort();
    };
  }, [refresh]);

  const counts = useMemo(() => events.reduce<Record<AlertEventDTO["state"], number>>(
    (totals, event) => ({ ...totals, [event.state]: totals[event.state] + 1 }),
    { open: 0, ack: 0, resolved: 0 },
  ), [events]);
  const visibleEvents = useMemo(
    () => filter === "all" ? events : events.filter((event) => event.state === filter),
    [events, filter],
  );

  const setActiveEvent = useCallback((id: string | null) => {
    if (id === null) {
      setActiveEventId(null);
      return;
    }
    const candidate = eventsRef.current.find((event) => event.id === id);
    const currentFilter = filterRef.current;
    if (candidate && (currentFilter === "all" || candidate.state === currentFilter)) setActiveEventId(id);
  }, []);
  const toggleSelected = useCallback((id: string) => {
    const candidate = eventsRef.current.find((event) => event.id === id);
    const currentFilter = filterRef.current;
    if (!candidate || candidate.state === "resolved" || (currentFilter !== "all" && candidate.state !== currentFilter)) return;
    setSelectedIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((selected) => selected !== id);
        selectedIdsRef.current = next;
        if (activeEventId === id) setActiveEventId(next[0] ?? id);
        return next;
      }
      setActiveEventId(id);
      const next = [...current, id];
      selectedIdsRef.current = next;
      return next;
    });
  }, [activeEventId]);
  const clearSelection = useCallback(() => {
    selectedIdsRef.current = [];
    setSelectedIds([]);
  }, []);
  const setFilter = useCallback((next: MonitorAlertFilter) => {
    filterRef.current = next;
    setFilterState(next);
    selectedIdsRef.current = [];
    setSelectedIds([]);
    const first = next === "all" ? events[0] : events.find((event) => event.state === next);
    setActiveEventId(first?.id ?? null);
  }, [events]);

  const mutateEvent = useCallback(async (
    id: string,
    nextState: AlertEventDTO["state"],
    opts?: { assignee?: string; note?: string; resolutionNote?: string },
  ) => {
    if (statusRef.current !== "ready" || authorityReloadRequiredRef.current) throw new Error(ALERT_AUTHORITY_NOT_READY);
    const existing = eventsRef.current.find((event) => event.id === id);
    if (!existing) throw new Error("Persisted alert event is no longer available");
    const intent = JSON.stringify([
      nextState,
      opts?.assignee ?? null,
      opts?.note ?? null,
      opts?.resolutionNote ?? null,
    ]);
    const inFlight = pendingPromisesRef.current.get(id);
    if (inFlight) {
      if (inFlight.intent === intent) return inFlight.promise;
      throw new Error("A different update is already in progress for this persisted alert");
    }
    pendingRef.current.add(id);
    setPendingIds(new Set(pendingRef.current));
    const request = patchAlertEvent(id, nextState, opts);
    pendingPromisesRef.current.set(id, { intent, promise: request });
    try {
      const next = await request;
      // A list request that began before this transition has an older state
      // snapshot and must never replace the successful mutation.
      if (!authorityReloadRequiredRef.current) {
        requestRef.current += 1;
        abortRef.current?.abort();
      }
      const updatedEvents = eventsRef.current.map((event) => event.id === id ? next : event);
      eventsRef.current = updatedEvents;
      setEvents(updatedEvents);
      const workflowLabel = next.state === "ack" ? "acknowledged" : next.state;
      setLastMutationMessage(`${next.title} ${workflowLabel}. Persisted workflow state updated.`);
      const currentFilter = filterRef.current;
      if (next.state === "resolved" || (currentFilter !== "all" && next.state !== currentFilter)) {
        setSelectedIds((current) => {
          const retained = current.filter((selected) => selected !== id);
          selectedIdsRef.current = retained;
          return retained;
        });
      }
      const visible = (event: AlertEventDTO | undefined) => event !== undefined
        && (currentFilter === "all" || event.state === currentFilter);
      setActiveEventId((current) => {
        if (current && visible(updatedEvents.find((event) => event.id === current))) return current;
        return updatedEvents.find((event) => visible(event))?.id ?? null;
      });
      // The mutation may race a newer list failure. Preserve that error rather
      // than claiming the full list is authoritative again.
      if (!authorityHasError(statusRef) && !authorityReloadRequiredRef.current) publishStatus("ready");
      return next;
    } catch (reason) {
      if (isAlertLifecycleConflict(reason)) requireAuthoritativeReload();
      throw reason;
    } finally {
      pendingPromisesRef.current.delete(id);
      pendingRef.current.delete(id);
      setPendingIds(new Set(pendingRef.current));
    }
  }, [publishStatus, requireAuthoritativeReload]);

  const acknowledgeSelected = useCallback(async () => {
    if (batchRef.current || selectedIds.length === 0) return;
    if (statusRef.current !== "ready" || authorityReloadRequiredRef.current) {
      const reason = new Error(ALERT_AUTHORITY_NOT_READY);
      batchErrorSelectionRef.current = selectionIdentity(selectedIdsRef.current);
      setBatchErrorAction(authorityReloadRequiredRef.current ? "reload" : null);
      setBatchError(`${reason.message}. Selection was preserved${authorityReloadRequiredRef.current ? "; an authoritative reload is required" : ""}.`);
      throw reason;
    }
    batchRef.current = true;
    setBatchPending(true);
    batchErrorSelectionRef.current = null;
    setBatchError(null);
    setBatchErrorAction(null);
    const ids = [...selectedIds];
    try {
      const outcomes = await Promise.allSettled(ids.map((id) => mutateEvent(id, "ack")));
      const lifecycleFailure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected" && isAlertLifecycleConflict(outcome.reason));
      if (lifecycleFailure) {
        batchErrorSelectionRef.current = selectionIdentity(selectedIdsRef.current);
        setBatchErrorAction("reload");
        setBatchError("Alert lifecycle changed in another session. Reloading persisted events before another batch action.");
        const reconciled = await refresh({ preserveReadyView: true });
        if (reconciled) {
          batchErrorSelectionRef.current = selectionIdentity(selectedIdsRef.current);
          setBatchErrorAction("review");
          setBatchError("Alert lifecycle changed in another session. Persisted events were reloaded; make a fresh selection before acknowledging.");
        } else {
          batchErrorSelectionRef.current = selectionIdentity(selectedIdsRef.current);
          setBatchErrorAction("reload");
          setBatchError("Alert lifecycle changed in another session. An authoritative reload is required before another batch action.");
        }
        throw lifecycleFailure.reason;
      }
      const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
      if (failure) {
        if (authorityReloadRequiredRef.current) {
          batchErrorSelectionRef.current = selectionIdentity(selectedIdsRef.current);
          setBatchErrorAction("reload");
          setBatchError(`${toErrorMessage(failure.reason, "Selected alerts were not acknowledged")}. Persisted alert authority changed; an authoritative reload is required before another batch action.`);
          throw failure.reason;
        }
        const failedIds = outcomes.flatMap((outcome, index) => outcome.status === "rejected" ? [ids[index]!] : []);
        const currentSelection = selectedIdsRef.current;
        const capturedIds = new Set(ids);
        const retainsEveryFailure = failedIds.every((id) => currentSelection.includes(id));
        const retargetedOutsideBatch = currentSelection.some((id) => !capturedIds.has(id));
        if (retainsEveryFailure && !retargetedOutsideBatch) {
          const retrySelection = selectionIdentity(currentSelection);
          batchErrorSelectionRef.current = retrySelection;
          setBatchErrorAction("retry");
          setBatchError(`${toErrorMessage(failure.reason, "Selected alerts were not acknowledged")}. Selection was preserved; retry acknowledgment.`);
        }
        throw failure.reason;
      }
      const acknowledged = new Set(ids);
      setSelectedIds((current) => {
        const retained = current.filter((id) => !acknowledged.has(id));
        selectedIdsRef.current = retained;
        return retained;
      });
    } finally {
      batchRef.current = false;
      setBatchPending(false);
    }
  }, [mutateEvent, refresh, selectedIds]);

  return {
    status,
    error,
    events,
    visibleEvents,
    counts,
    filter,
    setFilter,
    activeEventId,
    setActiveEvent,
    selectedIds,
    toggleSelected,
    clearSelection,
    pendingIds,
    mutateEvent,
    acknowledgeSelected,
    batchPending,
    batchError,
    batchErrorAction,
    lastMutationMessage,
    requiresAuthoritativeReload,
    refresh,
    rules,
  };
}
