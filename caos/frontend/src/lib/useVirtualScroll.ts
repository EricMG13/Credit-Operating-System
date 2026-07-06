import { useState, useEffect, type RefObject } from "react";

export function useVirtualScroll({
  itemCount,
  estimateHeight = 32,
  overscan = 10,
  containerRef,
}: {
  itemCount: number;
  estimateHeight?: number;
  overscan?: number;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const handleResize = () => {
      setContainerHeight(el.clientHeight);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(el);
    } else {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, [containerRef]);

  const startIndex = Math.max(0, Math.floor(scrollTop / estimateHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.floor((scrollTop + containerHeight) / estimateHeight) + overscan
  );

  const paddingTop = startIndex * estimateHeight;
  const paddingBottom = Math.max(0, (itemCount - 1 - endIndex) * estimateHeight);
  const totalHeight = itemCount * estimateHeight;

  return {
    startIndex,
    endIndex,
    paddingTop,
    paddingBottom,
    totalHeight,
  };
}
