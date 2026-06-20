"use client";

// Shared CAOS panel chrome: 32px uppercase header bar + scrollable body.
// Single source of truth for the panel idiom used across all sections
// (command, pipeline, deep-dive, reports, directory, intake).

export function Panel({
  title,
  right,
  children,
  className = "",
  as: Heading = "h2",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Heading level for the title — a panel is a section, so its title is a real
   *  heading (WCAG 1.3.1 / 2.4.6). Use "h3" for a panel nested in another's body. */
  as?: "h2" | "h3";
}) {
  return (
    <div className={"bg-caos-panel border border-caos-border rounded-md flex flex-col min-h-0 " + className}>
      <div className="h-8 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border">
        <Heading className="text-caos-md font-semibold tracking-[0.12em] uppercase text-caos-muted m-0">{title}</Heading>
        <div className="flex-1" />
        {right}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
