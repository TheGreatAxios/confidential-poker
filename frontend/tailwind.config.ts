import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        poker: {
          bg: "#0A0A0A",
          felt: "#0B3D0B",
          feltLight: "#0F5F0F",
          gold: "#FFD700",
          goldDark: "#B8960F",
          goldLight: "#FFE44D",
          card: "#F5F5F0",
          red: "#EF4444",
          green: "#22C55E",
          amber: "#F59E0B",
          purple: "#A855F7",
          blue: "#3B82F6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        gold: "0 0 20px rgba(255, 215, 0, 0.3)",
        "gold-lg": "0 0 40px rgba(255, 215, 0, 0.4)",
        "gold-xl": "0 0 60px rgba(255, 215, 0, 0.3), 0 0 120px rgba(255, 215, 0, 0.1)",
        felt: "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.05)",
        card: "0 2px 8px rgba(0, 0, 0, 0.3)",
        "seat-glow-red": "0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.2)",
        "seat-glow-blue": "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.2)",
        "seat-glow-purple": "0 0 20px rgba(168, 85, 247, 0.5), 0 0 40px rgba(168, 85, 247, 0.2)",
        "seat-glow-green": "0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.2)",
      },
      animation: {
        "shimmer": "shimmer 2s ease-in-out infinite",
        "pulse-gold": "pulse-gold 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "deal-in": "deal-in 0.4s ease-out",
        "chip-slide": "chip-slide 0.6s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 215, 0, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(255, 215, 0, 0.6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "deal-in": {
          "0%": { transform: "translateY(-60px) rotate(-10deg) scale(0.5)", opacity: "0" },
          "100%": { transform: "translateY(0) rotate(0deg) scale(1)", opacity: "1" },
        },
        "chip-slide": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.3)" },
        },
      },
      backgroundImage: {
        "felt-gradient": "radial-gradient(ellipse at center, #0F5F0F 0%, #0B3D0B 60%, #082D08 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
