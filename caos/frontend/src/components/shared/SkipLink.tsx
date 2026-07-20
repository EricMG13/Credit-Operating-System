"use client";

import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

export function SkipLink({ href, onClick, requireTarget = false, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: `#${string}`; requireTarget?: boolean }) {
  const [targetAvailable, setTargetAvailable] = useState(!requireTarget);

  useEffect(() => {
    if (!requireTarget) return;
    const update = () => setTargetAvailable(Boolean(document.getElementById(href.slice(1))));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [href, requireTarget]);

  const focusTarget = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const target = document.getElementById(href.slice(1));
    target?.focus();
  };

  if (!targetAvailable) return null;
  return <a href={href} onClick={focusTarget} {...props} />;
}
