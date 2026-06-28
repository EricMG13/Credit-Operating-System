"use client";

export function CollapseButton({
  direction,
  label,
  onClick,
  className = "",
}: {
  direction: "left" | "right";
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "w-6 h-6 rounded flex items-center justify-center text-caos-muted hover:text-caos-text hover:bg-caos-elevated transition-caos focus-ring " +
        className
      }
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="w-4 h-4 stroke-current" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={direction === "left" ? "M10.5 3.5 6 8l4.5 4.5" : "M5.5 3.5 10 8l-4.5 4.5"} />
      </svg>
    </button>
  );
}
