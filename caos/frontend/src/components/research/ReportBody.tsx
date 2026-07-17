"use client";

// The Markdown body of a Deep Research report. Isolated so react-markdown +
// remark-gfm (~40 kB) can be code-split with next/dynamic — they're only needed
// once a multi-minute run resolves, never for the empty brief form. Styled as
// the paper tear-sheet by the .research-doc rules in globals.css.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const hasRightAlignment = (node: unknown) =>
  typeof node === "object" && node !== null
  && "properties" in node
  && typeof node.properties === "object" && node.properties !== null
  && "align" in node.properties
  && node.properties.align === "right";

export default function ReportBody({ report }: { report: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">{children}</a>
        ),
        // Wrap model-emitted tables so a wide one scrolls within the sheet
        // rather than overflowing it (mono headers don't wrap).
        table: ({ children }) => (
          <div className="rdoc-table-scroll"><table>{children}</table></div>
        ),
        // GFM carries an explicit column alignment from the separator row
        // (for example `---:`). Preserve that authored numeric alignment;
        // never infer it from the cell's text.
        th: ({ node, children }) => <th className={hasRightAlignment(node) ? "rdoc-num" : undefined}>{children}</th>,
        td: ({ node, children }) => <td className={hasRightAlignment(node) ? "rdoc-num" : undefined}>{children}</td>,
      }}
    >
      {report}
    </ReactMarkdown>
  );
}
