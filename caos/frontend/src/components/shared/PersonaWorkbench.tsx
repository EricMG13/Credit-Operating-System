"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import type { AnalysisSurfaceName } from "@/lib/analysis-workbench";
import type { RoleView } from "@/lib/api";
import { getSurfaceComposition, type SurfaceComposition, type WorkbenchSlot } from "@/lib/persona-composition";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { useScrollOwner } from "@/lib/use-scroll-owner";
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
  /** Keep an emphasized context/inspector slot in the narrow composition.
   * Opt-in for governance surfaces whose leading control plane must not become
   * a closed drawer at tablet/small-laptop widths. */
  retainEmphasizedSupportOnNarrow?: boolean;
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

const WorkbenchCompositionContext = createContext<SurfaceComposition | null>(null);

export function usePersonaComposition(surface: AnalysisSurfaceName, persona?: RoleView): SurfaceComposition {
  const provider = useRoleView();
  return getSurfaceComposition(surface, persona ?? provider.roleView);
}

/** @deprecated Prefer the public usePersonaComposition name. */
export const useSurfaceComposition = usePersonaComposition;

export function useWorkbenchComposition(): SurfaceComposition {
  const composition = useContext(WorkbenchCompositionContext);
  if (!composition) throw new Error("useWorkbenchComposition must be used within PersonaWorkbench");
  return composition;
}

function usePersonaWorkbenchState(surface: AnalysisSurfaceName, activePersona: RoleView, composition: SurfaceComposition) {
  const narrow = useNarrowWorkbench();
  const [activeDrawer, setActiveDrawer] = useState<DrawerSlot | null>(null);
  const panelDefaultsKey = `${surface}:${activePersona}`;
  const [panelState, setPanelState] = useState(() => ({
    key: panelDefaultsKey,
    panels: defaultPanelState(composition.defaultOpenPanels),
  }));
  const openPanels = panelState.key === panelDefaultsKey
    ? panelState.panels
    : defaultPanelState(composition.defaultOpenPanels);
  const drawerTitleId = useId();
  const contextPanelId = useId();
  const inspectorPanelId = useId();

  useLayoutEffect(() => {
    setPanelState((current) => current.key === panelDefaultsKey
      ? current
      : { key: panelDefaultsKey, panels: defaultPanelState(composition.defaultOpenPanels) });
    setActiveDrawer(null);
  }, [composition.defaultOpenPanels, panelDefaultsKey]);

  useEffect(() => {
    if (!narrow) setActiveDrawer(null);
  }, [narrow]);

  const toggleSupportingPanel = (slot: DrawerSlot) => {
    if (narrow) setActiveDrawer(slot);
    else setPanelState((current) => {
      const panels = current.key === panelDefaultsKey
        ? current.panels
        : defaultPanelState(composition.defaultOpenPanels);
      return { key: panelDefaultsKey, panels: { ...panels, [slot]: !panels[slot] } };
    });
  };
  return { activeDrawer, contextPanelId, drawerTitleId, inspectorPanelId, narrow, openPanels, setActiveDrawer, toggleSupportingPanel };
}

type WorkbenchState = ReturnType<typeof usePersonaWorkbenchState>;

function retainedNarrowSupport(props: PersonaWorkbenchProps, state: WorkbenchState, composition: SurfaceComposition): DrawerSlot | null {
  if (!props.retainEmphasizedSupportOnNarrow || !state.narrow) return null;
  const slot = composition.emphasizedSlot;
  if (slot === "context" && props.context) return slot;
  if (slot === "inspector" && props.inspector) return slot;
  return null;
}

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

function workbenchSlots(props: PersonaWorkbenchProps, state: WorkbenchState, composition: SurfaceComposition): Record<WorkbenchSlot, ReactNode> {
  const retained = retainedNarrowSupport(props, state, composition);
  return {
    decision: props.decision,
    primary: props.primary,
    context: (state.narrow && retained !== "context") || !state.openPanels.context ? null : props.context,
    inspector: (state.narrow && retained !== "inspector") || !state.openPanels.inspector ? null : props.inspector,
    utility: props.utility,
    finalization: props.finalization,
  };
}

