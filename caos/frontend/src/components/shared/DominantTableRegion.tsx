"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export type TableRegionExemption =
  | "document"
  | "model"
  | "report-studio"
  | "accessible-fallback";

export interface DominantTableRegionProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  ownerId: string;
  label: string;
  exemption?: TableRegionExemption;
  children?: ReactNode;
}

interface DominantOwnerRegistry {
  register: (token: symbol, element: HTMLElement) => () => void;
}

const DominantOwnerRegistryContext = createContext<DominantOwnerRegistry | null>(null);

export function DominantTableRegion({
  ownerId,
  label,
  exemption,
  children,
  className = "",
  ...htmlProps
}: DominantTableRegionProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(Symbol(ownerId));
  const registry = useContext(DominantOwnerRegistryContext);

  useEffect(() => {
    const element = elementRef.current;
    if (!registry || !element || exemption) return;
    return registry.register(tokenRef.current, element);
  }, [exemption, ownerId, registry]);

  return (
    <div
      ref={elementRef}
      {...htmlProps}
      role="region"
      aria-label={label}
      data-caos-dominant-table-owner={exemption ? undefined : ownerId}
      data-caos-table-exemption={exemption}
      data-caos-table-region-id={ownerId}
      className={`caos-dominant-table-region ${className}`}
    >
      {children}
    </div>
  );
}

function isInvariantVisible(element: HTMLElement, boundary?: HTMLElement) {
  if (!element.isConnected) return false;
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.hidden
      || current.getAttribute("aria-hidden") === "true"
      || current.style.display === "none"
      || current.style.visibility === "hidden"
    ) return false;
    const computed = window.getComputedStyle(current);
    if (computed.display === "none" || computed.visibility === "hidden") return false;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return true;
}

function duplicateOwnerMessage(owners: readonly HTMLElement[]) {
  if (owners.length <= 1) return null;
  const ids = owners.map((owner) => owner.dataset.caosDominantTableOwner).join(", ");
  return `PersonaWorkbench permits one visible dominant table owner; found ${owners.length}: ${ids}.`;
}

export function assertSingleDominantTableOwner(workbench: HTMLElement) {
  const owners = Array.from(
    workbench.querySelectorAll<HTMLElement>("[data-caos-dominant-table-owner]"),
  ).filter((owner) => isInvariantVisible(owner, workbench));
  const violation = duplicateOwnerMessage(owners);
  if (violation) throw new Error(violation);
}

function DevelopmentDominantOwnerGuard({ children }: { children: ReactNode }) {
  const ownersRef = useRef(new Map<symbol, HTMLElement>());
  const mountedRef = useRef(false);
  const scheduledRef = useRef(false);
  const [violation, setViolation] = useState<string | null>(null);

  const validate = useCallback(() => {
    const visibleOwners = Array.from(ownersRef.current.values()).filter((owner) => (
      isInvariantVisible(owner)
    ));
    const nextViolation = duplicateOwnerMessage(visibleOwners);
    setViolation((current) => current === nextViolation ? current : nextViolation);
  }, []);

  const scheduleValidation = useCallback(() => {
    if (scheduledRef.current) return;
    scheduledRef.current = true;
    queueMicrotask(() => {
      scheduledRef.current = false;
      if (mountedRef.current) validate();
    });
  }, [validate]);

  const registry = useMemo<DominantOwnerRegistry>(() => ({
    register(token, element) {
      ownersRef.current.set(token, element);
      scheduleValidation();
      return () => {
        ownersRef.current.delete(token);
        scheduleValidation();
      };
    },
  }), [scheduleValidation]);

  useEffect(() => {
    mountedRef.current = true;
    const observer = new MutationObserver(scheduleValidation);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "style", "class"],
    });
    scheduleValidation();
    return () => {
      mountedRef.current = false;
      observer.disconnect();
    };
  }, [scheduleValidation]);

  if (violation) throw new Error(violation);

  return (
    <DominantOwnerRegistryContext.Provider value={registry}>
      {children}
    </DominantOwnerRegistryContext.Provider>
  );
}

export function DominantTableOwnerGuard({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") return children;
  return <DevelopmentDominantOwnerGuard>{children}</DevelopmentDominantOwnerGuard>;
}
