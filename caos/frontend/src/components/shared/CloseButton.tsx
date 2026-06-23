// Modal close control (✕) — the bordered-box dismiss button shared by every
// modal/dialog header. Centralizes the a11y (aria-label, focus-ring, type) that
// was hand-repeated across 8 modals. `size`: "sm" (w-5, default) or "md" (w-6).
export function CloseButton({
  onClick,
  label = "Close",
  title,
  size = "sm",
  className = "",
}: {
  onClick: () => void;
  label?: string;
  /** Hover tooltip; omitted when unset (preserves the original per-modal copy). */
  title?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const dims = size === "md" ? "w-6 h-6" : "w-5 h-5 text-caos-md";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`${dims} rounded border border-caos-border flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring ${className}`}
    >
      ✕
    </button>
  );
}
