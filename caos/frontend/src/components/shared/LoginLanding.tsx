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

type LoginFields = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  code: string;
  coverage: string;
  location: string;
  recoveryWords: string[];
  recoveryWordConfirm: string[];
  recoveryHints: string[];
  showRecoveryWords: boolean;
};

const EMPTY_WORDS = ["", "", ""];
const INITIAL_FIELDS: LoginFields = {
  name: "", email: "", password: "", confirm: "", code: "", coverage: "TMT", location: "NA",
  recoveryWords: EMPTY_WORDS, recoveryWordConfirm: EMPTY_WORDS, recoveryHints: EMPTY_WORDS, showRecoveryWords: false,
};
const COVERAGE_AREAS = ["TMT", "Industrials", "Healthcare", "Consumer", "Energy", "Financials", "Real Estate", "Other"];
const LOCATIONS = ["NA", "EMEA", "APAC", "Other"];
const RECOVERY_INDEXES = [0, 1, 2];

function trimmed(values: string[]) {
  return values.map((value) => value.trim());
}

function loginReady(mode: Mode, fields: LoginFields) {
  if (mode === "signup") {
    return Boolean(fields.name.trim() && fields.email.trim() && fields.password.length >= 12 && fields.confirm.length > 0 && fields.code.trim() && fields.recoveryWords.every((word, index) => word.trim() && word.trim() === fields.recoveryWordConfirm[index].trim()));
  }
  if (mode === "recover") return Boolean(fields.email.trim() && fields.recoveryWords.every((word) => word.trim()));
  return Boolean(fields.email.trim() && fields.password.length > 0);
}

function validationError(mode: Mode, fields: LoginFields) {
  if (mode !== "signup") return null;
  if (fields.password !== fields.confirm) return "Passcodes don't match.";
  if (fields.recoveryWords.some((word, index) => word.trim() !== fields.recoveryWordConfirm[index].trim())) return "Recovery words don't match their confirmations.";
  return null;
}

async function authenticate(mode: Mode, fields: LoginFields) {
  if (mode === "signup") {
    await register({
      code: fields.code.trim(), name: fields.name.trim(), email: fields.email.trim(), passcode: fields.password,
      coverage_area: fields.coverage, location: fields.location, recovery_words: trimmed(fields.recoveryWords), recovery_hints: trimmed(fields.recoveryHints),
    });
    return;
  }
  if (mode === "recover") {
    await recoverLogin(fields.email.trim(), trimmed(fields.recoveryWords));
    return;
  }
  await login(fields.email.trim(), fields.password);
}

function submitLabel(mode: Mode, submitting: boolean) {
  if (submitting) return mode === "signup" ? "Creating…" : mode === "recover" ? "Recovering…" : "Signing in…";
  return mode === "signup" ? "Create account" : mode === "recover" ? "Recover access" : "Sign in";
}

function submitReason(mode: Mode, ready: boolean, submitting: boolean, label: string) {
  if (submitting) return label;
  if (ready) return null;
  if (mode === "signup") return "Fill in your name, email, a 12+ character passcode, confirmation, invite code, and all three recovery words.";
  if (mode === "recover") return "Enter your email and all three recovery words.";
  return "Enter your email and passcode.";
}

function clearRecovery(fields: LoginFields): LoginFields {
  return { ...fields, recoveryWords: [...EMPTY_WORDS], recoveryWordConfirm: [...EMPTY_WORDS], recoveryHints: [...EMPTY_WORDS], showRecoveryWords: false };
}

function apiErrorMessage(error: unknown) {
  const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
  return typeof detail === "string" ? detail : "Something went wrong — try again.";
}

