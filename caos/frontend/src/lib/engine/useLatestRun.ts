// Shared "latest complete run" loader behind useLiveRun / useModelEngine /
// useLivePipeline. Loads the latest COMPLETE run for an issuer, builds T from it,
// and on no run / no backend / any error returns `empty` — the "prefer live,
// static fallback" contract every live hook shares. Side-effect-free (never
// creates a run) and cancel-safe (a stale issuerId can't clobber a newer load).

import { useEffect, useState } from "react";
import { listRuns } from "@/lib/api";
import type { RunListItemDTO } from "@/lib/engine/types";

export function useLatestRun<T>(
  issuerId: string,
  initial: T,
  empty: T,
  build: (latest: RunListItemDTO) => Promise<T>,
): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runs = await listRuns(issuerId);
        const latest = runs.find((r) => r.status === "complete");
        if (!latest) {
          if (!cancelled) setValue(empty);
          return;
        }
        const next = await build(latest);
        if (!cancelled) setValue(next);
      } catch {
        if (!cancelled) setValue(empty); // no backend / network error → static fallback
      }
    })();
    return () => {
      cancelled = true;
    };
    // build/empty are recreated each render by callers; issuerId is the only real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuerId]);

  return value;
}
