import type { ReactNode } from "react";

// Modal scrim — the `fixed inset-0 z-modal` backdrop shared by every centered
// or slide-over modal. Centralizes the backdrop color (rgba(5,5,7,0.72), the
// design system has no token for it) that had drifted to bg-black/60 and
// bg-black/70 in a few call sites. `layout`/`className` cover the two shapes
// in use: centered ("items-center justify-center", optionally "p-6") and
// slide-over ("justify-end").
export function ModalBackdrop({
  onClose,
  layout = "items-center justify-center",
  className = "",
  children,
}: {
  onClose: () => void;
  layout?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 z-modal flex ${layout} ${className}`}
      style={{ background: "rgba(5,5,7,0.72)" }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}
