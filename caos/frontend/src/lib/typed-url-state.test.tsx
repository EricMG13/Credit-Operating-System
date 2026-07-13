// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mergeAllowedUrlState, useTypedUrlState } from "./typed-url-state";

afterEach(cleanup);

const ROUTE_KEYS = ["tab", "sort"] as const;

function Harness() {
  const { values, update } = useTypedUrlState(ROUTE_KEYS);
  return (
    <div>
      <output aria-label="Active tab">{values.tab ?? "none"}</output>
      <button type="button" onClick={() => update({ tab: "risk", sort: "desc" })}>
        Set risk view
      </button>
    </div>
  );
}

describe("typed URL state", () => {
  it("updates only allow-listed keys while preserving context and unrelated route state", () => {
    const current = new URLSearchParams("context=ctx-1&issuer=issuer-1&tab=overview");
    const next = mergeAllowedUrlState(current, { tab: "risk", sort: "desc" }, ROUTE_KEYS);
    expect(next.toString()).toBe("context=ctx-1&issuer=issuer-1&tab=risk&sort=desc");
    expect(() => mergeAllowedUrlState(
      current,
      { permission: "admin" } as never,
      ROUTE_KEYS,
    )).toThrow(/not allow-listed/i);
  });

  it("reacts to browser back/forward popstate snapshots", () => {
    window.history.replaceState({}, "", "/portfolios?context=ctx-1&issuer=issuer-1&tab=overview#evidence");
    render(<Harness />);
    expect(screen.getByRole("status", { name: "Active tab" }).textContent).toBe("overview");

    fireEvent.click(screen.getByRole("button", { name: "Set risk view" }));
    expect(window.location.search).toBe("?context=ctx-1&issuer=issuer-1&tab=risk&sort=desc");
    expect(window.location.hash).toBe("#evidence");
    expect(screen.getByRole("status", { name: "Active tab" }).textContent).toBe("risk");

    act(() => {
      // Back/forward updates location first, then emits popstate.
      window.history.replaceState({}, "", "/portfolios?context=ctx-1&issuer=issuer-1&tab=overview#evidence");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("status", { name: "Active tab" }).textContent).toBe("overview");
  });
});