function useLoginForm(onSuccess: () => void | Promise<void>) {
  const [mode, setMode] = useState<Mode>("signin");
  const [fields, setFields] = useState<LoginFields>(INITIAL_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ready = loginReady(mode, fields);
  const label = submitLabel(mode, submitting);
  const setField = <Key extends keyof LoginFields>(key: Key, value: LoginFields[Key]) => setFields((current) => ({ ...current, [key]: value }));
  const setRecovery = (key: "recoveryWords" | "recoveryWordConfirm" | "recoveryHints", index: number, value: string) => {
    setFields((current) => ({ ...current, [key]: current[key].map((item, itemIndex) => itemIndex === index ? value : item) }));
  };
  const swap = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setFields(clearRecovery);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || submitting) return;
    setError(null);
    const invalid = validationError(mode, fields);
    if (invalid) { setError(invalid); return; }
    setSubmitting(true);
    try {
      await authenticate(mode, fields);
      setFields(clearRecovery);
      await onSuccess();
    } catch (reason) {
      setError(apiErrorMessage(reason));
      setSubmitting(false);
    }
  };
  return { mode, fields, error, submitting, ready, label, reason: submitReason(mode, ready, submitting, label), setField, setRecovery, swap, submit };
}

type LoginFormModel = ReturnType<typeof useLoginForm>;

function LoginHeader({ form }: { form: LoginFormModel }) {
  const title = form.mode === "signup" ? "Create your analyst account" : form.mode === "recover" ? "Recover analyst access" : "Analyst sign-in";
  const description = form.mode === "signup"
    ? "Access code, profile, passcode, and confirmed recovery words are required."
    : form.mode === "recover"
      ? "Enter your email and all three recovery words. Stored hints are not disclosed on this endpoint."
      : "Sign in with your email and passcode.";
  return <div className="flex flex-col gap-1"><span className="font-mono text-caos-sm uppercase tracking-[0.2em] text-caos-accent">Credit Agent OS</span><h1 className="text-caos-text text-lg font-semibold">{title}</h1><p className="text-caos-muted text-xs">{description}</p></div>;
}

function LoginModeTabs({ form }: { form: LoginFormModel }) {
  const { getItemProps } = useRovingTabs(MODES.length, MODES.indexOf(form.mode), (index) => form.swap(MODES[index]));
  return (
    <div role="tablist" aria-label="Sign in or create account" className="grid grid-cols-3 gap-1 rounded border border-caos-border p-1">
      {MODES.map((mode, index) => <button key={mode} type="button" role="tab" aria-selected={form.mode === mode} onClick={() => form.swap(mode)} {...getItemProps(index)} className={`rounded px-3 py-1.5 text-caos-sm uppercase tracking-wider transition-caos focus-ring ${form.mode === mode ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text"}`}>{mode === "signin" ? "Sign in" : mode === "signup" ? "Create" : "Recover"}</button>)}
    </div>
  );
}

function LoginCredentials({ form }: { form: LoginFormModel }) {
  const signup = form.mode === "signup";
  return (
    <>
      {signup ? <Field label="Analyst name"><input type="text" name="name" value={form.fields.name} onChange={(event) => form.setField("name", event.target.value)} placeholder="e.g. Eric Gub…" autoComplete="name" maxLength={120} className={inputCls} /></Field> : null}
      <Field label="Email"><input type="email" name="email" autoFocus={!signup} value={form.fields.email} onChange={(event) => form.setField("email", event.target.value)} placeholder="name@firm.com…" autoComplete={signup ? "email" : "username"} spellCheck={false} maxLength={255} className={inputCls} /></Field>
      {form.mode !== "recover" ? <Field label="Login passcode"><input type="password" name="password" value={form.fields.password} onChange={(event) => form.setField("password", event.target.value)} autoComplete={signup ? "new-password" : "current-password"} maxLength={128} className={inputCls} /></Field> : null}
    </>
  );
}

