// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StepStrip } from "./steps";

afterEach(cleanup);

describe("StepStrip", () => {
  it("makes its horizontally scrollable progress region keyboard reachable", () => {
    render(
      <StepStrip
        step="file"
        selectedIssuer={null}
        modeMeta={{ k: "full", code: "R-IC", label: "Full IC Committee", desc: "Full route" }}
        filesCount={2}
      />
    );

    const strip = screen.getByRole("region", { name: "Document intake steps" });
    expect(strip.getAttribute("tabindex")).toBe("0");
    expect(strip.className).toContain("focus-ring");
  });
});
