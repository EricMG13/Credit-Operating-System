"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { toErrorMessage, type WatchRuleDTO, type WatchRuleOperator, type WatchRuleSchedule, type WatchRuleSignal, type WatchRuleWriteDTO } from "@/lib/api";
import { useModalA11y } from "@/lib/use-modal-a11y";
import type { PersistedWatchRuleController } from "./usePersistedMonitorController";

const UNAVAILABLE_SIGNALS = new Set<WatchRuleSignal>(["edgar_filing", "market_move", "news"]);
const SIGNALS: Array<{ value: WatchRuleSignal; label: string }> = [
  { value: "run_finding", label: "Run finding" },
  { value: "qa_gate", label: "QA gate" },
  { value: "covenant", label: "Covenant" },
  { value: "cp1b_monitoring", label: "CP-1B monitoring" },
  { value: "cp1c_peer_outlier", label: "CP-1C peer outlier" },
  { value: "edgar_filing", label: "EDGAR filing · unavailable" },
  { value: "market_move", label: "Market move · unavailable" },
  { value: "news", label: "News · unavailable" },
];

type FormState = {
  name: string;
  signal: WatchRuleSignal;
  enabled: boolean;
  paused: boolean;
  issuerId: string;
  portfolioId: string;
  operator: WatchRuleOperator;
  threshold: string;
  thresholdType: "number" | "text";
  kind: string;
  title: string;
  impact: string;
  schedule: WatchRuleSchedule;
  interval: string;
  nextAt: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  signal: "qa_gate",
  enabled: true,
  paused: false,
  issuerId: "",
  portfolioId: "",
  operator: "present",
  threshold: "",
  thresholdType: "text",
  kind: "qa_change",
  title: "QA gate changed",
  impact: "Review governed evidence.",
  schedule: "event_driven",
  interval: "",
  nextAt: "",
};

function localDateTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(value).toISOString().slice(0, 19);
}

function formForRule(rule: WatchRuleDTO): FormState {
  return {
    name: rule.name,
    signal: rule.signal_type,
    enabled: rule.enabled,
    paused: rule.paused,
    issuerId: rule.issuer_id ?? "",
    portfolioId: rule.portfolio_id ?? "",
    operator: rule.config.operator,
    threshold: rule.config.threshold == null ? "" : String(rule.config.threshold),
    thresholdType: typeof rule.config.threshold === "string" ? "text" : "number",
    kind: rule.config.kind,
    title: rule.config.title,
    impact: rule.config.impact,
    schedule: rule.schedule_kind,
    interval: rule.schedule_interval_seconds == null ? "" : String(rule.schedule_interval_seconds),
    nextAt: localDateTime(rule.next_evaluation_at),
  };
}

type WatchRuleEditorState = {
  open: boolean;
  editing: WatchRuleDTO | null;
  form: FormState;
};

type WatchRuleEditorAction =
  | { type: "begin-create" }
  | { type: "begin-edit"; rule: WatchRuleDTO }
  | { type: "change"; key: keyof FormState; value: FormState[keyof FormState] }
  | { type: "close" }
  | { type: "authority-revoked" };

export const initialWatchRuleEditorState: WatchRuleEditorState = {
  open: false,
  editing: null,
  form: EMPTY_FORM,
};

export function watchRuleEditorStateReducer(
  state: WatchRuleEditorState,
  action: WatchRuleEditorAction,
): WatchRuleEditorState {
  switch (action.type) {
    case "begin-create":
      return { open: true, editing: null, form: EMPTY_FORM };
    case "begin-edit":
      return { open: true, editing: action.rule, form: formForRule(action.rule) };
    case "change":
      return { ...state, form: { ...state.form, [action.key]: action.value } as FormState };
    case "close":
      return { ...state, open: false };
    case "authority-revoked":
      return initialWatchRuleEditorState;
  }
}

function thresholdValue(form: FormState): string | number | null {
  if (form.operator === "present") return null;
  if (form.operator === "eq" && form.thresholdType === "text") return form.threshold.trim();
  return Number(form.threshold);
}

