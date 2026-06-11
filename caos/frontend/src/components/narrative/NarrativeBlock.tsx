"use client";

import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EvidenceLink } from "@/types/analysis";
import { useSelectionStore } from "@/store/selection";
import { parseCitations } from "@/lib/citations";

/**
 * Renders agent-authored markdown narrative and turns inline `[[cite:n]]`
 * markers into interactive citation badges linked to evidence_chain[n].
 *
 * Hardened: malformed / out-of-range / unterminated citation strings degrade
 * to inert text — they must never throw (Blueprint §7.1).
 */

function CitationBadge({
  index,
  conclusionId,
  link,
}: {
  index: number;
  conclusionId: string;
  link?: EvidenceLink;
}) {
  const { select, conclusionId: activeId, linkIndex } = useSelectionStore();
  const active = activeId === conclusionId && linkIndex === index;
  const label = link?.source_doc ?? "source";
  return (
    <button
      data-testid="citation-badge"
      data-conclusion-id={conclusionId}
      onClick={() => select(conclusionId, "narrative", index)}
      title={link ? `${link.source_doc}` : "Unresolved citation"}
      className={`tabular align-baseline mx-0.5 px-1.5 py-0.5 rounded text-[10px] border transition-caos ${
        link
          ? active
            ? "bg-caos-accent/20 border-caos-accent text-caos-accent"
            : "bg-caos-elevated border-caos-border text-caos-accent hover:border-caos-accent"
          : "bg-caos-elevated border-caos-border text-caos-muted cursor-help"
      }`}
    >
      {link ? `§ ${label}` : "§ ?"}
    </button>
  );
}

/** Split a text node on [[cite:n]] markers, interleaving badges. */
function withCitations(text: string, conclusionId: string, chain: EvidenceLink[]): ReactNode[] {
  return parseCitations(text).map((seg, key) =>
    seg.type === "text" ? (
      <Fragment key={key}>{seg.value}</Fragment>
    ) : (
      <CitationBadge
        key={key}
        index={seg.index}
        conclusionId={conclusionId}
        link={Number.isInteger(seg.index) ? chain[seg.index] : undefined}
      />
    )
  );
}

/** Recursively transform string children, leaving element children intact. */
function transformChildren(children: ReactNode, conclusionId: string, chain: EvidenceLink[]): ReactNode {
  if (typeof children === "string") return withCitations(children, conclusionId, chain);
  if (Array.isArray(children))
    return children.map((c, i) => <Fragment key={i}>{transformChildren(c, conclusionId, chain)}</Fragment>);
  return children;
}

export function NarrativeBlock({
  markdown,
  conclusionId,
  chain = [],
}: {
  markdown: string;
  conclusionId: string;
  chain?: EvidenceLink[];
}) {
  const tx = (children: ReactNode) => transformChildren(children, conclusionId, chain);
  return (
    <div className="narrative-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Allow-listed renderers only (no raw HTML / MDX execution).
          p: ({ children }) => <p>{tx(children)}</p>,
          li: ({ children }) => <li>{tx(children)}</li>,
          strong: ({ children }) => <strong>{tx(children)}</strong>,
          em: ({ children }) => <em>{tx(children)}</em>,
          h3: ({ children }) => <h3>{tx(children)}</h3>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
