"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Issuer } from "@/types/issuers";
import { issuerProfileHref, issuerSearchHref } from "@/lib/issuers";

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
  const href = issuer ? issuerProfileHref(issuer) : issuerSearchHref(query || "");
  return (
    <Link href={href} title={title || "Open issuer profile"} className={"no-underline " + className}>
      {children}
    </Link>
  );
}
