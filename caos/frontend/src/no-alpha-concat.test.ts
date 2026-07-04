// Guards the recurring var+alpha concat defect class (REVIEW_MATRIX_FRONTEND
// 2.1/2.2/5.3/6.5, fixed 3× before it: sev.ts, StatCard, RelativeValueTable):
// concatenating a 2-hex alpha suffix onto a color string is invalid CSS when
// the color is a `var(--…)` and is silently dropped at computed-value time.
// Use `color-mix(in srgb, <color> N%, transparent)` — valid for var AND hex.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
// `<expr> + "55"` / '55' / `55` — a bare two-hex-digit string is only ever an
// alpha suffix in this codebase; anything legit can use a longer literal.
const HEX_PAIR_CONCAT = /\+\s*["'`][0-9a-fA-F]{2}["'`]/;
// Comments legitimately QUOTE the old bug (sev.ts, StatCard) — scan code only.
// Crude strip; a `//` inside a string can eat the rest of that line, which for
// this guard can only under-match, never false-positive.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(p);
  }
  return out;
}

describe("no alpha-suffix color concat", () => {
  it("no source file concatenates a 2-hex alpha onto a color", () => {
    const offenders = walk(SRC)
      .filter((f) => HEX_PAIR_CONCAT.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => f.slice(SRC.length + 1));
    expect(offenders, "use color-mix(in srgb, X N%, transparent), not X + \"NN\"").toEqual([]);
  });
});
