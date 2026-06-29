// Modal close control (✕) — the bordered-box dismiss button shared by every
// modal/dialog header. Centralizes the a11y (aria-label, focus-ring, type) that
// was hand-repeated across 8 modals. `size`: "sm" (w-6, default) or "md" (w-7).
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
  const dims = size === "md" ? "w-7 h-7 text-caos-xl" : "w-6 h-6 text-caos-lg";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`${dims} rounded border border-caos-border flex items-center justify-center font-bold leading-none text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring ${className}`}
    >
      ✕
    </button>
  );
}
