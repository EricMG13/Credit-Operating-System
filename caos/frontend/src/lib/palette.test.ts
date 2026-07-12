import { describe, it, expect } from "vitest";
import { staticRows, PALETTE_PAGES } from "./palette";

describe("palette rows", () => {
  it("browse mode (empty query) lists every page in workflow order, no ask row", () => {
    const rows = staticRows("");
    expect(rows).toEqual(PALETTE_PAGES);
    expect(rows.some((r) => r.kind === "ask")).toBe(false);
  });

  it("free text always carries an Ask passthrough row", () => {
    for (const q of ["mo", "which issuers breach 6x leverage", "zzz-no-match"]) {
      const rows = staticRows(q);
      const ask = rows.find((r) => r.kind === "ask");
      expect(ask && ask.kind === "ask" && ask.text).toBe(q);
    }
  });

  it("question-shaped input ranks Ask FIRST (⌘K muscle memory, RT-62)", () => {
    const rows = staticRows("which margins are exposed to energy prices");
    expect(rows[0].kind).toBe("ask");
  });

  it("a strong page match outranks the Ask row", () => {
    const rows = staticRows("mod");
    expect(rows[0]).toMatchObject({ kind: "page", label: "Model" });
    expect(rows.findIndex((r) => r.kind === "ask")).toBeGreaterThan(0);
  });

  it("group names match their pages (workflow vocabulary is searchable)", () => {
    const rows = staticRows("decide");
    const labels = rows.filter((r) => r.kind === "page").map((r) => (r as { label: string }).label);
    expect(labels).toEqual(expect.arrayContaining(["Command", "Deep-Dive", "Model"]));
  });
});
