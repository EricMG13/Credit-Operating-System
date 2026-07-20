"use client";

import { useCallback, useId, useLayoutEffect, useState } from "react";

const usePanelBody = (collapsed: boolean) => {
  const [bodyElement, setBodyElement] = useState<HTMLDivElement | null>(null);
  const bodyRef = useCallback((element: HTMLDivElement | null) => setBodyElement(element), []);
  const [scrollable, setScrollable] = useState(false);
  useLayoutEffect(() => {
    const element = bodyElement;
    if (!element) { setScrollable(false); return; }
    const measure = () => setScrollable(
      element.scrollHeight > element.clientHeight + 1
      || element.scrollWidth > element.clientWidth + 1,
    );
    measure();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(element);
    for (const child of element.children) resizeObserver?.observe(child);
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) resizeObserver?.observe(node);
        }
      }
      measure();
    });
    mutationObserver?.observe(element, { subtree: true, childList: true, characterData: true });
    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [bodyElement, collapsed]);
  return { bodyRef, scrollable };
};

function PanelHeading({
  Heading,
  title,
  collapsible,
  collapsed,
  bodyId,
  onToggle,
}: {
  Heading: "h2" | "h3";
  title: string;
  collapsible: boolean;
  collapsed: boolean;
  bodyId: string;
  onToggle: () => void;
}) {
  return (
    <Heading className="caos-panel-title m-0 min-w-0 flex-1 tabular font-semibold text-caos-text">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className="-ml-1 flex h-7 w-full min-w-0 items-center gap-1 rounded px-1 text-left transition-caos hover:bg-caos-elevated/50 focus-ring"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? `Expand ${title} panel` : `Collapse ${title} panel`}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 stroke-current text-caos-muted" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? "m4 6 4 4 4-4" : "m4 10 4-4 4 4"} />
          </svg>
          <span className="truncate">{title}</span>
        </button>
      ) : title}
    </Heading>
  );
}

function PanelBody({
  collapsed,
  bodyId,
  bodyRef,
  scrollable,
  title,
  children,
}: {
  collapsed: boolean;
  bodyId: string;
  bodyRef: (element: HTMLDivElement | null) => void;
  scrollable: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (collapsed) return null;
  return (
    <div
      id={bodyId}
      ref={bodyRef}
      tabIndex={scrollable ? 0 : undefined}
      aria-label={scrollable ? title : undefined}
      className={"flex-1 min-h-0 overflow-auto" + (scrollable ? " focus-ring" : "")}
    >
      {children}
    </div>
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
  as: Heading = "h2",
  collapsible = false,
  defaultCollapsed = false,
  onCollapse,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onCollapse?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyId = useId();
  const { bodyRef, scrollable } = usePanelBody(collapsed);
  const toggleLocal = () => setCollapsed((current) => !current);
  const toggle = onCollapse ?? toggleLocal;
  // Only a body that actually clips needs to be a keyboard-focusable scroll
  // region — measure real overflow so a panel whose content fits isn't an inert
  // tab stop (a dense page had ~9 of them before every real action).

  return (
    <div
      className={"bg-caos-panel border border-caos-border rounded-md flex flex-col min-h-0 " + className}
      style={collapsed ? { flex: "none", height: "auto" } : undefined}
    >
      <div className={`caos-panel-header min-h-8 shrink-0 px-3 flex flex-wrap items-center gap-2 bg-caos-elevated/20 ${collapsed ? "" : "border-b border-caos-border"}`}>
        <PanelHeading Heading={Heading} title={title} collapsible={collapsible} collapsed={collapsed} bodyId={bodyId} onToggle={toggle} />
        {right ? <div className="caos-panel-actions min-w-0">{right}</div> : null}
      </div>
      {/* Body is keyboard-focusable ONLY when it actually clips, so a scrollable
          panel can be reached without a mouse (WCAG 2.1.1; axe
          scrollable-region-focusable) while a fitting one stays out of the tab
          order. Labeled by the panel title so the focused region is announced. */}
      <PanelBody collapsed={collapsed} bodyId={bodyId} bodyRef={bodyRef} scrollable={scrollable} title={title}>{children}</PanelBody>
    </div>
  );
}
