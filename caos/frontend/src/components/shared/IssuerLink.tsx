"use client";

import type { ReactNode, MouseEvent } from "react";
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
  const { openProfile } = useIssuerProfileOverlay();
  const href = issuer ? issuerProfileHref(issuer) : issuerSearchHref(query || "");

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const idOrQuery = issuer?.id || query;
    if (idOrQuery) {
      openProfile(idOrQuery);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      title={title || "Open issuer profile"}
      className={"no-underline cursor-pointer " + className}
    >
      {children}
    </a>
  );
}
