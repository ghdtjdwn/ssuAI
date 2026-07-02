import type { Config } from "tailwindcss";

// Design tokens from design_handoff_ssuai_redesign/README.md.
// Semantic surfaces flip via CSS variables (globals.css); brand scales are static.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--ring)",
        background: "var(--bg)",
        foreground: "var(--ink)",
        surface: "var(--surface)",
        hairline: "var(--hairline)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "#FFFFFF",
          soft: "var(--primary-soft)",
          "soft-foreground": "var(--primary-soft-ink)",
          50: "#EAF1FB",
          100: "#D3E1F6",
          200: "#A7C3ED",
          300: "#6E9CE0",
          400: "#3D77D1",
          500: "#0B4DA2",
          600: "#093F86",
          700: "#08356F",
          800: "#062A58",
        },
        mint: {
          DEFAULT: "#10B5A0",
          50: "#E4F7F3",
          100: "#B9EBE2",
          300: "#6FD8C7",
          500: "#10B5A0",
          600: "#0E9C87",
          700: "#0A7566",
          glow: "#2DD4BF",
          "glow-soft": "#7FE9DA",
        },
        secondary: {
          DEFAULT: "var(--muted)",
          foreground: "var(--ink)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--text-2)",
        },
        subtle: "var(--text-3)",
        accent: {
          DEFAULT: "var(--primary-soft)",
          foreground: "var(--primary-soft-ink)",
        },
        card: {
          DEFAULT: "var(--surface)",
          foreground: "var(--ink)",
        },
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          bg: "var(--danger-bg)",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "16px",
        hero: "20px",
        control: "10px",
        pill: "999px",
      },
      boxShadow: {
        e1: "0 1px 2px rgba(16,24,40,.05)",
        e2: "0 6px 16px rgba(16,24,40,.10)",
        e3: "0 14px 34px rgba(16,24,40,.18)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(.34,1.56,.64,1)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "0 0" },
        },
        springPop: {
          "0%": { transform: "scale(.5)", opacity: "0" },
          "55%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        toastIn: {
          from: { transform: "translateY(14px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        sheetUp: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        slideInRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s linear infinite",
        springPop: "springPop .45s cubic-bezier(.34,1.56,.64,1) both",
        toastIn: "toastIn .3s cubic-bezier(.34,1.56,.64,1) both",
        sheetUp: "sheetUp .32s cubic-bezier(.34,1.56,.64,1) both",
        slideInRight: "slideInRight .3s cubic-bezier(.34,1.56,.64,1) both",
        fadeIn: "fadeIn .25s ease-out both",
        fadeUp: "fadeUp .3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
