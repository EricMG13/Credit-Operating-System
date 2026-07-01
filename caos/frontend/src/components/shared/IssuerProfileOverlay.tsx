"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getIssuers, getIssuerProfile, type IssuerProfile } from "@/lib/api";
import { Profile } from "@/app/issuers/profile/ProfileContent";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { PORTFOLIO } from "@/lib/command/data";
import type { Issuer } from "@/types/issuers";

const DEMO_UNIVERSE: Issuer[] = PORTFOLIO.map((p) => ({
  id: p.code,
  name: p.name,
  ticker: p.code,
  sector: p.sector,
  industry: p.sector,
  country: "United States",
}));

interface IssuerProfileOverlayContextType {
  openProfile: (idOrQuery: string) => void;
  closeProfile: () => void;
  isOpen: boolean;
  issuerId: string | null;
}

const IssuerProfileOverlayContext = createContext<IssuerProfileOverlayContextType>({
  openProfile: () => {},
  closeProfile: () => {},
  isOpen: false,
  issuerId: null,
});

export const useIssuerProfileOverlay = () => useContext(IssuerProfileOverlayContext);

export function IssuerProfileOverlayProvider({ children }: { children: ReactNode }) {
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openProfile = async (idOrQuery: string) => {
    if (!idOrQuery) return;

    const term = idOrQuery.trim();
    if (!term) return;

    // 1. Try to fetch from the server API
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
        const match = exact || results[0];
        setIssuerId(match.id);
        setIsOpen(true);
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

    if (demoMatch) {
      setIssuerId(demoMatch.id);
      setIsOpen(true);
    } else {
      // Direct pass-through if nothing matches
      setIssuerId(term);
      setIsOpen(true);
    }
  };

  const closeProfile = () => {
    setIsOpen(false);
    setIssuerId(null);
  };

  return (
    <IssuerProfileOverlayContext.Provider value={{ openProfile, closeProfile, isOpen, issuerId }}>
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

  const panelRef = useModalA11y<HTMLDivElement>(closeProfile);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-6"
      style={{ background: "rgba(5, 5, 7, 0.72)" }}
      onClick={closeProfile}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Issuer Profile Overlay"
        onClick={(e) => e.stopPropagation()}
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
                onClick={closeProfile}
                className="tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
              >
                CLOSE
              </button>
            </div>
          </div>
        ) : (
          <Profile id={issuerId!} data={data} isOverlay={true} onClose={closeProfile} />
        )}
      </div>
    </div>
  );
}
