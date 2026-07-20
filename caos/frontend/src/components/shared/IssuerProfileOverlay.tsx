"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getIssuers, getIssuerProfile, type IssuerProfile } from "@/lib/api";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import type { Issuer } from "@/types/issuers";

const Profile = dynamic(
  () => import("@/app/issuers/profile/ProfileContent").then((module) => module.Profile),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-caos-bg p-6">
        <SurfaceState kind="loading" title="Loading profile view" detail="Preparing the issuer evidence workspace." className="w-full max-w-md" />
      </div>
    ),
  },
);

interface IssuerProfileOverlayContextType {
  /** Open directly by issuer id — the common path (callers holding an Issuer). */
  openProfile: (id: string) => void;
  /** Resolve a free-text ticker/name to an id, then open (Command Center rows). */
  openProfileByQuery: (query: string) => void;
  closeProfile: () => void;
  isOpen: boolean;
  issuerId: string | null;
}

const IssuerProfileOverlayContext = createContext<IssuerProfileOverlayContextType>({
  openProfile: () => {},
  openProfileByQuery: () => {},
  closeProfile: () => {},
  isOpen: false,
  issuerId: null,
});

export const useIssuerProfileOverlay = () => useContext(IssuerProfileOverlayContext);

export function IssuerProfileOverlayProvider({ children }: { children: ReactNode }) {
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Open by issuer id. This is the source-of-truth path: the overlay fetches
  // GET /issuers/{id}/profile, and a bad id surfaces as "Issuer not found".
  // No search round-trip — getIssuers matches name/ticker/etc but NOT id, so
  // searching an id would always miss (and could open the wrong issuer if a
  // uuid fragment ever substring-hit a name/FIGI).
  const openProfile = (id: string) => {
    const clean = id.trim();
    if (!clean) return;
    window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "issuer-profile" } }));
    setIssuerId(clean);
    setIsOpen(true);
  };

  useEffect(() => {
    const onModalOpen = (event: Event) => {
      if ((event as CustomEvent<{ owner?: string }>).detail?.owner !== "issuer-profile") {
        setIsOpen(false);
        setIssuerId(null);
      }
    };
    window.addEventListener("caos:modal-open", onModalOpen);
    return () => window.removeEventListener("caos:modal-open", onModalOpen);
  }, []);

  // Resolve a free-text ticker/name (e.g. a Command Center row that only knows
  // a portfolio code) to an issuer id via search, then open. Falls back to the
  // lazily-loaded demo sleeve, then to a direct pass-through of the term.
  const openProfileByQuery = async (query: string) => {
    const term = query.trim();
    if (!term) return;

    // 1. Try to resolve via the server API
    try {
      const results = await getIssuers(term);
      if (results && results.length > 0) {
        // Look for an exact match by ID, Ticker, or Name
        const exact = results.find(
          (i: Issuer) =>
            i.id === term ||
            i.ticker?.toLowerCase() === term.toLowerCase() ||
            i.name.toLowerCase() === term.toLowerCase()
        );
        openProfile((exact || results[0]).id);
        return;
      }
    } catch (err) {
      console.error("Issuer lookup failed, falling back to local sleeve", err);
    }

    // 2. Client-side fallback to the demo sleeve. Load the large portfolio seed
    // only on this uncommon API-miss path, never in the root layout bundle.
    const { DEMO_UNIVERSE } = await import("@/lib/issuer-demo");
    const cleanQ = term.toLowerCase();
    const demoMatch = DEMO_UNIVERSE.find(
      (i) =>
        i.id.toLowerCase() === cleanQ ||
        i.ticker?.toLowerCase() === cleanQ ||
        i.name.toLowerCase() === cleanQ
    ) || DEMO_UNIVERSE.find(
      (i) =>
        i.name.toLowerCase().includes(cleanQ) ||
        (i.ticker && i.ticker.toLowerCase().includes(cleanQ))
    );

    // 3. Direct pass-through of the term if nothing matches
    openProfile(demoMatch ? demoMatch.id : term);
  };

  const closeProfile = () => {
    setIsOpen(false);
    setIssuerId(null);
  };

  return (
    <IssuerProfileOverlayContext.Provider value={{ openProfile, openProfileByQuery, closeProfile, isOpen, issuerId }}>
      {children}
    </IssuerProfileOverlayContext.Provider>
  );
}

export function IssuerProfileOverlay() {
  const { isOpen, issuerId, closeProfile } = useIssuerProfileOverlay();
  const [data, setData] = useState<IssuerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !issuerId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let stale = false;
    setLoading(true);
    setError(null);

    getIssuerProfile(issuerId)
      .then((profileData) => {
        if (!stale) {
          setData(profileData);
        }
      })
      .catch((err) => {
        if (!stale) {
          const detail = (err as { response?: { status?: number; data?: { detail?: string } } })?.response;
          setError(
            detail?.status === 404
              ? "Issuer not found."
              : detail?.data?.detail || "Couldn't load this profile."
          );
        }
      })
      .finally(() => {
        if (!stale) {
          setLoading(false);
        }
      });

    return () => {
      stale = true;
    };
  }, [isOpen, issuerId]);

  // The modal body — and its useModalA11y — live in a child that mounts only
  // while open. Calling the hook on this always-mounted component would engage
  // the body scroll-lock the entire time the overlay sits closed.
  if (!isOpen) return null;

  return (
    <IssuerProfileModal issuerId={issuerId} data={data} loading={loading} error={error} onClose={closeProfile} />
  );
}

function IssuerProfileModal({ issuerId, data, loading, error, onClose }: {
  issuerId: string | null;
  data: IssuerProfile | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <ModalBackdrop onClose={onClose} padded>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Issuer Profile Overlay"
        onClick={(e) => {
          e.stopPropagation();
          // This modal mounts in the root layout, ABOVE the router — a <Link>
          // inside it swaps the route underneath without unmounting the overlay,
          // stranding a scroll-locked focus trap over the new page. Delegated
          // close: a plain left-click on a same-origin link closes; modified
          // clicks (new tab/window) and external/protocol links ("OPEN IN
          // VAULT" obsidian://) don't navigate this page, so the overlay stays.
          const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
          if (a && a.origin === window.location.origin &&
              !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onClose();
        }}
        className="caos-enter bg-caos-panel border border-caos-border rounded-md w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden relative"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center bg-caos-bg p-6">
            <SurfaceState kind="loading" title="Loading issuer profile" detail="Retrieving the current house view, run history, and evidence health." className="w-full max-w-md" />
          </div>
        ) : error || !data ? (
          <div className="h-full flex items-center justify-center bg-caos-bg p-6">
            <SurfaceState
              kind="error"
              title={error || "Issuer profile unavailable"}
              detail="The overlay could not establish a current profile. No conclusion was drawn from the missing response."
              className="w-full max-w-md"
              primaryAction={issuerId ? (
                <Link href={"/deepdive?issuer=" + encodeURIComponent(issuerId)} onClick={onClose} className="caos-action-primary no-underline focus-ring">Open Deep-Dive</Link>
              ) : undefined}
              secondaryAction={<button type="button" onClick={onClose} className="caos-action-secondary focus-ring">Close</button>}
            />
          </div>
        ) : (
          <Profile id={issuerId!} data={data} isOverlay={true} onClose={onClose} />
        )}
      </div>
    </ModalBackdrop>
  );
}
