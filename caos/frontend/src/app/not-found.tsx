// Custom 404 (App Router). Replaces Next's stock "page could not be found" with
// the CAOS surface. Server component — no interactivity needed; a Link returns to
// the Command Center.

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-caos-bg px-4">
      <div className="w-full max-w-md flex flex-col gap-5 rounded-lg border border-caos-border bg-caos-panel p-7">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-caos-sm uppercase tracking-[0.2em] text-caos-accent">
            404
          </span>
          <h1 className="text-caos-text text-lg font-semibold">No such view</h1>
          <p className="text-caos-muted text-xs">
            That route doesn&apos;t exist. It may have been moved, or the link is stale.
          </p>
        </div>
        <Link
          href="/"
          className="self-start rounded border border-caos-accent bg-caos-accent px-3 py-2 text-sm font-semibold text-caos-bg transition-caos hover:opacity-90 focus-ring"
        >
          Back to Command Center
        </Link>
      </div>
    </div>
  );
}
