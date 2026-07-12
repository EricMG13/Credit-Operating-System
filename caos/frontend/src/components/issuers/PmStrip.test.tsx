// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PmStrip } from "./PmStrip";

afterEach(cleanup);

describe("PmStrip", () => {
  it("renders every cell from the supplied fields", () => {
    render(
      <PmStrip
        posture={{ label: "Cleared · OVERWEIGHT", sev: "ok" }}
        whatChanged="EBITDA margin up 1.2pp YoY"
        risk="Covenant headroom tightening"
        evidenceHealth={{ label: "clean", sev: "ok" }}
        action={{ label: "Review thesis", href: "/deepdive?issuer=x" }}
      />,
    );
    expect(screen.getByText("Cleared · OVERWEIGHT")).toBeTruthy();
    expect(screen.getByText("EBITDA margin up 1.2pp YoY")).toBeTruthy();
    expect(screen.getByText("Covenant headroom tightening")).toBeTruthy();
    expect(screen.getByText("clean")).toBeTruthy();
    const action = screen.getByRole("link", { name: /Review thesis/ });
    expect(action.getAttribute("href")).toBe("/deepdive?issuer=x");
  });

  it("renders an explicit '—' placeholder for missing posture — never a synthesized stance", () => {
    render(
      <PmStrip
        posture={null}
        whatChanged=""
        risk=""
        evidenceHealth={{ label: "no run", sev: "low" }}
        action={{ label: "Review thesis", href: "/deepdive?issuer=x" }}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2); // posture + whatChanged/risk
  });
});
