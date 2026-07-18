// Smallest check for the App-Router error/404 surfaces (error.tsx, global-error.tsx,
// not-found.tsx). They carry no logic worth a suite — this just fails if the
// recovery affordance (role=alert + Retry/Back action) or key copy is removed.
// Static server render so global-error's own <html>/<body> renders without a jsdom
// container clash. ponytail: one render assert per surface, no interaction harness.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import RouteError from "./error";
import GlobalError from "./global-error";
import NotFound from "./not-found";
import DeepdiveError from "./deepdive/error";
import ModelError from "./model/error";
import CommandError from "./command/error";
import QueryError from "./query/error";
import ReportsError from "./reports/error";

const noop = () => {};
const err: Error & { digest?: string } = Object.assign(new Error("boom"), { digest: "abc123" });

describe("error surfaces", () => {
  it("per-route error boundary: alert role, retry, digest ref", () => {
    const html = renderToStaticMarkup(<RouteError error={err} reset={noop} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry");
    expect(html).toContain("This view could not load");
    expect(html).toContain("abc123"); // digest surfaced when present
  });

  // M-10: deepdive/model/command/query/reports each got their own error.tsx (the
  // rest of the workspace chrome stays mounted when only one segment errors,
  // instead of every route falling back to the shared root boundary). Byte-
  // identical to the root boundary by design — same one-assert-per-surface check.
  it.each([
    ["deepdive", DeepdiveError],
    ["model", ModelError],
    ["command", CommandError],
    ["query", QueryError],
    ["reports", ReportsError],
  ])("%s/error.tsx: alert role, retry, digest ref", (_name, Component) => {
    const html = renderToStaticMarkup(<Component error={err} reset={noop} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry");
    expect(html).toContain("This view could not load");
    expect(html).toContain("abc123");
  });

  it("root error boundary: own html/body, try again", () => {
    const html = renderToStaticMarkup(<GlobalError error={err} reset={noop} />);
    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).toContain("failed to load");
  });

  it("custom 404: back-to-command-center link to root", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("404");
    expect(html).toContain("View not found");
    expect(html).toContain('href="/"');
  });
});
