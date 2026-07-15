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
          return (
            <div key={si} className="rounded border border-caos-border bg-caos-bg">
              <div className="px-3 py-2 border-b border-caos-border tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text">{s.title}</div>
              <div className="deepdive-output-table-scroll">
                <table className="deepdive-output-table" aria-label={s.title}>
                  <thead>
                    <tr>
                      {s.cols.map((c, i) => (
                        <th key={i} scope="col" className={s.align && s.align[i] ? "text-right" : "text-left"}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((cell, ci) => (
                          <td key={ci} className={(ci === 0 ? "text-caos-text" : "tabular text-caos-text/90") + (s.align && s.align[ci] ? " text-right" : " text-left")}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        if (s.type === "flags") {
          return (
            <div key={si} className="rounded border border-caos-border bg-caos-bg">
              <div className="px-3 py-2 border-b border-caos-border tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text">{s.title}</div>
              {s.items.map((f, fi) => (
                <div key={fi} className="px-3 py-1.5 border-b border-caos-border/50 flex items-start gap-2">
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
