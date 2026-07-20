"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ModalBackdrop } from "./ModalBackdrop";
import { useModalA11y } from "@/lib/use-modal-a11y";

interface GuardRegistration {
  dirty: boolean;
  enabled: boolean;
  onDiscard: () => void;
}

interface PendingNavigation {
  proceed: () => void;
  guards: GuardRegistration[];
}

interface NavigationGuardContextValue {
  registerGuard: (id: symbol, registration: GuardRegistration) => () => void;
  /** Returns true when the attempt ran immediately, false when confirmation is pending. */
  attemptNavigation: (proceed: () => void) => boolean;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);
const HISTORY_INDEX_KEY = "__caosNavigationGuardIndex";

function historyIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[HISTORY_INDEX_KEY];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function withHistoryIndex(state: unknown, index: number): Record<string, unknown> {
  return state && typeof state === "object" && !Array.isArray(state)
    ? { ...(state as Record<string, unknown>), [HISTORY_INDEX_KEY]: index }
    : { [HISTORY_INDEX_KEY]: index };
}

type ActiveGuards = () => GuardRegistration[];

const guardedAnchorUrl = (event: MouseEvent, hasActiveGuards: boolean): URL | null => {
  if (!hasActiveGuards || event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!anchor || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target.toLowerCase() !== "_self") return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return url.pathname === window.location.pathname && url.search === window.location.search ? null : url;
};

const useBeforeUnloadGuard = (activeGuardCount: number) => {
  useEffect(() => {
    if (activeGuardCount === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [activeGuardCount]);
};

const useAnchorNavigationGuard = (
  activeGuards: ActiveGuards,
  queueAttempt: (proceed: () => void) => boolean,
  router: ReturnType<typeof useRouter>,
) => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const url = guardedAnchorUrl(event, activeGuards().length > 0);
      if (!url) return;
      event.preventDefault();
      event.stopPropagation();
      queueAttempt(() => router.push(`${url.pathname}${url.search}${url.hash}`));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [activeGuards, queueAttempt, router]);
};

const useHistoryNavigationGuard = (
  activeGuards: ActiveGuards,
  pendingRef: { current: PendingNavigation | null },
  setPending: (pending: PendingNavigation | null) => void,
) => {
  useEffect(() => {
    const history = window.history;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const originalIndex = historyIndex(history.state) ?? 0;
    const currentIndex = { value: originalIndex };
    originalReplaceState.call(history, withHistoryIndex(history.state, originalIndex), "", window.location.href);
    const wrappedPushState: History["pushState"] = (data, unused, url) => {
      const next = currentIndex.value + 1;
      currentIndex.value = next;
      return originalPushState.call(history, withHistoryIndex(data, next), unused, url);
    };
    const wrappedReplaceState: History["replaceState"] = (data, unused, url) =>
      originalReplaceState.call(history, withHistoryIndex(data, currentIndex.value), unused, url);
    history.pushState = wrappedPushState;
    history.replaceState = wrappedReplaceState;
    let allowNextPop = false;
    let bounce: { origin: number; delta: number; guards: GuardRegistration[] } | null = null;
    const onPopState = (event: PopStateEvent) => {
      const destination = historyIndex(event.state);
      if (allowNextPop) {
        allowNextPop = false;
        if (destination != null) currentIndex.value = destination;
        return;
      }
      if (bounce) {
        const resumed = bounce;
        bounce = null;
        currentIndex.value = resumed.origin;
        if (!pendingRef.current) {
          const request: PendingNavigation = {
            guards: resumed.guards,
            proceed: () => { allowNextPop = true; history.go(resumed.delta); },
          };
          pendingRef.current = request;
          setPending(request);
        }
        return;
      }
      const delta = destination == null ? -1 : destination - currentIndex.value;
      if (delta === 0) return;
      const guards = activeGuards();
      if (guards.length === 0) {
        if (destination != null) currentIndex.value = destination;
        return;
      }
      bounce = { origin: currentIndex.value, delta, guards };
      history.go(-delta);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (history.pushState === wrappedPushState) history.pushState = originalPushState;
      if (history.replaceState === wrappedReplaceState) history.replaceState = originalReplaceState;
    };
  }, [activeGuards, pendingRef, setPending]);
};

