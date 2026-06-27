"use client";

// Analyst sign-in / sign-up. Two lanes layered on the edge SSO gate:
//   • Sign in        — email + password           → POST /api/auth/login
//   • Create account — name + email + password + invite code → POST /api/auth/register
// Either mints the signed caos_analyst profile cookie; that name's initials then
// ride the chrome on every page and stamp every run. Shown by RequireAuth whenever
// no profile is signed in.

import { useState } from "react";
import axios from "axios";
import { login, register } from "@/lib/api";

type Mode = "signin" | "signup";

const inputCls =
  "rounded border border-caos-border bg-caos-elevated px-3 py-2 text-caos-text outline-none focus-ring focus:border-caos-accent transition-caos placeholder:text-caos-muted";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caos-sm uppercase tracking-wider text-caos-muted">{label}</span>
      {children}
    </label>
  );
}

export function LoginLanding({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (signup && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      if (signup) {
        await register({ code: code.trim(), name: name.trim(), email: email.trim(), password });
      } else {
        await login(email.trim(), password);
      }
      await onSuccess();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Something went wrong — try again.");
      setSubmitting(false);
    }
  };

  const ready = signup
    ? Boolean(name.trim() && email.trim() && password.length >= 8 && confirm.length > 0 && code.trim())
    : Boolean(email.trim() && password.length > 0);

  const swap = (m: Mode) => {
    setMode(m);
    setError(null);
  };

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
          <h1 className="text-caos-text text-lg font-semibold">
            {signup ? "Create your analyst account" : "Analyst sign-in"}
          </h1>
          <p className="text-caos-muted text-xs">
            {signup
              ? "Set up an email + password account. An invite code is required."
              : "Sign in with your email and password."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Sign in or create account"
          className="grid grid-cols-2 gap-1 rounded border border-caos-border p-1"
        >
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => swap(m)}
              className={`rounded px-3 py-1.5 text-caos-sm uppercase tracking-wider transition-caos focus-ring ${
                mode === m ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {signup && (
          <Field label="Analyst name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eric Gub"
              autoComplete="name"
              maxLength={120}
              className={inputCls}
            />
          </Field>
        )}

        <Field label="Email">
          <input
            type="email"
            autoFocus={!signup}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
            autoComplete={signup ? "email" : "username"}
            maxLength={255}
            className={inputCls}
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? "new-password" : "current-password"}
            maxLength={128}
            className={inputCls}
          />
        </Field>

        {signup && (
          <>
            <Field label="Confirm password">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                maxLength={128}
                className={inputCls}
              />
            </Field>
            <Field label="Invite code">
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                maxLength={64}
                className={`${inputCls} tabular`}
              />
            </Field>
            {password.length > 0 && password.length < 8 && (
              <p className="text-caos-sm text-caos-muted">Password must be at least 8 characters.</p>
            )}
          </>
        )}

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
          {submitting ? (signup ? "Creating…" : "Signing in…") : signup ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
