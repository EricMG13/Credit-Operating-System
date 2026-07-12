// A formal persistence-scope chip for Settings controls — replaces the
// informal " · saved in this browser" / " · saved to analyst profile" prose
// baked into Panel titles. Three scopes, matching how the page actually
// persists each control:
//
//   device    — browser localStorage (model mode, query model, research prefs)
//   profile   — the analyst's server-side settings profile (role view, model
//               lanes, email senders) — follows the analyst across devices
//   workspace — server environment config, read-only here; changing it means
//               editing the deployment env and restarting
//
// Color signal is paired with the label text itself (never color alone), and
// the tooltip carries the full sentence so the chip stays terse on the row.

export type Scope = "device" | "profile" | "workspace";

const SCOPE_LABEL: Record<Scope, string> = {
  device: "THIS BROWSER",
  profile: "ANALYST PROFILE",
  workspace: "WORKSPACE · READ-ONLY",
};

const SCOPE_DETAIL: Record<Scope, string> = {
  device: "Stored in this browser's local storage — does not follow you to another device or profile.",
  profile: "Stored on your analyst profile — follows you across devices, shared by anyone signed into this account.",
  workspace: "Set via the deployment environment. Changing it means editing the environment and restarting — it is not per-analyst.",
};

export function ScopeLabel({ scope, className = "" }: { scope: Scope; className?: string }) {
  const readOnly = scope === "workspace";
  return (
    <span
      title={SCOPE_DETAIL[scope]}
      className={
        "tabular text-caos-3xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap shrink-0 " +
        className
      }
      style={{
        color: readOnly ? "var(--caos-muted)" : "var(--caos-accent)",
        borderColor: readOnly ? "var(--caos-border)" : "color-mix(in srgb, var(--caos-accent) 40%, transparent)",
        background: readOnly ? "transparent" : "color-mix(in srgb, var(--caos-accent) 8%, transparent)",
      }}
    >
      {SCOPE_LABEL[scope]}
    </span>
  );
}