const useGuardRegistrations = () => {
  const registrations = useRef(new Map<symbol, GuardRegistration>());
  const [activeGuardCount, setActiveGuardCount] = useState(0);
  const activeGuards = useCallback(
    () => Array.from(registrations.current.values()).filter((guard) => guard.enabled && guard.dirty),
    [],
  );
  const syncActiveCount = useCallback(() => setActiveGuardCount(activeGuards().length), [activeGuards]);
  const registerGuard = useCallback((id: symbol, registration: GuardRegistration) => {
    registrations.current.set(id, registration);
    syncActiveCount();
    return () => {
      if (registrations.current.get(id) === registration) registrations.current.delete(id);
      syncActiveCount();
    };
  }, [syncActiveCount]);
  return { activeGuards, activeGuardCount, registerGuard };
};

const usePendingNavigation = (activeGuards: ActiveGuards) => {
  const pendingRef = useRef<PendingNavigation | null>(null);
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const queueAttempt = useCallback((proceed: () => void): boolean => {
    const guards = activeGuards();
    if (guards.length === 0) {
      proceed();
      return true;
    }
    if (pendingRef.current) return false;
    const request = { proceed, guards };
    pendingRef.current = request;
    setPending(request);
    return false;
  }, [activeGuards]);
  const stay = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);
  const discardAndLeave = useCallback(() => {
    // NavigationGuardFrame only exposes this callback while `pending` exists.
    const request = pendingRef.current!;
    pendingRef.current = null;
    setPending(null);
    request.guards.forEach((guard) => {
      try { guard.onDiscard(); } catch { /* navigation remains the user's choice */ }
    });
    request.proceed();
  }, []);
  return { pendingRef, pending, setPending, queueAttempt, stay, discardAndLeave };
};

function NavigationGuardFrame({
  value,
  children,
  pending,
  onStay,
  onDiscard,
}: {
  value: NavigationGuardContextValue;
  children: ReactNode;
  pending: PendingNavigation | null;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      {pending ? <NavigationConfirmDialog onStay={onStay} onDiscard={onDiscard} /> : null}
    </NavigationGuardContext.Provider>
  );
}

/**
 * Root navigation guard. Routes opt in through useNavigationGuard; clean routes
 * pay no beforeunload cost and every in-app confirmation remains user-driven.
 */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { activeGuards, activeGuardCount, registerGuard } = useGuardRegistrations();
  const { pendingRef, pending, setPending, queueAttempt, stay, discardAndLeave } = usePendingNavigation(activeGuards);

  useBeforeUnloadGuard(activeGuardCount);
  useAnchorNavigationGuard(activeGuards, queueAttempt, router);
  useHistoryNavigationGuard(activeGuards, pendingRef, setPending);

  const value = useMemo<NavigationGuardContextValue>(
    () => ({ registerGuard, attemptNavigation: queueAttempt }),
    [queueAttempt, registerGuard],
  );

  return <NavigationGuardFrame value={value} pending={pending} onStay={stay} onDiscard={discardAndLeave}>{children}</NavigationGuardFrame>;
}

/** Register one route's dirty state. Registration alone never saves or navigates. */
export function useNavigationGuard({ dirty, enabled, onDiscard }: GuardRegistration): void {
  const context = useContext(NavigationGuardContext);
  if (!context) throw new Error("useNavigationGuard must be used inside NavigationGuardProvider");
  const id = useRef(Symbol("navigation-guard"));
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  useEffect(
    () => context.registerGuard(id.current, { dirty, enabled, onDiscard: () => onDiscardRef.current() }),
    [context, dirty, enabled],
  );
}

/** Guard a future router.push/replace or other programmatic route attempt. */
export function useNavigationAttempt(): (proceed: () => void) => boolean {
  const context = useContext(NavigationGuardContext);
  if (!context) throw new Error("useNavigationAttempt must be used inside NavigationGuardProvider");
  return context.attemptNavigation;
}

function NavigationConfirmDialog({ onStay, onDiscard }: { onStay: () => void; onDiscard: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onStay);
  return (
    <ModalBackdrop onClose={onStay} padded>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="navigation-guard-title"
        aria-describedby="navigation-guard-description"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-md border border-caos-border bg-caos-panel p-4 shadow-2xl"
      >
        <h2 id="navigation-guard-title" className="text-caos-lg font-semibold text-caos-text">
          Leave with unsaved changes?
        </h2>
        <p id="navigation-guard-description" className="mt-2 text-caos-sm leading-relaxed text-caos-muted">
          Your unsaved changes will be discarded. Nothing will be saved automatically.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onStay} className="caos-action-secondary focus-ring">
            Stay
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="caos-action-secondary focus-ring border-caos-critical text-caos-critical hover:bg-caos-critical hover:text-white"
          >
            Discard &amp; leave
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
