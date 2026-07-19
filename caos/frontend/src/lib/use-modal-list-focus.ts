import { useEffect, useRef } from "react";

export function useModalListFocus(active: number, rowIdPrefix: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    document.getElementById(`${rowIdPrefix}${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, rowIdPrefix]);
  return inputRef;
}
