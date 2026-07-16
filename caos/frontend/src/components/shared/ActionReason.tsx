"use client";

// The desk convention for "this action exists but can't fire yet": the control
// stays focusable (aria-disabled, never the native disabled attribute), the
// click is guarded, and the *why* is announced three ways — title for pointer
// hover, aria-describedby for assistive tech, and (by default) a visible
// adjacent reason line for sighted keyboard/touch users, who a title alone
// never reaches. The reason text must never enter the button's accessible
// name: name-based queries and muscle memory both depend on the label staying
// stable whether or not the action is currently available.

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

interface ActionReasonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "title" | "aria-disabled" | "aria-describedby"> {
  /** Non-empty → the action is inert and this explains why. Null/undefined → live. */
  reason?: string | null;
  /** "inline" renders the visible reason line; "hidden" keeps it sr-only for
   * tight toolbars where title + screen-reader coverage must suffice. */
  reasonDisplay?: "inline" | "hidden";
  onClick?: () => void;
  children: ReactNode;
}

export function ActionReason({
  reason,
  reasonDisplay = "inline",
  onClick,
  children,
  type = "button",
  ...rest
}: ActionReasonProps) {
  const reasonId = useId();
  const inert = Boolean(reason);
  // A guarded click must never look ignored: in the "hidden" variant the
  // reason surfaces inline for a few seconds after the attempt (and announces
  // via role=status), instead of the click silently doing nothing.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  useEffect(() => () => { if (flashTimer.current !== null) window.clearTimeout(flashTimer.current); }, []);
  const showInline = reasonDisplay === "inline" || flash;
  return (
    <>
      <button
        type={type}
        aria-disabled={inert || undefined}
        title={inert ? reason ?? undefined : undefined}
        aria-describedby={inert ? reasonId : undefined}
        onClick={() => {
          if (!inert) {
            onClick?.();
            return;
          }
          if (reasonDisplay === "hidden") {
            setFlash(true);
            if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
            flashTimer.current = window.setTimeout(() => setFlash(false), 4000);
          }
        }}
        {...rest}
      >
        {children}
      </button>
      {inert ? (
        <span id={reasonId} role={flash ? "status" : undefined} className={showInline ? "caos-action-reason" : "sr-only"}>
          {reason}
        </span>
      ) : null}
    </>
  );
}
