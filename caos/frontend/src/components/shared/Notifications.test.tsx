// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "./Notifications";
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
  seen_at: null,
  created_at: "2026-07-15T09:00:00Z",
};

describe("NotificationProvider durable feed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    };
    vi.mocked(listNotifications)
      .mockResolvedValueOnce({ items: [historyEvent], next_cursor: "cursor-1" })
      .mockResolvedValueOnce({ items: [fresh], next_cursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [fresh], next_cursor: "cursor-2" });

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
  });
});
