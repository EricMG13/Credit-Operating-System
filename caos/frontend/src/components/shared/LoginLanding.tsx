"use client";

// Code-gated analyst sign-in. The shared access code mints (or re-attaches to) a
// named profile; that name's initials then ride the chrome on every page and
// stamp every run. Shown by RequireAuth whenever no profile is signed in.

import { useState } from "react";
import axios from "axios";
import { createProfile } from "@/lib/api";

export function LoginLanding({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await createProfile(code.trim(), name.trim());
      await onSuccess();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? "Couldn't sign in — check the code and try again."
        : "Couldn't sign in — check the code and try again.";
      setError(typeof msg === "string" ? msg : "Couldn't sign in.");
      setSubmitting(false);
    }
  };

  const ready = code.trim().length > 0 && name.trim().length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-caos-bg px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm flex flex-col gap-5 rounded-lg border border-caos-border bg-caos-panel p-7"
        aria-describedby={error ? "login-error" : undefined}
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono text-caos-sm uppercase tracking-[0.2em] text-caos-accent">
            Credit Agent OS
          </span>
          <h1 className="text-caos-text text-lg font-semibold">Analyst sign-in</h1>
          <p className="text-caos-muted text-xs">
            Enter the access code and your name to create or resume your analyst profile.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-caos-sm uppercase tracking-wider text-caos-muted">Access code</span>
          <input
            type="password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="tabular rounded border border-caos-border bg-caos-elevated px-3 py-2 text-caos-text outline-none focus-ring focus:border-caos-accent transition-caos"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-caos-sm uppercase tracking-wider text-caos-muted">Analyst name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Eric Gub"
            autoComplete="name"
            maxLength={120}
            className="rounded border border-caos-border bg-caos-elevated px-3 py-2 text-caos-text outline-none focus-ring focus:border-caos-accent transition-caos placeholder:text-caos-muted/60"
          />
        </label>

        {error && (
          <p id="login-error" role="alert" className="text-caos-sm text-caos-critical">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || submitting}
          className="rounded border border-caos-accent bg-caos-accent px-3 py-2 text-caos-bg font-semibold text-sm transition-caos hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
        >
          {submitting ? "Signing in…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
