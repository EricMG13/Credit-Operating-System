"use client";

// Shared text input — the single-line field idiom used across the workspace
// (issuer search & create, issuer Q&A, cross-issuer query, scenario prompt,
// EDGAR search, upload). Consolidates the CAOS field chrome: bg/border/rounded,
// muted placeholder, accent focus border, and the keyboard `.focus-ring`, so
// every field focuses and reads identically. Pass width/padding/size via
// `className` (layout stays the caller's); all native <input> props pass
// through. forwardRef supports autofocus and form refs.

import { forwardRef, type InputHTMLAttributes } from "react";

// Visual identity shared by every field. Layout (width / padding / text size)
// is intentionally NOT here — callers supply it via className so a search box,
// a chat composer, and a form field can size differently without conflicting
// Tailwind classes.
export const INPUT_BASE =
  "bg-caos-bg border border-caos-border rounded text-caos-text placeholder:text-caos-muted " +
  "outline-none focus:border-caos-accent/70 transition-caos focus-ring";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = "", ...props }, ref) {
    return <input ref={ref} className={INPUT_BASE + (className ? " " + className : "")} {...props} />;
  },
);
