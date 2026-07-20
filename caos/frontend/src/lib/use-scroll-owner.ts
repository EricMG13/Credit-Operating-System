"use client";

import { useCallback, useLayoutEffect, useState } from "react";

export function useScrollOwner<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setElement(node), []);
  const [scrollable, setScrollable] = useState(false);

  useLayoutEffect(() => {
    if (!element) {
      setScrollable(false);
      return;
    }
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
  }, [element]);

  return { ref, scrollable };
}
