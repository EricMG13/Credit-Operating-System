// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { bindWorkspacePrincipal } from "./api";

describe("workspace principal cache isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/model?issuer=i1&context=foreign-context");
  });

  it("preserves caches for the same analyst", () => {
    localStorage.setItem("caos.principal.id", "a1");
    localStorage.setItem("caos-d-overrides:i1", "draft");
    bindWorkspacePrincipal("a1");
    expect(localStorage.getItem("caos-d-overrides:i1")).toBe("draft");
    expect(window.location.search).toContain("context=foreign-context");
  });

  it("clears decision caches and the foreign context before binding a new analyst", () => {
    localStorage.setItem("caos.principal.id", "a1");
    localStorage.setItem("caos-d-overrides:i1", "draft");
    sessionStorage.setItem("caos-query-history", "question");
    bindWorkspacePrincipal("a2");
    expect(localStorage.getItem("caos-d-overrides:i1")).toBeNull();
    expect(sessionStorage.getItem("caos-query-history")).toBeNull();
    expect(localStorage.getItem("caos.principal.id")).toBe("a2");
    expect(window.location.search).toBe("?issuer=i1");
  });
});
