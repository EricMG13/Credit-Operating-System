"use client";

// The page-level action primitive (Blueprint action grammar, 2 tiers —
// globals.css ".caos-action-primary/secondary"). Wraps ActionReason so every
// call site gets the disabled-with-reason contract by construction: native
// `disabled` is not an accepted prop, so a Button can never go inert without
// a reason that stays keyboard/pointer/screen-reader discoverable.
//
// This does not cover in-row micro-actions (Ack, Open →, per-table styled —
// deliberately a separate tier, see the globals.css comment above
// .caos-action-primary) or icon-only/close controls with their own contract.

import { ActionReason } from "@/components/shared/ActionReason";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "title" | "aria-disabled" | "aria-describedby" | "disabled"> {
  variant?: ButtonVariant;
  /** Non-empty → the action is inert and this explains why. Null/undefined → live. */
  reason?: string | null;
  reasonDisplay?: "inline" | "hidden";
  onClick?: () => void;
  children: ReactNode;
}

export function Button({ variant = "secondary", reason, reasonDisplay, className = "", children, ...rest }: ButtonProps) {
  const variantClass = variant === "primary" ? "caos-action-primary" : "caos-action-secondary";
  return (
    <ActionReason
      reason={reason}
      reasonDisplay={reasonDisplay}
      className={`${variantClass} focus-ring${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </ActionReason>
  );
}
