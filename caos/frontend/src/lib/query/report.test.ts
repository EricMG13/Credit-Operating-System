import { describe, expect, it } from "vitest";
import { addSection, removeSection, sectionId, type ReportSection } from "./report";

const mk = (id: string, title = "t"): ReportSection => ({
  id, kind: "answer", title, body: "b", sources: [], ai: true, addedAt: 1,
});

describe("report", () => {
  it("stable section id is kind + slug", () => {
    expect(sectionId("answer", "Which names have the highest leverage?"))
      .toBe("answer:which names have the highest leverage?");
    expect(sectionId("link", "Acme  ⇢  Beta")).toBe("link:acme ⇢ beta");
  });

  it("addSection appends new and dedupes by id (refresh in place)", () => {
    let list: ReportSection[] = [];
    list = addSection(list, mk("answer:a"));
    list = addSection(list, mk("insight:b"));
    expect(list.map((s) => s.id)).toEqual(["answer:a", "insight:b"]);
    // Re-adding the same id refreshes rather than duplicating, and moves it last.
    list = addSection(list, { ...mk("answer:a"), body: "updated" });
    expect(list.map((s) => s.id)).toEqual(["insight:b", "answer:a"]);
    expect(list.find((s) => s.id === "answer:a")?.body).toBe("updated");
  });

  it("removeSection drops by id", () => {
    const list = [mk("answer:a"), mk("insight:b")];
    expect(removeSection(list, "answer:a").map((s) => s.id)).toEqual(["insight:b"]);
    expect(removeSection(list, "nope")).toHaveLength(2);
  });
});
