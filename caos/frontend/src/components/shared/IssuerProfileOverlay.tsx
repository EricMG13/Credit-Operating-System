"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { getIssuers, getIssuerProfile, type IssuerProfile } from "@/lib/api";
import { Profile } from "@/app/issuers/profile/ProfileContent";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { DEMO_UNIVERSE } from "@/lib/issuers";
import type { Issuer } from "@/types/issuers";

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
    setIssuerId(clean);
    setIsOpen(true);
  };

  // Resolve a free-text ticker/name (e.g. a Command Center row that only knows
  // a portfolio code) to an issuer id via search, then open. Falls back to the
  // local DEMO_UNIVERSE sleeve, then to a direct pass-through of the term.
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

    // 2. Client-side fallback to the DEMO_UNIVERSE sleeve
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
    <ModalBackdrop onClose={onClose} className="p-6">
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
          <div className="h-full flex items-center justify-center bg-caos-bg">
            <span className="tabular text-caos-lg text-caos-muted">Loading profile…</span>
          </div>
        ) : error || !data ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 bg-caos-bg text-center p-6">
            <StatusGlyph kind="warning" size={20} />
            <p className="text-caos-2xl text-caos-text font-medium">{error || "No data."}</p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
              >
                CLOSE
              </button>
              {/* Forward path out of a failed load (e.g. a demo-sleeve row whose
                  id is a portfolio code, not a registry id) — Deep-Dive resolves
                  codes, so it works where the profile read-model 404s. */}
              {issuerId ? (
                <Link
                  href={"/deepdive?issuer=" + encodeURIComponent(issuerId)}
                  onClick={onClose}
                  className="no-underline tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
                >
                  OPEN DEEP-DIVE
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <Profile id={issuerId!} data={data} isOverlay={true} onClose={onClose} />
        )}
      </div>
    </ModalBackdrop>
  );
}
