// Shared className tokens — string constants for the small handful of utility
// recipes that recur verbatim across the workspace. Co-located here (not a
// component) because callers apply them to different elements (<span>, <div>,
// <th>) and append their own layout classes, e.g. `labelCls + " mb-1.5"`.
// Sibling of INPUT_BASE in TextInput.tsx.

// The small uppercase letter-spaced muted label — the field/section caption
// idiom (see Design Context · Type). Size (text-caos-2xs is the dominant form)
// and trailing layout classes are the caller's to append.
export const labelCls = "tabular text-caos-2xs uppercase tracking-wider text-caos-muted";
