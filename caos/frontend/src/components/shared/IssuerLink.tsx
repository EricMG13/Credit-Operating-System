"use client";

import type { ReactNode, KeyboardEvent, MouseEvent } from "react";
import type { Issuer } from "@/types/issuers";
import { issuerProfileHref, issuerSearchHref } from "@/lib/issuers";
import { useIssuerProfileOverlay } from "./IssuerProfileOverlay";

export function IssuerLink({
  issuer,
  query,
  children,
  className = "",
  title,
}: {
  issuer?: Pick<Issuer, "id"> | null;
  query?: string | null;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const { openProfile, openProfileByQuery } = useIssuerProfileOverlay();
  const href = issuer ? issuerProfileHref(issuer) : issuerSearchHref(query || "");

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // Issuer links often live inside keyboard-operable coverage rows. Opening
    // the profile is the complete identity-cell action; it must not also trigger
    // the row remainder's detail-strip action.
    e.stopPropagation();
    // Prefer the id path (direct open); only fall back to a text search when all
    // we have is a free-text query (e.g. a Command Center portfolio code).
    if (issuer?.id) {
      openProfile(issuer.id);
    } else if (query) {
      openProfileByQuery(query);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={title || "Open issuer profile"}
      className={"no-underline cursor-pointer " + className}
    >
      {children}
    </a>
  );
}
