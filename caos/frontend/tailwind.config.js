/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "gray-850": "#1a1f2e",
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
      // Deliberate type scale — replaces the ad-hoc `text-[8.5px]…text-[12px]`
      // band with named steps. Adopted in Phase 1.
      fontSize: {
        "caos-micro": ["8.5px", { lineHeight: "1.3" }],
        "caos-label": ["9.5px", { lineHeight: "1.35" }],
        "caos-body": ["10.5px", { lineHeight: "1.5" }],
        "caos-row": ["12px", { lineHeight: "1.4" }],
        "caos-metric": ["16px", { lineHeight: "1.15" }],
        "caos-hero": ["22px", { lineHeight: "1.1" }],
      },
      // Semantic spacing for intentional rhythm (group ≪ item ≪ section).
      spacing: {
        group: "4px",
        item: "8px",
        section: "16px",
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
