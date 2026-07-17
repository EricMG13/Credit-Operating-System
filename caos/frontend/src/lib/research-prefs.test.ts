// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CRITERIA, DEFAULT_PREFS, hasStoredPrefs, loadPrefs, savePrefs } from "./research-prefs";

const KEY = "caos.research.prefs";

afterEach(() => {
  localStorage.clear();
});

describe("research prefs", () => {
  it("defaults when nothing is stored", () => {
    expect(hasStoredPrefs()).toBe(false);
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("round-trips a valid saved value", () => {
    const p = {
      ai_mode: "max" as const,
      mode: "issuer" as const,
      audience: "IC",
      decision: "hold vs add",
      timeframe: "12mo",
      criteria: "custom criteria",
    };
    savePrefs(p);
    expect(hasStoredPrefs()).toBe(true);
    expect(loadPrefs()).toEqual(p);
  });

  it("falls back to defaults on malformed JSON without throwing", () => {
    localStorage.setItem(KEY, "{not valid json");
    expect(() => loadPrefs()).not.toThrow();
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("replaces wrong-typed fields with their default instead of passing them through", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ai_mode: "turbo", // not a valid AiMode
        mode: "sell", // not a valid mode
        audience: 42, // wrong type
        decision: false, // wrong type
        timeframe: { years: 1 }, // wrong type
        criteria: ["a", "b"], // wrong type
      }),
    );
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("keeps well-typed fields and only replaces the wrong-typed ones", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ai_mode: "lite",
        mode: "issuer",
        audience: "PM", // valid, should survive
        decision: 12345, // invalid, should fall back
        timeframe: "6mo", // valid, should survive
        criteria: null, // invalid, should fall back
      }),
    );
    expect(loadPrefs()).toEqual({
      ai_mode: "lite",
      mode: "issuer",
      audience: "PM",
      decision: DEFAULT_PREFS.decision,
      timeframe: "6mo",
      criteria: DEFAULT_CRITERIA,
    });
  });

  it("treats a non-object parsed value as empty rather than crashing", () => {
    localStorage.setItem(KEY, JSON.stringify("just a string"));
    expect(() => loadPrefs()).not.toThrow();
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);

    localStorage.setItem(KEY, JSON.stringify(null));
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);

    localStorage.setItem(KEY, JSON.stringify([1, 2, 3]));
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });
});
