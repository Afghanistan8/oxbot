import type { Config } from "tailwindcss";
// ESM import rather than require(): Node parses this .ts config as an ES
// module, where `require` is not defined — a bare require() here crashes
// config loading outright.
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * oxbot design system — a premium Web3 giveaway platform in warm near-black + gold.
 *
 * Dark mode only. The palette is a single warm-gold accent over a near-black base,
 * with a muted sand/khaki neutral for body text — no red anywhere.
 *
 * shadcn/ui reads the semantic HSL CSS variables (defined in globals.css); the raw brand
 * colors below are exposed as Tailwind utilities (e.g. `bg-crimson`, `text-scarlet`,
 * `shadow-glow-red`) for bespoke marketing/UI work. Class/token NAMES were kept as-is
 * (crimson/scarlet/ink/etc.) to avoid touching every component that references them —
 * only the underlying hex values changed, from red to gold.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // ---- Raw brand palette (the gold soul) ----
        // NOTE: named "crimson" for historical/low-churn reasons — every value
        // below is gold, not red. See file header.
        crimson: {
          DEFAULT: "#D8A72A", // warm gold — primary
          deep: "#BA8B1F", // deeper gold alt-primary
          50: "#FEFAF0",
          100: "#FCF1D6",
          200: "#F8E2AC",
          300: "#F3D77A",
          400: "#E4BE55",
          500: "#D8A72A",
          600: "#BA8B1F",
          700: "#8F6B18",
          800: "#644B11",
          900: "#3A2B0A",
          950: "#201704",
        },
        scarlet: {
          DEFAULT: "#F3D77A", // light gold — hover / accent highlight
          soft: "#F6DFA0",
        },
        rose: {
          highlight: "#F8E2AC", // soft gold highlight
        },
        gold: {
          DEFAULT: "#D8A72A", // warm gold — winners + premium CTAs
          soft: "#F3D77A",
          deep: "#BA8B1F",
        },
        ink: {
          // Warm near-black base, matched to the --background/--card tokens so
          // translucent `bg-ink-black/40` insets read as a subtle darkening of
          // the warm surface, never cold black.
          black: "#080807", // deepest warm base (≈ --background)
          charcoal: "#131210", // warm charcoal (≈ --card)
        },
        surface: {
          DEFAULT: "#131210", // elevated warm near-black surface
          raised: "#1B1917", // slightly more elevated surface
          border: "#2A2722", // warm hairline border
        },

        // ---- shadcn/ui semantic tokens (HSL vars from globals.css) ----
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        // Dramatic dark → gold gradients for hero sections and cards.
        "hero-radial":
          "radial-gradient(80% 80% at 50% -10%, rgba(216,167,42,0.28) 0%, rgba(186,139,31,0.10) 40%, rgba(8,8,7,0) 70%)",
        "crimson-gradient":
          "linear-gradient(135deg, #D8A72A 0%, #BA8B1F 55%, #3A2B0A 100%)",
        "crimson-sheen":
          "linear-gradient(135deg, rgba(243,215,122,0.16) 0%, rgba(216,167,42,0.05) 40%, rgba(8,8,7,0) 80%)",
        "card-glow":
          "radial-gradient(120% 120% at 0% 0%, rgba(216,167,42,0.12) 0%, rgba(19,18,16,0) 55%)",
        "gold-gradient":
          "linear-gradient(135deg, #F3D77A 0%, #D8A72A 45%, #BA8B1F 100%)",
      },
      boxShadow: {
        "glow-red": "0 0 0 1px rgba(216,167,42,0.35), 0 8px 40px -8px rgba(216,167,42,0.45)",
        "glow-red-lg": "0 0 0 1px rgba(243,215,122,0.4), 0 20px 70px -12px rgba(216,167,42,0.6)",
        "glow-gold": "0 0 0 1px rgba(243,215,122,0.4), 0 10px 40px -8px rgba(243,215,122,0.4)",
        "inner-red": "inset 0 1px 0 0 rgba(255,255,255,0.04), inset 0 0 24px -12px rgba(216,167,42,0.5)",
        card: "0 10px 30px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(42,39,34,0.6)",
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
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