function SignupFields({ form }: { form: LoginFormModel }) {
  if (form.mode !== "signup") return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Coverage area"><select name="coverage" value={form.fields.coverage} onChange={(event) => form.setField("coverage", event.target.value)} className={inputCls}>{COVERAGE_AREAS.map((area) => <option key={area}>{area}</option>)}</select></Field>
        <Field label="Location"><select name="location" value={form.fields.location} onChange={(event) => form.setField("location", event.target.value)} className={inputCls}>{LOCATIONS.map((location) => <option key={location}>{location}</option>)}</select></Field>
      </div>
      <Field label="Confirm passcode"><input type="password" name="confirm-password" value={form.fields.confirm} onChange={(event) => form.setField("confirm", event.target.value)} autoComplete="new-password" maxLength={128} className={inputCls} /></Field>
      <Field label="Invite code"><input type="password" name="invite-code" value={form.fields.code} onChange={(event) => form.setField("code", event.target.value)} inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={64} className={`${inputCls} tabular`} /></Field>
      {form.fields.password.length > 0 && form.fields.password.length < 12 ? <p className="text-caos-sm text-caos-muted">Passcode must be at least 12 characters.</p> : null}
    </>
  );
}

function RecoveryRow({ form, index }: { form: LoginFormModel; index: number }) {
  const signup = form.mode === "signup";
  const wordType = form.fields.showRecoveryWords ? "text" : "password";
  return (
    <div className={signup ? "grid gap-2 md:grid-cols-3" : ""}>
      <Field label={`Recovery word ${index + 1}`}><input type={wordType} name={`recovery-word-${index + 1}`} value={form.fields.recoveryWords[index]} onChange={(event) => form.setRecovery("recoveryWords", index, event.target.value)} autoComplete="off" spellCheck={false} maxLength={80} className={inputCls} /></Field>
      {signup ? <Field label={`Confirm word ${index + 1}`}><input type={wordType} name={`confirm-recovery-word-${index + 1}`} value={form.fields.recoveryWordConfirm[index]} onChange={(event) => form.setRecovery("recoveryWordConfirm", index, event.target.value)} autoComplete="off" spellCheck={false} maxLength={80} className={inputCls} /></Field> : null}
      {signup ? <Field label={`Hint ${index + 1}`}><input type="text" name={`recovery-hint-${index + 1}`} value={form.fields.recoveryHints[index]} onChange={(event) => form.setRecovery("recoveryHints", index, event.target.value)} autoComplete="off" maxLength={160} className={inputCls} /></Field> : null}
    </div>
  );
}

function RecoveryFields({ form }: { form: LoginFormModel }) {
  if (form.mode === "signin") return null;
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => form.setField("showRecoveryWords", !form.fields.showRecoveryWords)} className="self-start tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring rounded px-1">{form.fields.showRecoveryWords ? "Hide recovery words" : "Reveal recovery words"}</button>
      {RECOVERY_INDEXES.map((index) => <RecoveryRow key={index} form={form} index={index} />)}
    </div>
  );
}

function LoginForm({ form }: { form: LoginFormModel }) {
  return (
    <form onSubmit={form.submit} className="w-full max-w-sm flex flex-col gap-5 rounded-lg border border-caos-border bg-caos-panel p-7" aria-describedby={form.error ? "login-error" : undefined}>
      <LoginHeader form={form} />
      <LoginModeTabs form={form} />
      <LoginCredentials form={form} />
      <SignupFields form={form} />
      <RecoveryFields form={form} />
      {form.error ? <p id="login-error" role="alert" className="text-caos-sm text-caos-critical">{form.error}</p> : null}
      <ActionReason type="submit" reason={form.reason} className="rounded border border-caos-accent bg-caos-accent px-3 py-2 text-caos-bg font-semibold text-sm transition-caos hover:opacity-90 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed focus-ring">{form.label}</ActionReason>
    </form>
  );
}

export function LoginLanding({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const form = useLoginForm(onSuccess);
  return <div className="min-h-screen flex items-center justify-center bg-caos-bg px-4"><LoginForm form={form} /></div>;
}
