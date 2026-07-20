// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider, useNotify } from "./Notifications";
import { listNotifications, markNotificationSeen } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listNotifications: vi.fn(),
  markNotificationSeen: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const historyEvent = {
  id: "history-1",
  kind: "run_complete",
  subject_kind: "run",
  subject_id: "run-history",
  issuer_id: "issuer-1",
  title: "Historical run complete",
  body: "Old result",
  href: "/pipeline?run=run-history&view=graph",
  action_label: null,
  seen_at: null,
  created_at: "2026-07-15T09:00:00Z",
};

describe("NotificationProvider durable feed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    vi.mocked(markNotificationSeen).mockResolvedValue(historyEvent);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not replay initial history and emits a linked toast once for a new event", async () => {
    const fresh = {
      ...historyEvent,
      id: "fresh-1",
      subject_id: "run-fresh",
      title: "Fresh run complete",
      href: "/pipeline?run=run-fresh&view=graph",
      action_label: "Open execution graph",
    };
    const plain = { ...fresh, id: "plain-1", title: "Plain event", body: null, href: null };
    const linked = { ...fresh, id: "linked-1", title: "Linked event", body: "Linked body", href: "/reports?report=version-1", action_label: "Open report" };
    const legacyLinked = { ...fresh, id: "legacy-linked-1", title: "Legacy linked event", body: "Legacy body", href: "/issuers", action_label: null };
    vi.mocked(listNotifications)
      .mockResolvedValueOnce({ items: [historyEvent], next_cursor: "cursor-1" })
      .mockResolvedValueOnce({ items: [fresh], next_cursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [fresh], next_cursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [plain, linked, legacyLinked], next_cursor: null });

    render(<NotificationProvider><div>Application</div></NotificationProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(listNotifications).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Historical run complete")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
    });
    expect(screen.getByText("Fresh run complete")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open execution graph" }).getAttribute("href"))
      .toBe("/pipeline?run=run-fresh&view=graph");

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(screen.getAllByText("Fresh run complete")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Fresh run complete" }));
    expect(markNotificationSeen).toHaveBeenCalledWith("fresh-1");
    expect(screen.queryByText("Fresh run complete")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
    });
    expect(screen.getByText("Plain event")).toBeTruthy();
    expect(screen.getByText("Linked event")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open report" }).getAttribute("href")).toBe("/reports?report=version-1");
    expect(screen.getByRole("link", { name: "Open related item" }).getAttribute("href")).toBe("/issuers");
    vi.mocked(markNotificationSeen).mockRejectedValueOnce(new Error("seen write failed"));
    fireEvent.click(screen.getByRole("link", { name: "Open report" }));
    expect(markNotificationSeen).toHaveBeenCalledWith("linked-1");
    expect(screen.queryByText("Linked event")).toBeNull();
    expect(screen.queryByText("Old result")).toBeNull();
  });

  it("emits and automatically dismisses a local notification through useNotify", async () => {
    vi.mocked(listNotifications).mockResolvedValue({ items: [], next_cursor: null });
    function Emitter() {
      const notify = useNotify();
      return <button onClick={() => notify("Local notice")}>Notify locally</button>;
    }
    render(<NotificationProvider><Emitter /></NotificationProvider>);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Notify locally" }));
    expect(screen.getByText("Local notice")).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(7000); });
    expect(screen.queryByText("Local notice")).toBeNull();
    expect(markNotificationSeen).not.toHaveBeenCalled();
  });

  it("retries a failed feed only when the document becomes visible", async () => {
    vi.mocked(listNotifications)
      .mockRejectedValueOnce(new Error("feed offline"))
      .mockResolvedValueOnce({ items: [], next_cursor: null });
    render(<NotificationProvider><div>Application</div></NotificationProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(listNotifications).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    expect(listNotifications).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => { await Promise.resolve(); });
    expect(listNotifications).toHaveBeenCalledTimes(2);
  });

  it("suppresses overlapping polls and ignores a feed that resolves after unmount", async () => {
    let resolveFeed!: (feed: { items: typeof historyEvent[]; next_cursor: string | null }) => void;
    vi.mocked(listNotifications).mockImplementationOnce(() => new Promise((resolve) => { resolveFeed = resolve; }));
    const view = render(<NotificationProvider><div>Application</div></NotificationProvider>);
    await act(async () => { await Promise.resolve(); });
    window.dispatchEvent(new Event("focus"));
    expect(listNotifications).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => { resolveFeed({ items: [historyEvent], next_cursor: "late" }); await Promise.resolve(); });
    expect(screen.queryByText("Historical run complete")).toBeNull();
  });
});
