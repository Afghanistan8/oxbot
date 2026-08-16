import type { Config } from "tailwindcss";
// ESM import rather than require(): Node parses this .ts config as an ES
// module, where `require` is not defined — a bare require() here crashes
// config loading outright.
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * oxbot design system — "a premium Web3 giveaway platform with a fierce, elegant red soul."
 *
 * Dark mode only. The palette is dominated by deep crimson/blood-red with scarlet accents,
 * near-black backgrounds, red-tinted elevated surfaces, and warm gold for winners/CTAs.
 *
 * shadcn/ui reads the semantic HSL CSS variables (defined in globals.css); the raw brand
 * colors below are exposed as Tailwind utilities (e.g. `bg-crimson`, `text-scarlet`,
 * `shadow-glow-red`) for bespoke marketing/UI work.
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
        // ---- Raw brand palette (the red soul) ----
        crimson: {
          DEFAULT: "#C41E3A", // deep crimson / blood red — primary
          deep: "#B91C1C", // rich dark red alt-primary
          50: "#FDF2F3",
          100: "#FCE4E7",
          200: "#F8C4CB",
          300: "#F2939F",
          400: "#E85A6C",
          500: "#C41E3A",
          600: "#A81730",
          700: "#8A1228",
          800: "#6B0E20",
          900: "#4A0A16",
          950: "#2A050C",
        },
        scarlet: {
          DEFAULT: "#EF4444", // brighter scarlet — hover / accent
          soft: "#F87171",
        },
        rose: {
          highlight: "#FDA4AF", // soft rose highlight
        },
        gold: {
          DEFAULT: "#F5C451", // warm amber/gold — winners + premium CTAs
          soft: "#FBE39A",
          deep: "#D9A441",
        },
        ink: {
          black: "#0A0A0A", // very dark near-black background
          charcoal: "#141414", // charcoal background
        },
        surface: {
          DEFAULT: "#1A0F10", // elevated dark red-tinted surface
          raised: "#1F1214", // slightly more elevated surface
          border: "#3F1A1D", // soft red border
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
        // Dramatic dark → crimson gradients for hero sections and cards.
        "hero-radial":
          "radial-gradient(80% 80% at 50% -10%, rgba(196,30,58,0.35) 0%, rgba(120,15,32,0.12) 40%, rgba(10,10,10,0) 70%)",
        "crimson-gradient":
          "linear-gradient(135deg, #C41E3A 0%, #8A1228 55%, #4A0A16 100%)",
        "crimson-sheen":
          "linear-gradient(135deg, rgba(239,68,68,0.16) 0%, rgba(196,30,58,0.05) 40%, rgba(10,10,10,0) 80%)",
        "card-glow":
          "radial-gradient(120% 120% at 0% 0%, rgba(196,30,58,0.12) 0%, rgba(26,15,16,0) 55%)",
        "gold-gradient":
          "linear-gradient(135deg, #FBE39A 0%, #F5C451 45%, #D9A441 100%)",
      },
      boxShadow: {
        "glow-red": "0 0 0 1px rgba(196,30,58,0.35), 0 8px 40px -8px rgba(196,30,58,0.45)",
        "glow-red-lg": "0 0 0 1px rgba(239,68,68,0.4), 0 20px 70px -12px rgba(196,30,58,0.6)",
        "glow-gold": "0 0 0 1px rgba(245,196,81,0.4), 0 10px 40px -8px rgba(245,196,81,0.4)",
        "inner-red": "inset 0 1px 0 0 rgba(255,255,255,0.04), inset 0 0 24px -12px rgba(196,30,58,0.5)",
        card: "0 10px 30px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(63,26,29,0.6)",
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
