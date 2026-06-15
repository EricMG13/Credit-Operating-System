"use client";

// Shared CAOS panel chrome: 32px uppercase header bar + scrollable body.
// Single source of truth for the panel idiom used across all sections
// (command, pipeline, deep-dive, reports, directory, intake).

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"bg-caos-panel border border-caos-border rounded-md flex flex-col min-h-0 " + className}>
      <div className="h-8 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border">
        <span className="text-caos-md font-semibold tracking-[0.12em] uppercase text-caos-muted">{title}</span>
        <div className="flex-1" />
        {right}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
