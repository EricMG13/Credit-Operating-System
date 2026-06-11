import { describe, it, expect } from "vitest";
import { parseCitations } from "./citations";

describe("parseCitations — happy path", () => {
  it("splits text around a single citation", () => {
    expect(parseCitations("leverage is 5.7x [[cite:0]] today")).toEqual([
      { type: "text", value: "leverage is 5.7x " },
      { type: "cite", index: 0, raw: "[[cite:0]]" },
      { type: "text", value: " today" },
    ]);
  });

  it("handles multiple citations and multi-digit indices", () => {
    const segs = parseCitations("a [[cite:1]] b [[cite:12]]");
    expect(segs.filter((s) => s.type === "cite")).toEqual([
      { type: "cite", index: 1, raw: "[[cite:1]]" },
      { type: "cite", index: 12, raw: "[[cite:12]]" },
    ]);
  });

  it("returns a single text segment when there are no citations", () => {
    expect(parseCitations("plain prose, no markers")).toEqual([
      { type: "text", value: "plain prose, no markers" },
    ]);
  });

  it("keeps an out-of-range index as a cite segment (caller resolves)", () => {
    expect(parseCitations("[[cite:99]]")).toEqual([
      { type: "cite", index: 99, raw: "[[cite:99]]" },
    ]);
  });
});

describe("parseCitations — malformed / hostile input never throws (Blueprint §7.1)", () => {
  const malformed: [string, unknown][] = [
    ["empty marker (no digits)", "see [[cite:]] here"],
    ["unterminated marker", "see [[cite:0 here"],
    ["only opening brackets", "[[cite:"],
    ["only closing brackets", "0]]"],
    ["non-numeric index", "[[cite:abc]]"],
    ["negative index", "[[cite:-1]]"],
    ["spaces inside", "[[cite: 0 ]]"],
    ["nested brackets", "[[cite:[[cite:0]]]]"],
    ["unicode payload", "valeur ✓ [[cite:０]] 你好"],
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["empty string", ""],
    ["html-ish injection", "<script>[[cite:0]]</script>"],
  ];

  it.each(malformed)("does not throw on %s", (_label, input) => {
    expect(() => parseCitations(input)).not.toThrow();
    const out = parseCitations(input);
    expect(Array.isArray(out)).toBe(true);
  });

  it("leaves an empty marker as inert text (no cite segment)", () => {
    const out = parseCitations("see [[cite:]] here");
    expect(out.some((s) => s.type === "cite")).toBe(false);
    expect(out.map((s) => (s.type === "text" ? s.value : "")).join("")).toBe("see [[cite:]] here");
  });

  it("extracts the inner marker from nested brackets, leaving the rest inert", () => {
    const out = parseCitations("[[cite:[[cite:0]]]]");
    expect(out.filter((s) => s.type === "cite")).toEqual([
      { type: "cite", index: 0, raw: "[[cite:0]]" },
    ]);
    // surrounding fragments survive as text, so the UI degrades gracefully
    expect(out.some((s) => s.type === "text")).toBe(true);
  });

  it("reconstructs the original text from all segments (lossless)", () => {
    const samples = ["a [[cite:0]] b [[cite:2]] c", "no markers", "[[cite: ]] edge", "✓ [[cite:3]]"];
    for (const s of samples) {
      const joined = parseCitations(s)
        .map((seg) => (seg.type === "text" ? seg.value : seg.raw))
        .join("");
      expect(joined).toBe(s);
    }
  });

  it("returns [] for empty / non-string input", () => {
    expect(parseCitations("")).toEqual([]);
    expect(parseCitations(null)).toEqual([]);
    expect(parseCitations(undefined)).toEqual([]);
    expect(parseCitations(123)).toEqual([]);
  });
});
