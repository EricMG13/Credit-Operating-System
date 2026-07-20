"use client";

// Root error boundary — the only thing that catches a failure in the root layout
// itself, so it must supply its own <html>/<body> (the layout that normally
// provides them, plus its Tailwind/font wiring, has crashed). Inline styles use
// centralized literal tokens so this remains independent of the CSS pipeline.

import { CAOS_COLOR_TOKENS } from "@/lib/color-tokens";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: CAOS_COLOR_TOKENS.bg,
          color: CAOS_COLOR_TOKENS.text,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, 'JetBrains Mono', monospace",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: "28rem",
            padding: "1.75rem",
            border: `1px solid ${CAOS_COLOR_TOKENS.border}`,
            borderRadius: "6px",
            background: CAOS_COLOR_TOKENS.panel,
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: CAOS_COLOR_TOKENS.critical,
            }}
          >
            Fatal error
          </div>
          <h1 style={{ fontSize: "1.125rem", margin: "0.5rem 0", color: CAOS_COLOR_TOKENS.text }}>
            The workspace failed to load
          </h1>
          <p style={{ fontSize: "0.75rem", color: CAOS_COLOR_TOKENS.muted, margin: 0 }}>
            Try again. If this keeps happening, contact your CAOS administrator.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: CAOS_COLOR_TOKENS.muted, marginTop: "0.5rem" }}>
              ref {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: CAOS_COLOR_TOKENS.bg,
              background: CAOS_COLOR_TOKENS.accent,
              border: `1px solid ${CAOS_COLOR_TOKENS.accent}`,
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
