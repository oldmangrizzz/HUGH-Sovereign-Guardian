const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  mode: "jit",
  purge: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter var", ...fontFamily.sans],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        primary: { DEFAULT: "#10b981", hover: "#059669" },
        workshop: {
          forge:   "#080808",
          iron:    "#111111",
          steel:   "#1a1a1a",
          plate:   "#242424",
          silver:  "#94a3b8",
          chrome:  "#cbd5e1",
          pewter:  "#64748b",
          emerald: "#10b981",
          "emerald-bright": "#34d399",
          "emerald-dim":    "#065f46",
          crimson: "#dc2626",
          "crimson-bright": "#ef4444",
          "crimson-dim":    "#7f1d1d",
          text:    "#e2e8f0",
          muted:   "#64748b",
          dim:     "#374151",
        },
      },
      boxShadow: {
        "emerald-glow": "0 0 20px rgba(16,185,129,0.5), 0 0 60px rgba(16,185,129,0.2)",
        "crimson-glow": "0 0 20px rgba(220,38,38,0.5), 0 0 60px rgba(220,38,38,0.2)",
        "silver-glow":  "0 0 15px rgba(148,163,184,0.3)",
      },
    },
  },
};
