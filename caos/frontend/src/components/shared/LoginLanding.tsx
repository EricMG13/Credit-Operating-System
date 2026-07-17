"use client";

// Analyst sign-in / sign-up. Two lanes layered on the edge SSO gate:
//   • Sign in        — email + password           → POST /api/auth/login
//   • Create account — name + email + password + invite code → POST /api/auth/register
// Either mints the signed caos_analyst profile cookie; that name's initials then
// ride the chrome on every page and stamp every run. Shown by RequireAuth whenever
// no profile is signed in.

import { useState } from "react";
import axios from "axios";
import { login, recoverLogin, register } from "@/lib/api";
import { useRovingTabs } from "@/lib/useRovingTabs";
import { ActionReason } from "@/components/shared/ActionReason";

type Mode = "signin" | "signup" | "recover";
const MODES: Mode[] = ["signin", "signup", "recover"];

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
  const [coverage, setCoverage] = useState("TMT");
  const [location, setLocation] = useState("NA");
  const [recoveryWords, setRecoveryWords] = useState(["", "", ""]);
  // Recovery secrets stay in this component only: never localStorage, URL, or
  // console. Signup requires a second entry for each word before hashing it.
  const [recoveryWordConfirm, setRecoveryWordConfirm] = useState(["", "", ""]);
  const [recoveryHints, setRecoveryHints] = useState(["", "", ""]);
  const [showRecoveryWords, setShowRecoveryWords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // aria-disabled (unlike native `disabled`) does not block the browser's
    // default submit action on Enter-key or synthetic activation, so the
    // readiness gate has to be re-asserted here now that the button below
    // no longer carries native `disabled`.
    if (!ready || submitting) return;
    setError(null);
    if (signup && password !== confirm) {
      setError("Passcodes don't match.");
      return;
    }
    if (signup && recoveryWords.some((word, index) => word.trim() !== recoveryWordConfirm[index].trim())) {
      setError("Recovery words don't match their confirmations.");
      return;
    }
    setSubmitting(true);
    try {
      if (signup) {
        await register({
          code: code.trim(),
          name: name.trim(),
          email: email.trim(),
          passcode: password,
          coverage_area: coverage,
          location,
          recovery_words: recoveryWords.map((w) => w.trim()),
          recovery_hints: recoveryHints.map((h) => h.trim()),
        });
      } else if (mode === "recover") {
        await recoverLogin(email.trim(), recoveryWords.map((w) => w.trim()));
      } else {
        await login(email.trim(), password);
      }
      // Clear sensitive recovery material before yielding control to the auth
      // refresh/navigation path. Failed submissions intentionally keep values
      // visible so the analyst can correct a typo.
      setRecoveryWords(["", "", ""]);
      setRecoveryWordConfirm(["", "", ""]);
      setRecoveryHints(["", "", ""]);
      setShowRecoveryWords(false);
      await onSuccess();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Something went wrong — try again.");
      setSubmitting(false);
    }
  };

  const ready = signup
    ? Boolean(name.trim() && email.trim() && password.length >= 8 && confirm.length > 0 && code.trim() && recoveryWords.every((w, i) => w.trim() && w.trim() === recoveryWordConfirm[i].trim()))
    : mode === "recover"
    ? Boolean(email.trim() && recoveryWords.every((w) => w.trim()))
    : Boolean(email.trim() && password.length > 0);

  const submitLabel = submitting
    ? signup
      ? "Creating…"
      : mode === "recover"
      ? "Recovering…"
      : "Signing in…"
    : signup
    ? "Create account"
    : mode === "recover"
    ? "Recover access"
    : "Sign in";

  const submitReason = submitting
    ? submitLabel
    : !ready
    ? signup
      ? "Fill in your name, email, an 8+ character passcode, confirmation, invite code, and all three recovery words."
      : mode === "recover"
      ? "Enter your email and all three recovery words."
      : "Enter your email and passcode."
    : null;

  const swap = (m: Mode) => {
    setMode(m);
    setError(null);
    // A mode change is an abandon/reset boundary for recovery material.
    setRecoveryWords(["", "", ""]);
    setRecoveryWordConfirm(["", "", ""]);
    setRecoveryHints(["", "", ""]);
    setShowRecoveryWords(false);
  };

  const { getItemProps } = useRovingTabs(MODES.length, MODES.indexOf(mode), (i) => swap(MODES[i]));

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
            {signup ? "Create your analyst account" : mode === "recover" ? "Recover analyst access" : "Analyst sign-in"}
          </h1>
          <p className="text-caos-muted text-xs">
            {signup
              ? "Access code, profile, passcode, and confirmed recovery words are required."
              : mode === "recover"
              ? "Enter your email and all three recovery words. Stored hints are not disclosed on this endpoint."
              : "Sign in with your email and passcode."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Sign in or create account"
          className="grid grid-cols-3 gap-1 rounded border border-caos-border p-1"
        >
          {MODES.map((m, i) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => swap(m)}
              {...getItemProps(i)}
              className={`rounded px-3 py-1.5 text-caos-sm uppercase tracking-wider transition-caos focus-ring ${
                mode === m ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text"
              }`}
            >
              {m === "signin" ? "Sign in" : m === "signup" ? "Create" : "Recover"}
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

        {mode !== "recover" ? (
          <Field label="Login passcode">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? "new-password" : "current-password"}
              maxLength={128}
              className={inputCls}
            />
          </Field>
        ) : null}

        {signup && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Coverage area">
                <select value={coverage} onChange={(e) => setCoverage(e.target.value)} className={inputCls}>
                  {["TMT", "Industrials", "Healthcare", "Consumer", "Energy", "Financials", "Real Estate", "Other"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <select value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls}>
                  {["NA", "EMEA", "APAC", "Other"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Confirm passcode">
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
              <p className="text-caos-sm text-caos-muted">Passcode must be at least 8 characters.</p>
            )}
          </>
        )}

        {(signup || mode === "recover") ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowRecoveryWords((visible) => !visible)}
              className="self-start tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring rounded px-1"
            >
              {showRecoveryWords ? "Hide recovery words" : "Reveal recovery words"}
            </button>
            {[0, 1, 2].map((i) => (
              <div key={i} className={signup ? "grid gap-2 md:grid-cols-3" : ""}>
                <Field label={`Recovery word ${i + 1}`}>
                  <input
                    type={showRecoveryWords ? "text" : "password"}
                    value={recoveryWords[i]}
                    onChange={(e) => setRecoveryWords((w) => w.map((x, j) => j === i ? e.target.value : x))}
                    autoComplete="off"
                    maxLength={80}
                    className={inputCls}
                  />
                </Field>
                {signup ? (
                  <Field label={`Confirm word ${i + 1}`}>
                    <input
                      type={showRecoveryWords ? "text" : "password"}
                      value={recoveryWordConfirm[i]}
                      onChange={(e) => setRecoveryWordConfirm((words) => words.map((word, index) => index === i ? e.target.value : word))}
                      autoComplete="off"
                      maxLength={80}
                      className={inputCls}
                    />
                  </Field>
                ) : null}
                {signup ? (
                  <Field label={`Hint ${i + 1}`}>
                    <input
                      type="text"
                      value={recoveryHints[i]}
                      onChange={(e) => setRecoveryHints((h) => h.map((x, j) => j === i ? e.target.value : x))}
                      maxLength={160}
                      className={inputCls}
                    />
                  </Field>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {error && (
          <p id="login-error" role="alert" className="text-caos-sm text-caos-critical">
            {error}
          </p>
        )}

        <ActionReason
          type="submit"
          reason={submitReason}
          className="rounded border border-caos-accent bg-caos-accent px-3 py-2 text-caos-bg font-semibold text-sm transition-caos hover:opacity-90 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed focus-ring"
        >
          {submitLabel}
        </ActionReason>
      </form>
    </div>
  );
}
