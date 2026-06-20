"use client";

// The Markdown body of a Deep Research report. Isolated so react-markdown +
// remark-gfm (~40 kB) can be code-split with next/dynamic — they're only needed
// once a multi-minute run resolves, never for the empty brief form. Styled as
// the paper tear-sheet by the .research-doc rules in globals.css.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      }}
    >
      {report}
    </ReactMarkdown>
  );
}
