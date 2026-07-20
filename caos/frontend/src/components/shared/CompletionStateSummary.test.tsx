// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CompletionStateSummary } from "./CompletionStateSummary";

afterEach(cleanup);

describe("CompletionStateSummary", () => {
  it("renders the four caller-owned axes without inferring a happy state", () => {
    render(
      <CompletionStateSummary
        label="Model completion"
        execution="complete"
        persistence="unsaved"
        approval="unratified"
        freshness="unknown"
      />,
    );

    const summary = screen.getByRole("group", { name: "Model completion" });
    expect(summary.getAttribute("data-execution")).toBe("complete");
    expect(summary.getAttribute("data-persistence")).toBe("unsaved");
    expect(summary.getAttribute("data-approval")).toBe("unratified");
    expect(summary.getAttribute("data-freshness")).toBe("unknown");
    expect(screen.getByText("Complete")).toBeTruthy();
    expect(screen.getByText("Unsaved")).toBeTruthy();
    expect(screen.getByText("Unratified")).toBeTruthy();
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Execution: Complete" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Persistence: Unsaved" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Approval: Unratified" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Freshness: Unknown" })).toBeTruthy();
    expect(screen.getByText("Exec")).toBeTruthy();
    expect(screen.getByText("Execution")).toBeTruthy();
    expect(screen.getByText("Persist")).toBeTruthy();
    expect(screen.getByText("Persistence")).toBeTruthy();
    expect(screen.getByText("Fresh")).toBeTruthy();
    expect(screen.getByText("Freshness")).toBeTruthy();
    for (const [axis, compact, wide] of [
      ["Execution", "Exec", "Execution"],
      ["Persistence", "Persist", "Persistence"],
      ["Approval", "Approval", "Approval"],
      ["Freshness", "Fresh", "Freshness"],
    ]) {
      const axisNode = summary.querySelector(`[data-completion-axis="${axis}"]`)!;
      expect(axisNode.querySelector(".xl\\:hidden")?.textContent).toBe(compact);
      expect(axisNode.querySelector(".hidden.xl\\:inline")?.textContent).toBe(wide);
    }
  });

  it("allows every axis to vary independently and exposes explicit N/A", () => {
    const { rerender } = render(
      <CompletionStateSummary
        label="Completion state"
        execution="running"
        persistence="saved"
        approval="conditional"
        freshness="stale"
      />,
    );
    expect(screen.getByRole("group", { name: "Completion state" }).getAttribute("data-execution")).toBe("running");
    expect(screen.getByRole("group", { name: "Completion state" }).getAttribute("data-persistence")).toBe("saved");
    expect(screen.getByRole("group", { name: "Completion state" }).getAttribute("data-approval")).toBe("conditional");
    expect(screen.getByRole("group", { name: "Completion state" }).getAttribute("data-freshness")).toBe("stale");

    rerender(
      <CompletionStateSummary
        label="Completion state"
        execution="failed"
        persistence="draft"
        approval="ratified"
        freshness="current"
      />,
    );
    const summary = screen.getByRole("group", { name: "Completion state" });
    expect(summary.getAttribute("data-execution")).toBe("failed");
    expect(summary.getAttribute("data-persistence")).toBe("draft");
    expect(summary.getAttribute("data-approval")).toBe("ratified");
    expect(summary.getAttribute("data-freshness")).toBe("current");

    rerender(
      <CompletionStateSummary
        label="Completion state"
        execution="not-started"
        persistence="not-applicable"
        approval="not-applicable"
        freshness="not-applicable"
      />,
    );
    expect(screen.getAllByText("N/A")).toHaveLength(3);

    rerender(
      <CompletionStateSummary
        label="Completion state"
        execution="complete"
        persistence="partial"
        approval="not-applicable"
        freshness="unknown"
      />,
    );
    expect(screen.getByRole("group", { name: "Completion state" }).getAttribute("data-persistence")).toBe("partial");
    expect(screen.getByRole("group", { name: "Persistence: Partial" })).toBeTruthy();
  });
});
