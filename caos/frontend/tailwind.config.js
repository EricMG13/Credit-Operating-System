/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        caos: {
          bg: "#0a0a0f",
          panel: "#11131d",
          elevated: "#1d2030",
          border: "#34384a",
          text: "#e6e6ef",
          muted: "#a1a1b5",
          accent: "#63a1ff",
          consumer: "#c4b5fd", // downstream-consumer signal (mirrors --caos-consumer)
          // Semantic status — previously only reachable as CSS vars / inline styles.
          warning: "#f5a524",
          critical: "#ef4444",
          // -bright twin for critical *text* on dark surfaces (500 reads ~4.6:1).
          "critical-bright": "#f87171",
          success: "#22c55e",
          idle: "#3f3f46",
        },
        tranche: {
          "1l": "#2dd4bf",
          "2l": "#4f8cff",
          unsec: "#f5a524",
          sub: "#a855f7",
          eq: "#64748b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Type scale. The dense workspace band is physically 8.5–12px: 3.5px can't
      // hold 8 perceptible steps, so the legacy 0.5px-apart names snap to FOUR
      // honest tiers — micro / label / body / row — that the eye can actually
      // tell apart (~1px ≈ 11% per step). Names are kept as drop-in aliases so
      // the ~830 existing `text-caos-*` uses need no edit; the in-between names
      // (3xs/sm/lg/2xl) are deprecated duplicates — prefer 2xs/xs/md/xl in new
      // code. Headings keep a tight line-height; font-size otherwise inherits the
      // 1.5 base and the dense UI tunes leading per context.
      fontSize: {
        "caos-3xs": "9px", // micro  (alias of 2xs) — at the 9px label floor
        "caos-2xs": "9px", // micro — 9px is the design-context minimum label size
        "caos-xs": "9.5px", //  label
        "caos-sm": "9.5px", //  label  (alias of xs)
        "caos-md": "10.5px", // body
        "caos-lg": "10.5px", // body   (alias of md)
        "caos-xl": "12px", //   row
        "caos-2xl": "12px", //  row    (alias of xl)
        "caos-metric": ["16px", { lineHeight: "1.15" }],
        "caos-hero": ["22px", { lineHeight: "1.1" }],
        // Display tier — the single focal "answer" on a surface (committee
        // verdict, anchor metric). ~3x body so one element genuinely commands
        // the eye; opt-in, never for dense fields. Pairs with a small mono label
        // above for scale+weight contrast.
        "caos-display": ["30px", { lineHeight: "1.04", letterSpacing: "-0.01em" }],
      },
      // Semantic z-index scale — named layers instead of magic numbers, so
      // stacking is intentional: sticky < raised < overlay < modal < toast.
      zIndex: {
        sticky: "10",
        raised: "30",
        overlay: "40",
        modal: "50",
        toast: "60",
      },
    },
  },
  plugins: [],
};
