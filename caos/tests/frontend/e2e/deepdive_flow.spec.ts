/**
 * Playwright E2E: The Analytical Deep-Dive — evidence-sync walk (journey 2).
 *
 * Route: /deepdive (bare = the ATLF reference deal, seeded showcase). The page
 * opens on the CP-6A adversarial-debate tab, which renders the E-xx citation
 * chips inline in the debate rounds and the IC-Chair weighting matrix.
 *
 * Covers:
 *  (1) SMOKE          — the three-pane shell renders and the reference deal
 *                       identity (ATLF · 2L TL '31) shows.
 *  (2) EVIDENCE-SYNC  — [gap E2E-2a] hovering an E-xx chip cross-highlights
 *                       every sibling chip citing the SAME id (accent ring via
 *                       boxShadow); a different-id chip does not light up.
 *  (3) KEYBOARD       — [gap E2E-2b] focusing a chip via .focus() (EvChip wires
 *                       onFocus) fires the same cross-pane highlight.
 *
 * Runs against the single-process QA server (FastAPI serving /api + the Next
 * static export same-origin). Auth is handled once in global-setup
 * (storageState); pages render already signed-in — no per-test login.
 *
 * EvChip contract (components/reports/EvidenceModal.tsx:26): a role=button
 * labelled "Open source for E-xx" that on hover/focus publishes its id to the
 * EvidenceSync store; every chip with that active id renders
 * boxShadow "0 0 0 1px var(--caos-accent)". Mirrors the unit contract in
 * src/lib/evidence-sync.test.tsx, proven end-to-end across panes here.
 */

import { test, expect, type Locator } from "@playwright/test";

const ACCENT_RING = "var(--caos-accent)";

// Inline boxShadow the chip sets when its id is the active evidence selection.
const boxShadow = (chip: Locator) =>
  chip.evaluate((el) => (el as HTMLElement).style.boxShadow);

test.describe("Deep-Dive · evidence-sync (journey 2)", () => {
  // (1) SMOKE — three-pane shell + reference deal identity.
  test("renders the three-pane shell for the ATLF reference deal", async ({ page }) => {
    await page.goto("/deepdive/");

    // Sub-header carries the reference deal label (DEAL.deal). Its presence is
    // the earliest stable signal the page shell has mounted.
    await expect(page.getByText(/2L TL '31/).first()).toBeVisible({ timeout: 15000 });

    // Reference deal identity (DEAL.code). The source rail is collapsed by
    // default and renders the code vertically; it also appears in the header
    // chip — at least one instance is on screen.
    await expect(page.getByText("ATLF").first()).toBeVisible({ timeout: 15000 });

    // LEFT pane — source / evidence rail (collapsed shell still present).
    await expect(
      page.getByRole("button", { name: /Expand source rail/i }),
    ).toBeVisible();

    // CENTER pane — the module launcher strip (module outputs) and the open
    // CP-6A analysis surface. The IC-Chair weighting matrix header is stable
    // seeded text unique to the debate tab.
    await expect(page.getByText(/Evidence Weighting & Resolution Matrix/i)).toBeVisible({
      timeout: 15000,
    });

    // RIGHT pane — the IC decision rail is collapsed at this width to protect
    // the dominant analysis canvas. Expanding it restores the full verdict.
    await page.getByRole("button", { name: /Expand decision rail/i }).click();
    await expect(page.getByText(/Recommendation bias/i)).toBeVisible({ timeout: 15000 });
  });

  // (2) EVIDENCE-SYNC [E2E-2a] — hover cross-highlight across same-id chips.
  test("hovering an evidence chip cross-highlights every sibling citing the same id", async ({
    page,
  }) => {
    await page.goto("/deepdive/");

    // E-44 is cited by multiple debate points + the weighting matrix, so there
    // are several chips sharing that id — enough to prove cross-pane sync. E-09
    // is a distinct citation used as the negative control.
    const e44 = page.getByRole("button", { name: "Open source for E-44" });
    const e09 = page.getByRole("button", { name: "Open source for E-09" });

    // Wait for the debate tab (which renders the chips) to hydrate.
    await expect(e44.first()).toBeVisible({ timeout: 15000 });
    expect(await e44.count()).toBeGreaterThanOrEqual(2);
    expect(await e09.count()).toBeGreaterThanOrEqual(1);

    const hovered = e44.nth(0); // the chip we hover
    const sibling = e44.nth(1); // a DIFFERENT chip citing the same id
    const other = e09.nth(0); // a chip citing a DIFFERENT id (control)

    // Nothing is synced before any hover.
    expect(await boxShadow(sibling)).toBe("");
    expect(await boxShadow(other)).toBe("");

    // Hover one E-44 chip → the sibling E-44 chip gains the accent ring…
    await hovered.hover();
    await expect
      .poll(() => boxShadow(sibling), { timeout: 5000 })
      .toContain(ACCENT_RING);
    // …and the hovered chip itself is ringed…
    expect(await boxShadow(hovered)).toContain(ACCENT_RING);
    // …while the different-id (E-09) chip stays unlit.
    expect(await boxShadow(other)).toBe("");

    // Moving the pointer away clears the whole selection (onMouseLeave).
    await page.mouse.move(0, 0);
    await expect.poll(() => boxShadow(sibling), { timeout: 5000 }).toBe("");
    expect(await boxShadow(hovered)).toBe("");
  });

  // (3) KEYBOARD [E2E-2b] — focus fires the same cross-pane highlight.
  test("focusing an evidence chip by keyboard fires the same cross-highlight", async ({
    page,
  }) => {
    await page.goto("/deepdive/");

    const e44 = page.getByRole("button", { name: "Open source for E-44" });
    const e09 = page.getByRole("button", { name: "Open source for E-09" });

    await expect(e44.first()).toBeVisible({ timeout: 15000 });
    expect(await e44.count()).toBeGreaterThanOrEqual(2);

    const focused = e44.nth(0);
    const sibling = e44.nth(1);
    const other = e09.nth(0);

    // Ensure a clean, un-synced baseline (no lingering pointer hover).
    await page.mouse.move(0, 0);
    await expect.poll(() => boxShadow(sibling), { timeout: 5000 }).toBe("");

    // Keyboard focus lands on the chip and its onFocus publishes the id — the
    // sibling citing the same id must gain the accent ring, proving the sync is
    // keyboard-operable (not hover-only). Focus goes through the accessibility
    // path (role=button, focusable), same as a Tab landing.
    await focused.focus();
    await expect(focused).toBeFocused();

    await expect
      .poll(() => boxShadow(sibling), { timeout: 5000 })
      .toContain(ACCENT_RING);
    expect(await boxShadow(focused)).toContain(ACCENT_RING);
    // The unrelated E-09 chip is not highlighted by an E-44 focus.
    expect(await boxShadow(other)).toBe("");

    // Blurring (focus elsewhere) clears the selection (onBlur → setActive(null)).
    await focused.blur();
    await expect.poll(() => boxShadow(sibling), { timeout: 5000 }).toBe("");
  });
});
