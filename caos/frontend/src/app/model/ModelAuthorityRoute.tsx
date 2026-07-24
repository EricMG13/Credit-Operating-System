"use client";

import { Suspense, lazy, useCallback, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { useModelAuthority } from "@/lib/engine/useModelAuthority";
import type { LegacyModelRuntime } from "./LegacyCalculatorBridge";
import type { ModelV2Workbench as ModelV2WorkbenchComponent } from "./ModelV2Workbench";

const LazyLegacyCalculatorBridge = lazy(() => import("./LegacyCalculatorBridge"));
const LazyModelV2Workbench = lazy(() =>
  import("./ModelV2Workbench").then((m) => ({ default: m.ModelV2Workbench }))
);

interface ModelAuthorityRouteProps {
  renderLegacy?: (runtime: LegacyModelRuntime) => ReactNode;
  renderV2?: (props: {
    issuerId: string;
    contextId: string | null;
    exactRunId: string | null;
    initialResponse: Parameters<typeof ModelV2WorkbenchComponent>[0]["initialResponse"];
  }) => ReactNode;
}

/** Route-level authority boundary: legacy is restricted to the explicit reference issuer. */
export function ModelAuthorityRoute({
  renderLegacy = () => null,
  renderV2 = (props) => (
    <Suspense fallback={<ModelAuthorityState loading />}>
      <LazyModelV2Workbench key={`${props.issuerId}|${props.exactRunId ?? "latest"}`} {...props} />
    </Suspense>
  ),
}: ModelAuthorityRouteProps = {}) {
  const searchParams = useSearchParams();
  const issuerId = searchParams.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const contextId = searchParams.get("context");
  const exactRunId = searchParams.get("run");
  const confirmLegacy = useCallback(() => true, []);
  const authority = useModelAuthority({ issuerId, exactRunId, buildLegacyModel: confirmLegacy });

  if (authority.mode === "v2-confirmed") {
    return renderV2({
      issuerId,
      contextId,
      exactRunId,
      initialResponse: authority.response,
    });
  }
  if (authority.mode === "legacy-confirmed") {
    return (
      <Suspense fallback={<ModelAuthorityState loading />}>
        <LazyLegacyCalculatorBridge>{renderLegacy}</LazyLegacyCalculatorBridge>
      </Suspense>
    );
  }
  return <ModelAuthorityState loading={authority.reason === "authority-loading"} />;
}

function ModelAuthorityState({ loading }: { loading: boolean }) {
  return (
    <EnterprisePage
      kind="editor"
      identity={<ShellIdentity tag="MODEL" title="Model calculation authority" />}
      narrowContract={{ essentialControls: null }}
    >
      <div className="p-3">
        <SurfaceState
          kind={loading ? "loading" : "error"}
          headingLevel={2}
          title={loading ? "Resolving model authority" : "Model authority unavailable"}
          detail={loading
            ? "Checking the persisted workspace capability before loading a calculator."
            : "Model Engine v2 is not available for this issuer. The legacy fixture calculator is restricted to the Atlas Forge reference issuer and was not loaded."}
        />
      </div>
    </EnterprisePage>
  );
}
