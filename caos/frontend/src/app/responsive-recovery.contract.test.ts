import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("narrow recovery controls", () => {
  it("gives the issuer loading label a permitted live-region role", () => {
    expect(source("./issuers/page.tsx")).toContain(
      'role="status" aria-busy="true" aria-label="Loading issuers"',
    );
  });

  it("keeps Model recovery and export actions in the narrow utility drawer", () => {
    const page = source("./model/page.tsx");
    expect(page).toContain("md:hidden caos-action-secondary focus-ring w-full justify-start");
    expect(page).toContain("Retry saved model");
    expect(page).toContain("Reload saved model");
    expect(page).toContain("Export model");
    expect(page).toContain("hidden md:inline-flex");
  });

  it("shortens the Report alert and preserves retry in the narrow utility drawer", () => {
    const page = source("./reports/page.tsx");
    expect(page).toContain('<span className="md:hidden">model unavailable</span>');
    expect(page).toContain("Retry saved model");
    expect(page).toContain("hidden md:inline-flex min-h-6");
  });
});
