// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: () => {
      let ignored: unknown;
      return {
        get current() { return null; },
        set current(value: unknown) { ignored = value; },
        get ignored() { return ignored; },
      };
    },
  };
});

vi.mock("@antv/g2", () => ({ Chart: class {} }));

import { G2Chart } from "./G2Chart";

afterEach(cleanup);

it("does not start chart work when React has not attached the container ref", () => {
  const view = render(<G2Chart spec={{ type: "interval", data: [] }} />);
  expect(view.container.firstElementChild?.childElementCount).toBe(0);
});
