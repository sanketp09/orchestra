import type { Config } from "tailwindcss";

/**
 * ORCHESTRA design system — Tailwind configuration.
 */
const config: Config = {
  darkMode: undefined, // single theme only — no dark mode
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./extracted_claude_code/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--background)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },

        // Semantic status colors — text/dot/border use only.
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        ai: "var(--ai)",
      },

      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },

      fontSize: {
        label: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        body: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        emphasis: ["16px", { lineHeight: "24px", fontWeight: "500" }],
        "card-header": ["24px", { lineHeight: "30px", fontWeight: "700" }],
        display: ["40px", { lineHeight: "44px", fontWeight: "700" }],
        hero: ["56px", { lineHeight: "60px", fontWeight: "700" }],
      },

      fontWeight: {
        normal: "400",
        medium: "500",
        bold: "700",
      },

      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        6: "24px",
        8: "32px",
        12: "48px",
        16: "64px",
      },

      borderRadius: {
        badge: "4px",
        button: "6px",
        input: "6px",
        card: "8px",
        lg: "8px",
        md: "6px",
        sm: "4px",
      },

      boxShadow: {
        none: "none",
        overlay:
          "0 8px 24px -4px rgba(12, 9, 4, 0.16), 0 2px 6px -2px rgba(12, 9, 4, 0.08)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
