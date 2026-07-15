export const DEFAULT_WARN_ON_UNSAVED_LEAVE = true;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function readWarnOnUnsavedLeave(settings: { workspace?: Record<string, unknown> }): boolean {
  const workspace = asRecord(settings.workspace);
  const modelBuilder = asRecord(workspace?.model_builder);
  return typeof modelBuilder?.warn_on_unsaved_leave === "boolean"
    ? modelBuilder.warn_on_unsaved_leave
    : DEFAULT_WARN_ON_UNSAVED_LEAVE;
}

export function writeWarnOnUnsavedLeave(
  workspace: Record<string, unknown>,
  enabled: boolean,
): Record<string, unknown> {
  const current = asRecord(workspace.model_builder) ?? {};
  return {
    ...workspace,
    model_builder: {
      ...current,
      warn_on_unsaved_leave: enabled,
    },
  };
}
