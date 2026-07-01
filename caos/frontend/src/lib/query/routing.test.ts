import { describe, expect, it } from "vitest";
import { rankQueryCapabilities } from "./routing";
import type { Capability } from "./graph";

const caps: Capability[] = [
  { id: "peer-set", label: "Peer set", mode: "peers", enabled: true, reason: null },
  { id: "analyst-memos", label: "Analyst links / memos", mode: "provenance", enabled: true, reason: null },
  { id: "trace-source", label: "Trace number to source", mode: "provenance", enabled: true, reason: null },
];

describe("query routing", () => {
  it("routes notes and memo language to analyst-memos", () => {
    expect(rankQueryCapabilities("show analyst notes", caps)[0].c.id).toBe("analyst-memos");
    expect(rankQueryCapabilities("memo commentary", caps)[0].c.id).toBe("analyst-memos");
  });
});
