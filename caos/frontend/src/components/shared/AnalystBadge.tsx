"use client";

// The signed-in analyst's initials, parked at the right of every concept header
// (PageSubHeader). Click to sign out (clears the profile cookie → login landing).
// Only renders for a real profile identity; proxy/local fallbacks show nothing.

import { useState } from "react";
import { useAuth } from "@/components/shared/AuthProvider";
import { clearWorkspaceStorage, logout } from "@/lib/api";
import { initials } from "@/lib/format";

export function AnalystBadge() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user || user.source !== "profile") return null;

  const signOut = async () => {
    if (busy) return;
    if (!window.confirm(`Sign out ${user.full_name}?`)) return;
    setBusy(true);
    try {
      await logout();
      clearWorkspaceStorage(); // don't leak this analyst's workspace state to the next login
      await refresh(); // re-resolve → RequireAuth shows the login landing (unmounts this)
    } catch {
      // Logout failed (network/timeout): the cookie is still valid, so reset busy
      // and surface it — otherwise the button stays disabled for the rest of the
      // session with no way to retry short of a full reload. SEAM4-5.
      setBusy(false);
      window.alert("Sign-out failed — check your connection and try again.");
    }
  };

  return (
    <button
      onClick={signOut}
      disabled={busy}
      title={`Signed in as ${user.full_name} — click to sign out`}
      aria-label={`Signed in as ${user.full_name}. Sign out.`}
      className="ml-auto shrink-0 inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded bg-caos-elevated border border-caos-border tabular text-caos-sm font-semibold text-caos-text hover:border-caos-accent hover:text-caos-accent transition-caos focus-ring disabled:opacity-50"
    >
      {initials(user.full_name)}
    </button>
  );
}
