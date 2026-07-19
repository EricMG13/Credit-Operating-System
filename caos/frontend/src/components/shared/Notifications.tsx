"use client";

import Link from "next/link";
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
import {
  listNotifications,
  markNotificationSeen,
} from "@/lib/api";

type Toast = {
  id: string;
  title: string;
  body?: string;
  href?: string;
  eventId?: string;
};
type NotificationFeed = Awaited<ReturnType<typeof listNotifications>>;

const pollingAllowed = (stopped: boolean, requestInFlight: boolean): boolean =>
  !stopped && document.visibilityState !== "hidden" && !requestInFlight;

const ingestNotificationFeed = (
  feed: NotificationFeed,
  initialized: { current: boolean },
  delivered: { current: Set<string> },
  enqueue: (toast: Toast) => void,
) => {
  if (!initialized.current) {
    for (const event of feed.items) delivered.current.add(event.id);
    initialized.current = true;
    return;
  }
  for (const event of feed.items) {
    if (delivered.current.has(event.id)) continue;
    delivered.current.add(event.id);
    enqueue({
      id: `event-${event.id}`,
      eventId: event.id,
      title: event.title,
      body: event.body ?? undefined,
      href: event.href ?? undefined,
    });
  }
};
const Ctx = createContext<(title: string, body?: string) => void>(() => {});

export function useNotify() {
  return useContext(Ctx);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const cursor = useRef<string | null>(null);
  const initialized = useRef(false);
  const requestInFlight = useRef(false);
  const delivered = useRef(new Set<string>());
  const localSequence = useRef(0);

  const dismiss = useCallback((id: string, eventId?: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (eventId) void markNotificationSeen(eventId).catch(() => undefined);
  }, []);

  const enqueue = useCallback((toast: Toast) => {
    setItems((current) => [...current, toast]);
    window.setTimeout(() => dismiss(toast.id, toast.eventId), 7000);
  }, [dismiss]);

  const notify = useCallback((title: string, body?: string) => {
    const id = `local-${Date.now()}-${localSequence.current++}`;
    enqueue({ id, title, body });
  }, [enqueue]);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      if (!pollingAllowed(stopped, requestInFlight.current)) return;
      requestInFlight.current = true;
      try {
        const feed = await listNotifications(cursor.current);
        if (stopped) return;
        // Establish a high-water mark on the first read; later reads enqueue
        // only unseen events from the durable notification feed.
        ingestNotificationFeed(feed, initialized, delivered, enqueue);
        cursor.current = feed.next_cursor ?? cursor.current;
      } catch {
        // A routine toast feed must never take down the application shell. The
        // next visible poll retries from the last confirmed high-water cursor.
      } finally {
        requestInFlight.current = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 8000);
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", poll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enqueue]);

  const value = useMemo(() => notify, [notify]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-14 right-3 z-toast flex max-h-[calc(100vh-96px)] w-[320px] max-w-[calc(100vw-24px)] flex-col gap-2 overflow-y-auto">
        {items.map((t) => (
          <div key={t.id} className="rounded border border-caos-accent/50 bg-caos-panel px-3 py-2 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="tabular text-caos-sm font-medium text-caos-text">{t.title}</div>
              <button
                type="button"
                onClick={() => dismiss(t.id, t.eventId)}
                className="rounded px-1 text-caos-muted transition-caos hover:text-caos-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caos-accent"
                aria-label={`Dismiss ${t.title}`}
              >
                ×
              </button>
            </div>
            {t.body ? <div className="mt-0.5 tabular text-caos-xs text-caos-muted">{t.body}</div> : null}
            {t.href ? (
              <Link
                href={t.href}
                onClick={() => dismiss(t.id, t.eventId)}
                className="mt-2 inline-flex rounded text-caos-xs font-semibold uppercase tracking-wider text-caos-accent transition-caos hover:text-caos-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caos-accent"
              >
                Open execution graph
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