function visibleSupportOrder(composition: SurfaceComposition, props: PersonaWorkbenchProps, state: WorkbenchState): DrawerSlot[] {
  if (state.narrow) {
    const retained = retainedNarrowSupport(props, state, composition);
    return retained ? [retained] : [];
  }
  return composition.slotOrder.filter((slot): slot is DrawerSlot => {
    if (slot !== "context" && slot !== "inspector") return false;
    const supplied = slot === "context" ? props.context : props.inspector;
    return supplied !== null && supplied !== undefined && state.openPanels[slot];
  });
}

function WorkbenchComposition({ composition, props, state }: { composition: SurfaceComposition; props: PersonaWorkbenchProps; state: WorkbenchState }) {
  const slots = workbenchSlots(props, state, composition);
  const supportOrder = visibleSupportOrder(composition, props, state);
  const gridAreaFor = (slot: WorkbenchSlot) => {
    if (slot === supportOrder[0]) return "support-a";
    if (slot === supportOrder[1]) return "support-b";
    return slot;
  };
  return (
    <div className={`persona-workbench__composition persona-workbench__composition--supports-${supportOrder.length}`} data-visible-support-count={supportOrder.length}>
      {composition.slotOrder.map((slot) => slots[slot] ? (
        <WorkbenchSlotSection key={slot} slot={slot} content={slots[slot]} composition={composition} state={state} gridArea={gridAreaFor(slot)} />
      ) : null)}
    </div>
  );
}

function WorkbenchSlotSection({
  slot,
  content,
  composition,
  state,
  gridArea,
}: {
  slot: WorkbenchSlot;
  content: ReactNode;
  composition: SurfaceComposition;
  state: WorkbenchState;
  gridArea: string;
}) {
  const scrollOwner = useScrollOwner<HTMLElement>();
  const label = slot === "primary"
    ? "Primary workbench"
    : slot === "inspector"
      ? "Evidence inspector"
      : slot === "context"
        ? "Workbench context"
        : `${slot} workbench region`;
  return (
    <section
      ref={scrollOwner.ref}
      id={slot === "context" ? state.contextPanelId : slot === "inspector" ? state.inspectorPanelId : undefined}
      role={scrollOwner.scrollable ? "region" : undefined}
      tabIndex={scrollOwner.scrollable ? 0 : undefined}
      aria-label={scrollOwner.scrollable ? label : undefined}
      className={`persona-workbench__slot persona-workbench__slot--${slot} ${composition.emphasizedSlot === slot ? "persona-workbench__slot--emphasized" : ""}${scrollOwner.scrollable ? " focus-ring" : ""}`}
      data-slot={slot}
      data-emphasized={composition.emphasizedSlot === slot}
      data-grid-area={gridArea}
      style={{ gridArea }}
    >
      {content}
    </section>
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
  const retained = retainedNarrowSupport(props, state, composition);
  return (
    <div data-testid="persona-workbench" data-surface={props.surface} data-persona={activePersona} data-dominant-representation={composition.dominantRepresentation} data-summary-density={composition.summaryDensity} data-default-open-panels={composition.defaultOpenPanels.join(" ")} data-table-column-preset={composition.tableColumnPreset} className={`persona-workbench persona-workbench--density-${composition.summaryDensity} persona-workbench--emphasis-${composition.emphasizedSlot} ${props.className ?? ""}`}>
      <SupportingPanelNav context={retained === "context" ? undefined : props.context} inspector={retained === "inspector" ? undefined : props.inspector} state={state} />
      <WorkbenchComposition composition={composition} props={props} state={state} />
      <ActivePersonaDrawer context={props.context} inspector={props.inspector} state={state} />
    </div>
  );
}

export function PersonaWorkbench(props: PersonaWorkbenchProps) {
  const composition = usePersonaComposition(props.surface, props.persona);
  const activePersona = composition.persona;
  const state = usePersonaWorkbenchState(props.surface, activePersona, composition);
  return (
    <WorkbenchCompositionContext.Provider value={composition}>
      <DominantTableOwnerGuard>
        <PersonaWorkbenchView activePersona={activePersona} composition={composition} props={props} state={state} />
      </DominantTableOwnerGuard>
    </WorkbenchCompositionContext.Provider>
  );
}
