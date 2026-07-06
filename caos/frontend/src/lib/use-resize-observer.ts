import { useState, useLayoutEffect, useRef } from "react";

export function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      window.requestAnimationFrame(() => {
        setDimensions({ width, height });
      });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, dimensions] as const;
}
