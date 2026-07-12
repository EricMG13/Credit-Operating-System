"use client";

// Sticky section nav + scroll-spy for Issuer Profile's long single-scroll
// body. Anchors to whatever section ids the page supplies (works for either
// role composition — nothing here assumes PM vs Analyst). Collapses to a
// native <select> under md — cheapest correct mobile affordance, no extra
// library.

import { useEffect, useRef, useState } from "react";

export interface ProfileSection {
  id: string;
  label: string;
}

export function ProfileSectionNav({
  sections,
  scrollRoot,
}: {
  sections: ProfileSection[];
  /** The scrolling container these section ids live inside — IntersectionObserver's root. */
  scrollRoot: HTMLElement | null;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!scrollRoot || sections.length === 0) return;
    // Scroll-spy is progressive enhancement — jump-on-click still works without
    // it. Guard rather than crash in an environment with no IntersectionObserver
    // (older browsers, jsdom in tests).
    if (typeof IntersectionObserver === "undefined") return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Prefer the entry closest to the top of the viewport among those
        // currently intersecting — matches "what am I looking at" better than
        // largest-intersection-ratio when sections vary a lot in height.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActive(visible[0].target.id);
      },
      // Fixed-px rootMargin only — CONFIRMED empirically that a %-based
      // rootMargin (e.g. "-8% 0px -70% 0px") on a non-document scrollable
      // root silently NEVER fires the callback in at least one real Chromium-
      // based engine (not a spec requirement violation flagged anywhere, no
      // console error — the observer just never reports). Reproduced directly:
      // switching to px-only margins on the identical root/targets fixed it
      // immediately. jsdom's test double doesn't reproduce this at all, so
      // this can only be caught by driving a real browser.
      { root: scrollRoot, rootMargin: "-56px 0px -400px 0px", threshold: [0, 0.1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections, scrollRoot]);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  if (sections.length === 0) return null;

  return (
    <>
      <nav
        aria-label="Profile sections"
        className="hidden md:flex items-center gap-1 sticky top-0 z-10 -mx-0.5 px-0.5 py-1 bg-caos-bg/95 backdrop-blur-sm border-b border-caos-border/60 overflow-x-auto"
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                jump(s.id);
              }}
              aria-current={isActive ? "true" : undefined}
              className={
                "no-underline tabular text-caos-2xs uppercase tracking-wider px-2 min-h-8 flex items-center rounded border whitespace-nowrap transition-caos focus-ring caos-target " +
                (isActive
                  ? "border-caos-accent/70 bg-caos-elevated text-caos-accent font-semibold"
                  : "border-transparent text-caos-muted hover:text-caos-text hover:border-caos-border")
              }
            >
              {s.label}
            </a>
          );
        })}
      </nav>
      <select
        aria-label="Jump to profile section"
        className="md:hidden tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border bg-caos-panel text-caos-text sticky top-0 z-10"
        value={active}
        onChange={(e) => jump(e.target.value)}
      >
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </>
  );
}