function scheduledUtcInstant(value: string): string | null {
  if (!value) return null;
  const wire = `${value}${value.length === 16 ? ":00" : ""}Z`;
  const parsed = new Date(wire);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().replace(/\.000Z$/u, "Z");
}

function wirePayload(form: FormState): WatchRuleWriteDTO {
  const unavailable = UNAVAILABLE_SIGNALS.has(form.signal);
  const enabled = unavailable ? false : form.enabled;
  const scheduled = form.schedule !== "event_driven";
  return {
    name: form.name.trim(),
    signal_type: form.signal,
    enabled,
    paused: form.paused,
    issuer_id: form.issuerId.trim() || null,
    portfolio_id: form.portfolioId.trim() || null,
    schedule_kind: form.schedule,
    schedule_interval_seconds: scheduled ? Number(form.interval) : null,
    next_evaluation_at: scheduled ? scheduledUtcInstant(form.nextAt) : null,
    config: {
      operator: form.operator,
      threshold: thresholdValue(form),
      kind: form.kind.trim(),
      title: form.title.trim(),
      impact: form.impact.trim(),
    },
  };
}

type InvalidField = "name" | "operator" | "threshold" | "interval" | "nextAt" | "kind" | "title";

function validate(form: FormState): { message: string; field: InvalidField } | null {
  if (!form.name.trim()) return { message: "Rule name is required", field: "name" };
  if (!form.kind.trim()) return { message: "Alert kind is required", field: "kind" };
  if (!form.title.trim()) return { message: "Alert title is required", field: "title" };
  if ((form.signal === "run_finding" || form.signal === "qa_gate") && form.operator !== "present" && form.operator !== "eq") {
    return { message: "This categorical signal supports only present or eq", field: "operator" };
  }
  if (form.operator !== "present") {
    if (!form.threshold.trim()) return { message: "Threshold is required for this operator", field: "threshold" };
    const numericSignal = form.signal === "covenant" || form.signal === "cp1b_monitoring" || form.signal === "cp1c_peer_outlier";
    if ((numericSignal || form.operator !== "eq") && !Number.isFinite(Number(form.threshold))) return { message: "Threshold must be a finite number", field: "threshold" };
  }
  if (form.schedule !== "event_driven") {
    const interval = Number(form.interval);
    if (!Number.isInteger(interval) || interval < 60 || interval > 86_400) return { message: "Interval must be between 60 and 86400 seconds", field: "interval" };
    const enabled = form.enabled && !UNAVAILABLE_SIGNALS.has(form.signal);
    if (enabled && !form.paused && !form.nextAt) return { message: "Next evaluation time is required for an active schedule", field: "nextAt" };
    if (form.nextAt && !scheduledUtcInstant(form.nextAt)) return { message: "Next evaluation time must be a valid UTC instant", field: "nextAt" };
  }
  return null;
}

function isConflict(reason: unknown): boolean {
  return (reason as { response?: { status?: number } })?.response?.status === 409;
}

