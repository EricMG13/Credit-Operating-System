"use client";

import {
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import type { AnalysisSurfaceName } from "@/lib/analysis-workbench";
import type { RoleView } from "@/lib/api";
import { getSurfaceComposition, type WorkbenchSlot } from "@/lib/persona-composition";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { ModalBackdrop } from "./ModalBackdrop";
import { useRoleView } from "./RoleViewProvider";
import { DominantTableOwnerGuard } from "./DominantTableRegion";

type DrawerSlot = "context" | "inspector";

export interface PersonaWorkbenchProps {
  surface: AnalysisSurfaceName;
  persona?: RoleView;
  decision?: ReactNode;
  primary: ReactNode;
  context?: ReactNode;
  inspector?: ReactNode;
  utility?: ReactNode;
  finalization?: ReactNode;
  className?: string;
}

function useNarrowWorkbench() {
  // At 1024px the two supporting columns compress the dominant artifact and
  // clip dense decision cells. Treat tablet/small-laptop widths as drawer mode;
  // 1100px+ retains the multi-column desk composition.
  const query = "(max-width: 1099px)";
  // Keep the server and first hydrated client snapshot identical. The media
  // query is applied only after mount, preserving the primary subtree through
  // the responsive composition change.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

function defaultPanelState(defaultOpenPanels: readonly string[]) {
  return {
    context: defaultOpenPanels.includes("context"),
    inspector: defaultOpenPanels.includes("inspector"),
  };
}

function PersonaDrawer({
  content,
  onClose,
  panelId,
  title,
  titleId,
}: {
  content: ReactNode;
  onClose: () => void;
  panelId: string;
  title: string;
  titleId: string;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <ModalBackdrop onClose={onClose} align="end" className="persona-workbench__drawer-layer">
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="persona-workbench__drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="persona-workbench__drawer-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            aria-label={`Close ${title.toLowerCase()} drawer`}
            onClick={onClose}
            className="persona-workbench__drawer-close"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div className="persona-workbench__drawer-body">{content}</div>
      </div>
    </ModalBackdrop>
  );
}

type SurfaceComposition = ReturnType<typeof getSurfaceComposition>;

function usePersonaWorkbenchState(surface: AnalysisSurfaceName, activePersona: RoleView, composition: SurfaceComposition) {
  const narrow = useNarrowWorkbench();
  const [activeDrawer, setActiveDrawer] = useState<DrawerSlot | null>(null);
  const [openPanels, setOpenPanels] = useState(() => defaultPanelState(composition.defaultOpenPanels));
  const drawerTitleId = useId();
  const contextPanelId = useId();
  const inspectorPanelId = useId();

  useEffect(() => {
    setOpenPanels(defaultPanelState(composition.defaultOpenPanels));
    setActiveDrawer(null);
  }, [activePersona, composition.defaultOpenPanels, surface]);

  useEffect(() => {
    if (!narrow) setActiveDrawer(null);
  }, [narrow]);

  const toggleSupportingPanel = (slot: DrawerSlot) => {
    if (narrow) setActiveDrawer(slot);
    else setOpenPanels((current) => ({ ...current, [slot]: !current[slot] }));
  };
  return { activeDrawer, contextPanelId, drawerTitleId, inspectorPanelId, narrow, openPanels, setActiveDrawer, toggleSupportingPanel };
}

type WorkbenchState = ReturnType<typeof usePersonaWorkbenchState>;

function SupportTrigger({ slot, state }: { slot: DrawerSlot; state: WorkbenchState }) {
  const context = slot === "context";
  const title = context ? "Context" : "Inspector";
  const expanded = state.narrow ? state.activeDrawer === slot : state.openPanels[slot];
  const panelId = context ? state.contextPanelId : state.inspectorPanelId;
  const drawerLabel = context ? "Open context drawer" : "Open evidence inspector drawer";
  const panelLabel = `${state.openPanels[slot] ? "Collapse" : "Open"} ${context ? "context" : "evidence inspector"} panel`;
  return (
    <button type="button" aria-expanded={expanded} aria-controls={panelId} aria-label={state.narrow ? drawerLabel : panelLabel} onClick={() => state.toggleSupportingPanel(slot)} className="persona-workbench__drawer-trigger">
      {state.narrow ? title : <><span aria-hidden="true">{state.openPanels[slot] ? "▾ " : "▸ "}</span>{title}</>}
    </button>
  );
}

function SupportingPanelNav({ context, inspector, state }: { context?: ReactNode; inspector?: ReactNode; state: WorkbenchState }) {
  if (!context && !inspector) return null;
  return (
    <nav className="persona-workbench__drawer-triggers" aria-label="Workbench supporting panels">
      {context ? <SupportTrigger slot="context" state={state} /> : null}
      {inspector ? <SupportTrigger slot="inspector" state={state} /> : null}
    </nav>
  );
}

function workbenchSlots(props: PersonaWorkbenchProps, state: WorkbenchState): Record<WorkbenchSlot, ReactNode> {
  return {
    decision: props.decision,
    primary: props.primary,
    context: state.narrow || !state.openPanels.context ? null : props.context,
    inspector: state.narrow || !state.openPanels.inspector ? null : props.inspector,
    utility: props.utility,
    finalization: props.finalization,
  };
}

function visibleSupportOrder(composition: SurfaceComposition, props: PersonaWorkbenchProps, state: WorkbenchState): DrawerSlot[] {
  if (state.narrow) return [];
  return composition.slotOrder.filter((slot): slot is DrawerSlot => {
    if (slot !== "context" && slot !== "inspector") return false;
    const supplied = slot === "context" ? props.context : props.inspector;
    return supplied !== null && supplied !== undefined && state.openPanels[slot];
  });
}

function WorkbenchComposition({ composition, props, state }: { composition: SurfaceComposition; props: PersonaWorkbenchProps; state: WorkbenchState }) {
  const slots = workbenchSlots(props, state);
  const supportOrder = visibleSupportOrder(composition, props, state);
  const gridAreaFor = (slot: WorkbenchSlot) => {
    if (slot === supportOrder[0]) return "support-a";
    if (slot === supportOrder[1]) return "support-b";
    return slot;
  };
  return (
    <div className={`persona-workbench__composition persona-workbench__composition--supports-${supportOrder.length}`} data-visible-support-count={supportOrder.length}>
      {composition.slotOrder.map((slot) => slots[slot] ? (
        <section key={slot} id={slot === "context" ? state.contextPanelId : slot === "inspector" ? state.inspectorPanelId : undefined} className={`persona-workbench__slot persona-workbench__slot--${slot}`} data-slot={slot} data-grid-area={gridAreaFor(slot)} style={{ gridArea: gridAreaFor(slot) }}>
          {slots[slot]}
        </section>
      ) : null)}
    </div>
  );
}

function ActivePersonaDrawer({ context, inspector, state }: { context?: ReactNode; inspector?: ReactNode; state: WorkbenchState }) {
  if (!state.narrow || !state.activeDrawer) return null;
  const contextDrawer = state.activeDrawer === "context";
  const content = contextDrawer ? context : inspector;
  if (!content) return null;
  return (
    <PersonaDrawer content={content} onClose={() => state.setActiveDrawer(null)} panelId={contextDrawer ? state.contextPanelId : state.inspectorPanelId} title={contextDrawer ? "Context" : "Evidence inspector"} titleId={state.drawerTitleId} />
  );
}

function PersonaWorkbenchView({ activePersona, composition, props, state }: { activePersona: RoleView; composition: SurfaceComposition; props: PersonaWorkbenchProps; state: WorkbenchState }) {
  return (
    <div data-testid="persona-workbench" data-surface={props.surface} data-persona={activePersona} data-dominant-representation={composition.dominantRepresentation} data-summary-density={composition.summaryDensity} data-default-open-panels={composition.defaultOpenPanels.join(" ")} data-table-column-preset={composition.tableColumnPreset} className={`persona-workbench ${props.className ?? ""}`}>
      <SupportingPanelNav context={props.context} inspector={props.inspector} state={state} />
      <WorkbenchComposition composition={composition} props={props} state={state} />
      <ActivePersonaDrawer context={props.context} inspector={props.inspector} state={state} />
    </div>
  );
}

export function PersonaWorkbench(props: PersonaWorkbenchProps) {
  const provider = useRoleView();
  const activePersona = props.persona ?? provider.roleView;
  const composition = getSurfaceComposition(props.surface, activePersona);
  const state = usePersonaWorkbenchState(props.surface, activePersona, composition);
  return (
    <DominantTableOwnerGuard>
      <PersonaWorkbenchView activePersona={activePersona} composition={composition} props={props} state={state} />
    </DominantTableOwnerGuard>
  );
}
