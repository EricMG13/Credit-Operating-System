"use client";

// Root error boundary — the only thing that catches a failure in the root layout
// itself, so it must supply its own <html>/<body> (the layout that normally
// provides them, plus its Tailwind/font wiring, has crashed). Inline styles only,
// using the CAOS palette literally so it renders even if the CSS pipeline is gone.

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
          background: "#0a0a0f",
          color: "#e6e6ef",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, 'JetBrains Mono', monospace",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: "28rem",
            padding: "1.75rem",
            border: "1px solid #262633",
            borderRadius: "0.5rem",
            background: "#12121a",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#ef4444",
            }}
          >
            Fatal error
          </div>
          <h1 style={{ fontSize: "1.125rem", margin: "0.5rem 0", color: "#e6e6ef" }}>
            The workspace failed to load
          </h1>
          <p style={{ fontSize: "0.75rem", color: "#8a8a9a", margin: 0 }}>
            Try again. If this keeps happening, contact your CAOS administrator.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#8a8a9a", marginTop: "0.5rem" }}>
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
              color: "#0a0a0f",
              background: "#4f8cff",
              border: "1px solid #4f8cff",
              borderRadius: "0.25rem",
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