function isCreateIdempotencyConflict(reason: unknown): boolean {
  const response = (reason as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  return response?.status === 409 && response.data?.detail === "watch_rule_idempotency_conflict";
}

function isAuthorityInvalidation(reason: unknown): boolean {
  const status = (reason as { response?: { status?: number } })?.response?.status;
  return status === 403 || status === 404;
}

function RuleStatus({ rule }: { rule: WatchRuleDTO }) {
  const label = rule.paused ? "Paused" : rule.enabled ? "Enabled" : "Disabled";
  const glyph = rule.paused ? "Ⅱ" : rule.enabled ? "●" : "○";
  return <span className="whitespace-nowrap tabular text-caos-2xs uppercase tracking-wider text-caos-muted"><span aria-hidden="true">{glyph} </span>{label} · v{rule.current_version}</span>;
}

function RuleList({ controller, onEdit }: { controller: PersistedWatchRuleController; onEdit: (rule: WatchRuleDTO) => void }) {
  if (controller.status === "loading") return <SurfaceState kind="loading" title="Loading persisted watch rules" compact />;
  if (controller.status === "error") return <SurfaceState kind="unavailable" title="Persisted watch rules unavailable" detail={controller.error ?? undefined} primaryAction={<button type="button" onClick={() => void controller.refresh()} className="min-h-8 rounded border border-caos-border px-2 text-caos-xs text-caos-muted focus-ring caos-target">Retry watch rules</button>} compact />;
  if (!controller.rules.length) return <SurfaceState kind="empty" title="No watch rules configured" detail="Create a rule to evaluate persisted governed signals." compact />;
  return (
    <ul className="min-w-0 divide-y divide-caos-border/60 border-y border-caos-border/60">
      {controller.rules.map((rule) => <li key={rule.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-2 py-1.5"><span className="col-span-2 min-w-0"><span className="block truncate text-caos-xs text-caos-text">{rule.name}</span><span className="block truncate tabular text-caos-2xs text-caos-muted">{rule.signal_type} · {rule.issuer_id ?? rule.portfolio_id ?? "team scope"}</span></span><RuleStatus rule={rule} />{rule.can_mutate === true ? <button type="button" aria-label={`Edit ${rule.name}`} onClick={() => onEdit(rule)} className="min-h-8 justify-self-end whitespace-nowrap rounded border border-caos-border px-2 text-caos-xs text-caos-muted transition-caos focus-ring caos-target">Edit</button> : <span className="justify-self-end whitespace-nowrap tabular text-caos-2xs uppercase tracking-wider text-caos-muted"><span aria-hidden="true">◇ </span>Read only</span>}</li>)}
    </ul>
  );
}

function WatchRuleActivationState({ controller }: { controller: PersistedWatchRuleController }) {
  const retryClass = "min-h-8 rounded border border-caos-border px-2 text-caos-xs text-caos-muted transition-caos focus-ring caos-target";
  if (controller.availability === "checking") {
    return <SurfaceState kind="checking" title="Checking watch-rule activation" detail="Waiting for a verified workspace-settings snapshot before any watch-rule request." compact />;
  }
  if (controller.availability === "disabled") {
    return (
      <SurfaceState
        kind="offline"
        title="Watch rules disabled"
        detail="The deployment activation flag is default-off. Historical persisted alerts remain available."
        primaryAction={<button type="button" onClick={() => void controller.retryActivation()} className={retryClass}>Recheck watch-rule activation</button>}
        compact
      />
    );
  }
  return (
    <SurfaceState
      kind="unavailable"
      title="Watch-rule activation unavailable"
      detail={controller.activationError ?? "The workspace settings snapshot could not verify watch-rule activation. Historical persisted alerts remain available."}
      primaryAction={<button type="button" onClick={() => void controller.retryActivation()} className={retryClass}>Retry watch-rule activation</button>}
      compact
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-caos-2xs uppercase tracking-wider text-caos-muted"><span>{label}</span>{children}</label>;
}

function RuleDialogFrame({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useModalA11y<HTMLElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-caos-bg/80 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={label} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded border border-caos-border bg-caos-panel p-3 shadow-xl">
        {children}
      </section>
    </div>
  );
}

export function WatchRuleEditor({ controller }: { controller: PersistedWatchRuleController }) {
  const [{ open, editing, form }, dispatchEditor] = useReducer(watchRuleEditorStateReducer, initialWatchRuleEditorState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const thresholdRef = useRef<HTMLInputElement | null>(null);
  const operatorRef = useRef<HTMLSelectElement | null>(null);
  const intervalRef = useRef<HTMLInputElement | null>(null);
  const nextAtRef = useRef<HTMLInputElement | null>(null);
  const kindRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const saveRef = useRef<HTMLButtonElement | null>(null);
  const conflictRef = useRef<HTMLButtonElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const savingRef = useRef(false);
  const createOperationKeyRef = useRef<string | null>(null);
  const unavailable = UNAVAILABLE_SIGNALS.has(form.signal);

  useEffect(() => {
    if (!open || controller.status !== "ready") return;
    const authorityIsCurrent = editing
      ? controller.rules.find((rule) => rule.id === editing.id)?.can_mutate === true
      : controller.canCreate;
    if (authorityIsCurrent) return;
    createOperationKeyRef.current = null;
    dispatchEditor({ type: "authority-revoked" });
    setError(null);
    setConflict(false);
    setNotice("Rule authority changed. The writable draft was closed.");
  }, [controller.canCreate, controller.rules, controller.status, editing, open]);

  if (controller.availability !== "enabled") {
    return (
      <section aria-label="Watch rules" className="grid gap-2">
        <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-text">Watch rules</h3>
        <WatchRuleActivationState controller={controller} />
      </section>
    );
  }

  const close = () => {
    createOperationKeyRef.current = null;
    dispatchEditor({ type: "close" });
    setError(null);
    setConflict(false);
  };
  const dismiss = () => {
    if (!savingRef.current) close();
  };
  const beginCreate = () => {
    createOperationKeyRef.current = crypto.randomUUID();
    dispatchEditor({ type: "begin-create" });
    setNotice(null);
  };
  const beginEdit = (rule: WatchRuleDTO) => {
    createOperationKeyRef.current = null;
    dispatchEditor({ type: "begin-edit", rule });
    setNotice(null);
  };
  const change = <K extends keyof FormState>(key: K, value: FormState[K]) => dispatchEditor({ type: "change", key, value });
  const focusInvalid = (field: InvalidField) => ({ name: nameRef, operator: operatorRef, threshold: thresholdRef, interval: intervalRef, nextAt: nextAtRef, kind: kindRef, title: titleRef })[field].current?.focus();

  const save = async () => {
    if (savingRef.current) return;
    const invalid = validate(form);
    if (invalid) {
      setError(invalid.message);
      queueMicrotask(() => focusInvalid(invalid.field));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      const payload = wirePayload(form);
      if (editing) await controller.update(editing.id, editing.current_version, payload);
      else await controller.create(payload, createOperationKeyRef.current ??= crypto.randomUUID());
      setNotice(editing ? "Rule updated." : "Rule created.");
      close();
    } catch (reason) {
      if (isAuthorityInvalidation(reason)) {
        dispatchEditor({ type: "authority-revoked" });
        setNotice("Rule authority changed. The writable draft was closed.");
        setError(null);
        setConflict(false);
        void controller.refresh().catch(() => undefined);
      } else if (!editing && isCreateIdempotencyConflict(reason)) {
        createOperationKeyRef.current = null;
        dispatchEditor({ type: "authority-revoked" });
        setNotice("Earlier create attempt already exists. The changed draft was closed; review persisted rules before starting a new intent.");
        setError(null);
        setConflict(false);
        void controller.refresh().catch(() => undefined);
      } else if (isConflict(reason)) {
        setConflict(true);
        setError("Rule changed in another session. Reload the latest version before retrying.");
        queueMicrotask(() => conflictRef.current?.focus());
      } else {
        setError(toErrorMessage(reason, "Watch rule was not saved"));
        queueMicrotask(() => errorRef.current?.focus());
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const reloadLatest = async () => {
    if (!editing || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("Reloading the latest persisted rule…");
    try {
      const latest = await controller.reloadOne(editing.id);
      if (latest.can_mutate !== true) {
        setNotice("Rule authority changed. The latest persisted rule is read only.");
        dispatchEditor({ type: "authority-revoked" });
        close();
        return;
      }
      dispatchEditor({ type: "begin-edit", rule: latest });
      setError(null);
      setConflict(false);
      queueMicrotask(() => saveRef.current?.focus());
    } catch (reason) {
      if (isAuthorityInvalidation(reason)) {
        createOperationKeyRef.current = null;
        dispatchEditor({ type: "authority-revoked" });
        setNotice("Rule authority changed. The writable draft was closed.");
        setError(null);
        setConflict(false);
        void controller.refresh().catch(() => undefined);
      } else {
        setError(toErrorMessage(reason, "Latest watch rule could not be loaded"));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const inputClass = "min-h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs normal-case tracking-normal text-caos-text focus-ring caos-target";
  return (
    <section aria-label="Watch rules" className="grid min-w-0 grid-cols-1 gap-2">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><div className="min-w-0"><h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-text">Watch rules</h3><p className="text-caos-2xs text-caos-muted"><span aria-hidden="true">● </span>In-app · persisted <span aria-hidden="true">◇ </span>Email · rendered intent only · <strong>NOT SENT</strong></p></div>{controller.canCreate ? <button type="button" aria-label="Manage watch rules" onClick={beginCreate} className="min-h-8 shrink-0 whitespace-nowrap rounded border border-caos-accent px-2 text-caos-xs text-caos-accent transition-caos focus-ring caos-target">New rule</button> : controller.status === "ready" ? <span className="whitespace-nowrap tabular text-caos-2xs uppercase tracking-wider text-caos-muted"><span aria-hidden="true">◇ </span>Creation read only</span> : null}</div>
      {notice ? <p role="status" className="text-caos-xs text-caos-success">{notice}</p> : null}
      <RuleList controller={controller} onEdit={beginEdit} />
      {open ? (
        <RuleDialogFrame label={editing ? `Edit watch rule ${editing.name}` : "Create watch rule"} onClose={dismiss}>
            <div className="mb-3 flex items-center gap-2"><h2 className="text-caos-md font-semibold uppercase tracking-wider text-caos-text">{editing ? "Edit watch rule" : "Create watch rule"}</h2><button type="button" aria-label="Close watch rule editor" onClick={dismiss} disabled={saving} className="ml-auto min-h-8 min-w-11 rounded border border-caos-border text-caos-muted focus-ring caos-target disabled:opacity-50">×</button></div>
            <fieldset disabled={saving} className="grid gap-3 md:grid-cols-2 disabled:opacity-70">
              <Field label="Rule name"><input ref={nameRef} aria-label="Rule name" value={form.name} onChange={(event) => change("name", event.target.value)} className={inputClass} /></Field>
              <Field label="Signal"><select aria-label="Signal" value={form.signal} onChange={(event) => { const signal = event.target.value as WatchRuleSignal; change("signal", signal); if (UNAVAILABLE_SIGNALS.has(signal)) change("enabled", false); if (signal === "covenant" || signal === "cp1b_monitoring" || signal === "cp1c_peer_outlier") change("thresholdType", "number"); }} className={inputClass}>{SIGNALS.map((signal) => <option key={signal.value} value={signal.value}>{signal.label}</option>)}</select></Field>
              <label className="flex min-h-8 items-center gap-2 text-caos-xs text-caos-muted"><input aria-label="Enabled" type="checkbox" checked={!unavailable && form.enabled} disabled={unavailable} onChange={(event) => change("enabled", event.target.checked)} className="min-h-8 min-w-8 caos-target" />Enabled</label>
              <label className="flex min-h-8 items-center gap-2 text-caos-xs text-caos-muted"><input aria-label="Paused" type="checkbox" checked={form.paused} onChange={(event) => change("paused", event.target.checked)} className="min-h-8 min-w-8 caos-target" />Paused</label>
              {unavailable ? <p role="status" className="md:col-span-2 text-caos-xs text-caos-warning"><span aria-hidden="true">△ </span>Source unavailable · rule must remain disabled</p> : null}
              <Field label="Issuer scope"><input aria-label="Issuer scope" value={form.issuerId} onChange={(event) => change("issuerId", event.target.value)} className={inputClass} /></Field>
              <Field label="Portfolio scope"><input aria-label="Portfolio scope" value={form.portfolioId} onChange={(event) => change("portfolioId", event.target.value)} className={inputClass} /></Field>
              <Field label="Operator"><select ref={operatorRef} aria-label="Operator" value={form.operator} onChange={(event) => { const operator = event.target.value as WatchRuleOperator; change("operator", operator); if (operator !== "eq") change("thresholdType", "number"); }} className={inputClass}>{["present", "eq", "gt", "gte", "lt", "lte"].map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></Field>
              <Field label="Threshold"><input ref={thresholdRef} aria-label="Threshold" value={form.threshold} disabled={form.operator === "present"} onChange={(event) => change("threshold", event.target.value)} className={inputClass} /></Field>
              {(form.signal === "run_finding" || form.signal === "qa_gate") && form.operator === "eq" ? <Field label="Threshold type"><select aria-label="Threshold type" value={form.thresholdType} onChange={(event) => change("thresholdType", event.target.value as FormState["thresholdType"])} className={inputClass}><option value="text">Text category</option><option value="number">Number</option></select></Field> : null}
              <Field label="Alert kind"><input ref={kindRef} aria-label="Alert kind" value={form.kind} onChange={(event) => change("kind", event.target.value)} className={inputClass} /></Field>
              <Field label="Alert title"><input ref={titleRef} aria-label="Alert title" value={form.title} onChange={(event) => change("title", event.target.value)} className={inputClass} /></Field>
              <label className="grid gap-1 md:col-span-2 text-caos-2xs uppercase tracking-wider text-caos-muted"><span>Alert impact</span><textarea aria-label="Alert impact" value={form.impact} onChange={(event) => change("impact", event.target.value)} className={`${inputClass} min-h-20 py-2`} /></label>
              <Field label="Schedule"><select aria-label="Schedule" value={form.schedule} onChange={(event) => change("schedule", event.target.value as WatchRuleSchedule)} className={inputClass}><option value="event_driven">Event driven</option><option value="interval">Interval</option><option value="edgar">EDGAR schedule</option></select></Field>
              {form.schedule !== "event_driven" ? <><Field label="Interval seconds"><input ref={intervalRef} aria-label="Interval seconds" inputMode="numeric" value={form.interval} onChange={(event) => change("interval", event.target.value)} className={inputClass} /></Field><Field label="Next evaluation UTC"><input ref={nextAtRef} aria-label="Next evaluation UTC" type="datetime-local" step={1} value={form.nextAt} onChange={(event) => change("nextAt", event.target.value)} className={inputClass} /></Field></> : null}
            </fieldset>
            <p className="mt-3 text-caos-xs text-caos-muted"><span aria-hidden="true">● </span>In-app · persisted. <span aria-hidden="true">◇ </span>Email · rendered intent only · <strong>NOT SENT</strong>.</p>
            {error ? <div ref={errorRef} role={saving ? "status" : "alert"} tabIndex={-1} className={`mt-3 flex items-center gap-2 rounded border px-2 py-2 text-caos-xs ${saving ? "border-caos-border text-caos-muted" : "border-caos-critical/50 text-caos-critical"}`}><span className="flex-1">{error}</span>{conflict ? <button ref={conflictRef} type="button" aria-disabled={saving || undefined} aria-busy={saving || undefined} onClick={() => void reloadLatest()} className="min-h-8 rounded border border-caos-border px-2 focus-ring caos-target aria-disabled:opacity-50">{saving ? "Reloading…" : "Reload latest rule"}</button> : null}</div> : null}
            <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={dismiss} disabled={saving} className="min-h-8 rounded border border-caos-border px-3 text-caos-xs text-caos-muted focus-ring caos-target disabled:opacity-50">Cancel</button><button ref={saveRef} type="button" onClick={() => void save()} aria-disabled={saving || undefined} aria-busy={saving || undefined} className="min-h-8 rounded border border-caos-accent px-3 text-caos-xs text-caos-accent transition-caos focus-ring caos-target aria-disabled:opacity-50">{saving ? "Saving…" : "Save rule"}</button></div>
        </RuleDialogFrame>
      ) : null}
    </section>
  );
}
