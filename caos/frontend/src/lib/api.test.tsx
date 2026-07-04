// SEAM3-1 / SEAM3-2 regression: FastAPI 422 validation errors put a LIST of
// {loc, msg, type} objects in `detail` (and structured errors like the
// committee-export 409 put a DICT). The old `detail || e.message` parse fed
// that straight into string state; React then crashed rendering it as a child
// ("Objects are not valid as a React child") and the route error boundary ate
// the page. toErrorMessage is the mandatory parse — this pins that a
// 422-shaped axios error renders as a string.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { toErrorMessage } from "./api";

const err422 = {
  response: {
    status: 422,
    data: {
      detail: [
        { loc: ["body", "figi"], msg: "String should have at most 32 characters", type: "string_too_long" },
        { loc: ["body", "name"], msg: "String should have at least 1 character", type: "string_too_short" },
      ],
    },
  },
};

describe("toErrorMessage", () => {
  it("renders a 422 list detail as a string message, not a React-child crash", () => {
    // the pre-fix parse passed the raw array into JSX — that crashes React
    const raw = err422.response.data.detail as unknown as string;
    expect(() => renderToStaticMarkup(<span>{raw}</span>)).toThrow(/not valid as a React child/);
    // the normalizer yields a plain string that renders fine
    const msg = toErrorMessage(err422, "fallback");
    expect(typeof msg).toBe("string");
    const html = renderToStaticMarkup(<span>{msg}</span>);
    expect(html).toContain("figi: String should have at most 32 characters");
    expect(html).toContain("name: String should have at least 1 character");
  });

  it("reads dict details, string details, axios message, then the fallback", () => {
    // dict shape — the runs.py committee-export 409 pattern ({message, ...})
    expect(
      toErrorMessage({ response: { data: { detail: { message: "Run is not Committee Ready" } } } }, "f"),
    ).toBe("Run is not Committee Ready");
    expect(toErrorMessage({ response: { data: { detail: "plain detail" } } }, "f")).toBe("plain detail");
    expect(toErrorMessage({ message: "Network Error" }, "f")).toBe("Network Error");
    expect(toErrorMessage(undefined, "fallback")).toBe("fallback");
    // dict without a usable .message still degrades to the fallback, never an object
    expect(toErrorMessage({ response: { data: { detail: { code: 7 } } } }, "fallback")).toBe("fallback");
  });
});
