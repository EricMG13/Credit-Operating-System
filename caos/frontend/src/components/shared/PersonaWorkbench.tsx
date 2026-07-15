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

export function PersonaWorkbench({
  surface,
  persona,
  decision,
  primary,
  context,
  inspector,
  utility,
  finalization,
  className = "",
}: PersonaWorkbenchProps) {
  const provider = useRoleView();
  const activePersona = persona ?? provider.roleView;
  const composition = getSurfaceComposition(surface, activePersona);
  const narrow = useNarrowWorkbench();
  const [activeDrawer, setActiveDrawer] = useState<DrawerSlot | null>(null);
  const [openPanels, setOpenPanels] = useState(() => (
    defaultPanelState(composition.defaultOpenPanels)
  ));
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

  const slots: Record<WorkbenchSlot, ReactNode> = {
    decision,
    primary,
    context: narrow || !openPanels.context ? null : context,
    inspector: narrow || !openPanels.inspector ? null : inspector,
    utility,
    finalization,
  };
  const supportOrder = composition.slotOrder.filter((slot): slot is DrawerSlot => {
    if (narrow || (slot !== "context" && slot !== "inspector")) return false;
    const supplied = slot === "context" ? context : inspector;
    return supplied !== null && supplied !== undefined && openPanels[slot];
  });
  const visibleSupportCount = supportOrder.length;
  const gridAreaFor = (slot: WorkbenchSlot) => {
    if (slot === supportOrder[0]) return "support-a";
    if (slot === supportOrder[1]) return "support-b";
    return slot;
  };
  const drawerContent = activeDrawer === "context" ? context : inspector;
  const drawerTitle = activeDrawer === "context" ? "Context" : "Evidence inspector";
  const drawerPanelId = activeDrawer === "context" ? contextPanelId : inspectorPanelId;
  const toggleSupportingPanel = (slot: DrawerSlot) => {
    if (narrow) {
      setActiveDrawer(slot);
      return;
    }
    setOpenPanels((current) => ({ ...current, [slot]: !current[slot] }));
  };

  return (
    <DominantTableOwnerGuard>
      <div
        data-testid="persona-workbench"
        data-surface={surface}
        data-persona={activePersona}
        data-dominant-representation={composition.dominantRepresentation}
        data-summary-density={composition.summaryDensity}
        data-default-open-panels={composition.defaultOpenPanels.join(" ")}
        data-table-column-preset={composition.tableColumnPreset}
        className={`persona-workbench ${className}`}
      >
        {context || inspector ? (
          <nav className="persona-workbench__drawer-triggers" aria-label="Workbench supporting panels">
            {context ? (
              <button
                type="button"
                aria-expanded={narrow ? activeDrawer === "context" : openPanels.context}
                aria-controls={contextPanelId}
                aria-label={narrow ? "Open context drawer" : `${openPanels.context ? "Collapse" : "Open"} context panel`}
                onClick={() => toggleSupportingPanel("context")}
                className="persona-workbench__drawer-trigger"
              >
                {narrow ? "Context" : <><span aria-hidden="true">{openPanels.context ? "▾ " : "▸ "}</span>Context</>}
              </button>
            ) : null}
            {inspector ? (
              <button
                type="button"
                aria-expanded={narrow ? activeDrawer === "inspector" : openPanels.inspector}
                aria-controls={inspectorPanelId}
                aria-label={narrow ? "Open evidence inspector drawer" : `${openPanels.inspector ? "Collapse" : "Open"} evidence inspector panel`}
                onClick={() => toggleSupportingPanel("inspector")}
                className="persona-workbench__drawer-trigger"
              >
                {narrow ? "Inspector" : <><span aria-hidden="true">{openPanels.inspector ? "▾ " : "▸ "}</span>Inspector</>}
              </button>
            ) : null}
          </nav>
        ) : null}

        <div
          className={`persona-workbench__composition persona-workbench__composition--supports-${visibleSupportCount}`}
          data-visible-support-count={visibleSupportCount}
        >
          {composition.slotOrder.map((slot) => slots[slot] ? (
            <section
              key={slot}
              id={slot === "context" ? contextPanelId : slot === "inspector" ? inspectorPanelId : undefined}
              className={`persona-workbench__slot persona-workbench__slot--${slot}`}
              data-slot={slot}
              data-grid-area={gridAreaFor(slot)}
              style={{ gridArea: gridAreaFor(slot) }}
            >
              {slots[slot]}
            </section>
          ) : null)}
        </div>

        {narrow && activeDrawer && drawerContent ? (
          <PersonaDrawer
            content={drawerContent}
            onClose={() => setActiveDrawer(null)}
            panelId={drawerPanelId}
            title={drawerTitle}
            titleId={drawerTitleId}
          />
        ) : null}
      </div>
    </DominantTableOwnerGuard>
  );
}
