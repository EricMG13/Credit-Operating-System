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
      // Type scale — font-size only for the dense band (line-height inherits the
      // 1.5 base; the dense UI tunes leading per context), so the named steps are
      // drop-in for the ad-hoc text-[Npx] they replace. Headings keep a tight
      // line-height. Steps mirror the sizes actually used across the workspace.
      fontSize: {
        "caos-3xs": "8px",
        "caos-2xs": "8.5px",
        "caos-xs": "9px",
        "caos-sm": "9.5px",
        "caos-md": "10px",
        "caos-lg": "10.5px",
        "caos-xl": "11px",
        "caos-2xl": "12px",
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
