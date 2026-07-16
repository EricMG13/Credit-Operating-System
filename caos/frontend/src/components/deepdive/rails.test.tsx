// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DecisionRail } from "./rails";

afterEach(cleanup);

describe("DecisionRail committee-read state", () => {
  it("shows unknown rather than no findings when CP-5C could not be read", () => {
    render(
      <DecisionRail
        open
        onToggle={() => {}}
        council={[]}
        councilState="error"
        isReference={false}
        issuerCode="ISS-1"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Committee review unknown");
    expect(alert.textContent).toContain("do not infer an all-clear");
    expect(screen.queryByText(/No live committee findings/)).toBeNull();
  });
});
