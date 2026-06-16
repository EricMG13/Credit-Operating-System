"use client";

// Shared section renderer for module outputs + step outputs
// (port of design bundle concept-c-views.jsx OutSections).

import type { OutSection } from "@/lib/deepdive/module-outputs";
import { EvChip } from "@/components/reports/EvidenceModal";
import { Dot } from "@/components/pipeline/atoms";

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
          const gridCols = s.cols.map((_, i) => (i === 0 ? "minmax(140px,1.4fr)" : "1fr")).join(" ");
          return (
            <div key={si} className="rounded border border-caos-border bg-caos-bg">
              <div className="px-3 py-2 border-b border-caos-border tabular text-caos-xs uppercase tracking-wider text-caos-muted">{s.title}</div>
              <div className="grid gap-x-3 px-3 h-7 items-center border-b border-caos-border" style={{ gridTemplateColumns: gridCols }}>
                {s.cols.map((c, i) => (
                  <span key={i} className={"tabular text-caos-xs uppercase tracking-wider text-caos-muted " + (s.align && s.align[i] ? "text-right" : "")}>{c}</span>
                ))}
              </div>
              {s.rows.map((r, ri) => (
                <div key={ri} className="grid gap-x-3 px-3 py-[5.5px] items-center border-b border-caos-border/50 hover:bg-caos-elevated/40 transition-caos" style={{ gridTemplateColumns: gridCols }}>
                  {r.map((cell, ci) => (
                    <span key={ci} className={(ci === 0 ? "text-caos-lg text-caos-text" : "tabular text-caos-lg text-caos-text/90") + (s.align && s.align[ci] ? " text-right" : "") + " leading-snug"}>{cell}</span>
                  ))}
                </div>
              ))}
            </div>
          );
        }
        if (s.type === "flags") {
          return (
            <div key={si} className="rounded border border-caos-border bg-caos-bg">
              <div className="px-3 py-2 border-b border-caos-border tabular text-caos-xs uppercase tracking-wider text-caos-muted">{s.title}</div>
              {s.items.map((f, fi) => (
                <div key={fi} className="px-3 py-[7px] border-b border-caos-border/50 flex items-start gap-2">
                  <Dot sev={f.sev} />
                  <span className="text-caos-lg text-caos-text leading-snug flex-1">
                    {f.text}
                    {f.ev && f.ev.length ? (
                      <span className="inline-flex gap-1 ml-1.5 align-middle">
                        {f.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={si} className="rounded border border-caos-border bg-caos-bg px-3 py-2.5">
            <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1">{s.title}</div>
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
