/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        caos: {
          bg: "#0a0a0f",
          panel: "#12121a",
          elevated: "#1a1a24",
          border: "#262633",
          text: "#e6e6ef",
          muted: "#8a8a9a",
          accent: "#4f8cff",
          // Semantic status — previously only reachable as CSS vars / inline styles.
          warning: "#f5a524",
          critical: "#ef4444",
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
        "caos-3xs": "8.5px", // micro  (alias of 2xs)
        "caos-2xs": "8.5px", // micro
        "caos-xs": "9.5px", //  label
        "caos-sm": "9.5px", //  label  (alias of xs)
        "caos-md": "10.5px", // body
        "caos-lg": "10.5px", // body   (alias of md)
        "caos-xl": "12px", //   row
        "caos-2xl": "12px", //  row    (alias of xl)
        "caos-metric": ["16px", { lineHeight: "1.15" }],
        "caos-hero": ["22px", { lineHeight: "1.1" }],
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
