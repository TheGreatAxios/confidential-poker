/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        "poker-void": "#06060c",
        "poker-dark": "#0b0e18",
        "poker-surface": "#111628",
        "poker-elevated": "#1a1f36",
        "poker-border": "rgba(255,255,255,0.06)",

        // Accents
        "poker-gold": "#fbbf24",
        "poker-gold-dim": "#b8860b",
        "poker-emerald": "#34d399",
        "poker-crimson": "#f43f5e",
        "poker-royal": "#818cf8",
        "poker-violet": "#a78bfa",

        // Table
        "poker-felt": "#0f5132",
        "poker-felt-light": "#198754",
        "poker-felt-dark": "#0a3622",
        "poker-wood": "#3d2b1f",
        "poker-wood-light": "#5c3d2e",

        // Text
        "poker-text": "#e2e8f0",
        "poker-text-dim": "#94a3b8",
        "poker-text-muted": "#475569",

        // Cards
        "poker-card-red": "#dc2626",
        "poker-card-black": "#f8fafc",

        // Legacy compat
        "poker-darker": "#060a12",
        "poker-blue": "#4299e1",
        "poker-green": "#38a169",
        "poker-purple": "#9f7aea",
        "poker-red": "#e53e3e",
        "poker-card-white": "#f7fafc",
      },
      fontFamily: {
        poker: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', "Fira Code", "monospace"],
      },
      animation: {
        "deal-card": "dealCard 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "chip-bounce": "chipBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "pulse-gold": "pulseGold 2.5s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "slide-up": "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fade-in": "fadeIn 0.5s ease-out",
        "think": "think 1.4s ease-in-out infinite",
        "pot-glow": "potGlow 2.5s ease-in-out infinite",
        "glow-border": "glowBorder 3s ease-in-out infinite",
        "ambient-drift": "ambientDrift 20s ease-in-out infinite",
        "shimmer": "shimmer 2s ease-in-out infinite",
        "shield-pulse": "shieldPulse 2s ease-in-out infinite",
      },
      keyframes: {
        dealCard: {
          "0%": { transform: "translateY(-60px) scale(0.5) rotate(-10deg)", opacity: "0" },
          "60%": { transform: "translateY(4px) scale(1.02) rotate(1deg)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1) rotate(0deg)", opacity: "1" },
        },
        chipBounce: {
          "0%": { transform: "translateY(-16px) scale(0.7)", opacity: "0" },
          "50%": { transform: "translateY(2px) scale(1.08)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(251, 191, 36, 0.2), 0 0 16px rgba(251, 191, 36, 0.05)" },
          "50%": { boxShadow: "0 0 16px rgba(251, 191, 36, 0.4), 0 0 32px rgba(251, 191, 36, 0.1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        think: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.1)" },
        },
        potGlow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(251, 191, 36, 0.15)" },
          "50%": { boxShadow: "0 0 24px rgba(251, 191, 36, 0.35)" },
        },
        glowBorder: {
          "0%, 100%": { borderColor: "rgba(251, 191, 36, 0.15)" },
          "50%": { borderColor: "rgba(251, 191, 36, 0.4)" },
        },
        ambientDrift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(30px, -20px) scale(1.05)" },
          "50%": { transform: "translate(-20px, 20px) scale(0.95)" },
          "75%": { transform: "translate(15px, 10px) scale(1.02)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        shieldPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(52, 211, 153, 0.2)" },
          "50%": { boxShadow: "0 0 16px rgba(52, 211, 153, 0.4)" },
        },
      },
      backgroundImage: {
        "felt-gradient":
          "radial-gradient(ellipse at center, #198754 0%, #0f5132 40%, #0a3622 80%, #072419 100%)",
        "wood-gradient":
          "linear-gradient(135deg, #3d2b1f 0%, #5c3d2e 30%, #3d2b1f 60%, #4a3425 100%)",
      },
      boxShadow: {
        "gold-sm": "0 0 8px rgba(251, 191, 36, 0.2)",
        "gold-md": "0 0 16px rgba(251, 191, 36, 0.3)",
        "gold-lg": "0 0 24px rgba(251, 191, 36, 0.4)",
        "emerald-sm": "0 0 8px rgba(52, 211, 153, 0.2)",
        "crimson-sm": "0 0 8px rgba(244, 63, 94, 0.2)",
        "card": "0 4px 12px rgba(0, 0, 0, 0.4)",
        "card-hover": "0 8px 24px rgba(0, 0, 0, 0.5)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.3)",
        "inner-felt": "inset 0 2px 20px rgba(0, 0, 0, 0.3), inset 0 -4px 12px rgba(251, 191, 36, 0.05)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
