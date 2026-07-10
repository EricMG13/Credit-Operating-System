// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PostureSummary } from "./views";
import { PORTFOLIO } from "@/lib/command/data";

afterEach(cleanup);

describe("PostureSummary (command-center posture lead band)", () => {
  it("renders the posture verdict from the real portfolio", () => {
    render(<PostureSummary />);
    // leads with the position count
    expect(screen.getByText(new RegExp(`${PORTFOLIO.length} positions`))).toBeTruthy();
    // every bucket is labelled — colour is never the only carrier (WCAG 1.4.1)
    ["OW", "HOLD", "UW", "REDUCE"].forEach((l) => expect(screen.getByText(l)).toBeTruthy());
    // the HOLD count shown matches the data (guards the counting loop)
    const hold = PORTFOLIO.filter((p) => p.posture === "HOLD").length;
    expect(screen.getByText(String(hold))).toBeTruthy();
    // actionable callouts present
    expect(screen.getByText("On watch")).toBeTruthy();
    expect(screen.getByText("QA open")).toBeTruthy();
  });
});
