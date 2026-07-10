import type { ReactNode } from "react";

// Canonical dim tint for all z-modal backdrops (matches --caos-bg, not pure black).
const BACKDROP_COLOR = "rgba(5,5,7,0.72)";

export function ModalBackdrop({
  onClose,
  align = "center",
  padded = false,
  className = "",
  children,
}: {
  onClose: () => void;
  align?: "center" | "end";
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "fixed inset-0 z-modal flex " +
        (align === "end" ? "justify-end" : "items-center justify-center") +
        (padded ? " p-6" : "") +
        (className ? " " + className : "")
      }
      style={{ background: BACKDROP_COLOR }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}
