import { useEffect, useState } from "react";

export function usePrintPortalElement() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const portal = document.createElement("div");
    portal.className = "print-root";
    document.body.appendChild(portal);
    setElement(portal);
    return () => portal.remove();
  }, []);
  return element;
}
