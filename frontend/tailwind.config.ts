import type { Config } from "tailwindcss";

// OnlyMyPDF brand palette — see docs/DESIGN_SYSTEM.md
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#07111F",
        teal: "#16D6C5",
        brand: "#2563EB", // premium blue (primary)
        healing: "#22C55E",
        violet: "#8B5CF6",
        coral: "#FF5A5F", // CTA
        soft: "#F8FAFC",
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Devanagari", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(7,17,31,0.04), 0 8px 24px rgba(7,17,31,0.06)",
        glow: "0 8px 40px rgba(37,99,235,0.18)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2563EB 0%, #16D6C5 100%)",
        "ai-gradient": "linear-gradient(135deg, #8B5CF6 0%, #2563EB 100%)",
        "hero-glow":
          "radial-gradient(60% 50% at 50% 0%, rgba(22,214,197,0.14) 0%, rgba(248,250,252,0) 70%)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
