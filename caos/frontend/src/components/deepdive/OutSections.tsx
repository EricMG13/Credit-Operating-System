"use client";

// Shared section renderer for module outputs + step outputs
// (port of design bundle concept-c-views.jsx OutSections).

import type { OutSection } from "@/lib/deepdive/module-outputs";
import { EvChip } from "@/components/reports/EvChip";
import { Dot } from "@/components/pipeline/atoms";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { useState } from "react";

// Live adapters retain bounded first-paint rows/items here rather than dropping
// them. The base OutSection contract stays backward-compatible for seeded views;
// this additive payload is emitted only by the live adapter.
type ExpandableOutSection = OutSection & {
  overflowRows?: string[][];
  overflowItems?: { sev: string; text: string; ev?: string[] }[];
};

function MoreButton({ count, expanded, onToggle, controls }: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  controls: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      className="m-2 tabular text-caos-xs text-caos-accent hover:text-caos-text focus-ring"
    >
      {expanded ? "Show fewer" : `+${count} more`}
    </button>
  );
}

function TableSection({ section, index }: { section: Extract<OutSection, { type: "table" }>; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const overflowRows = (section as ExpandableOutSection).overflowRows ?? [];
  const rows = expanded ? [...section.rows, ...overflowRows] : section.rows;
  const contentId = `deepdive-output-${index}`;
  const columns: DataTableColumn<string[]>[] = section.cols.map((column, ci) => ({
    key: `${ci}-${column}`,
    header: column,
    align: section.align?.[ci] ? "numeric" : "text",
    rowHeader: ci === 0,
    render: (row) => (
      <span className={ci === 0 ? "text-caos-text" : "text-caos-text/90"}>
        {row[ci]}
      </span>
    ),
  }));
  return (
    <div className="rounded border border-caos-border bg-caos-bg">
      <div className="px-3 py-2 border-b border-caos-border tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text">{section.title}</div>
      <div id={contentId} className="deepdive-output-table-scroll">
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(_row, ri) => `${index}-${ri}`}
          caption={section.title}
          className="deepdive-output-table"
        />
      </div>
      {overflowRows.length ? <MoreButton count={overflowRows.length} expanded={expanded} onToggle={() => setExpanded((open) => !open)} controls={contentId} /> : null}
    </div>
  );
}

function FlagSection({ section, index, onOpenEvidence }: {
  section: Extract<OutSection, { type: "flags" }>;
  index: number;
  onOpenEvidence: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflowItems = (section as ExpandableOutSection).overflowItems ?? [];
  const items = expanded ? [...section.items, ...overflowItems] : section.items;
  const contentId = `deepdive-output-${index}`;
  return (
    <div className="rounded border border-caos-border bg-caos-bg">
      <div className="px-3 py-2 border-b border-caos-border tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text">{section.title}</div>
      <div id={contentId}>
        {items.map((flag, itemIndex) => (
          <div key={itemIndex} className="px-3 py-1.5 border-b border-caos-border/50 flex items-start gap-2">
            <Dot sev={flag.sev} />
            <span className="text-caos-lg text-caos-text leading-snug flex-1">
              {flag.text}
              {flag.ev && flag.ev.length ? (
                <span className="inline-flex gap-1 ml-1.5 align-middle">
                  {flag.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {overflowItems.length ? <MoreButton count={overflowItems.length} expanded={expanded} onToggle={() => setExpanded((open) => !open)} controls={contentId} /> : null}
    </div>
  );
}

export function OutSections({
  sections,
  onOpenEvidence,
}: {
  sections: OutSection[];
  onOpenEvidence: (id: string) => void;
}) {
  return (
    <>
      {sections.map((s, si) => {
        if (s.type === "table") {
          return <TableSection key={si} section={s} index={si} />;
        }
        if (s.type === "flags") {
          return <FlagSection key={si} section={s} index={si} onOpenEvidence={onOpenEvidence} />;
        }
        return (
          <div key={si} className="rounded border border-caos-border bg-caos-bg px-3 py-2.5">
            <div className="tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text mb-1">{s.title}</div>
            <div className="text-caos-xl text-caos-text leading-relaxed">
              {s.body}
              {s.ev && s.ev.length ? (
                <span className="inline-flex gap-1 ml-1.5 align-middle">
                  {s.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
