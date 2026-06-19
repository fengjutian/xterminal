/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
        // Catppuccin Mocha direct color aliases (for Tailwind utility use)
        mantle: "#181825",
        crust: "#11111b",
        surface: {
          0: "#313244",
          1: "#45475a",
          DEFAULT: "#313244",
        },
        overlay: {
          0: "#6c7086",
          1: "#7f849c",
          DEFAULT: "#6c7086",
        },
        "text-secondary": "#a6adc8",
        "text-muted": "#6c7086",
        blue: "#89b4fa",
        green: "#a6e3a1",
        yellow: "#f9e2af",
        red: "#f38ba8",
        peach: "#fab387",
        mauve: "#cba6f7",
        teal: "#94e2d5",
        pink: "#f5c2e7",
        lavender: "#b4befe",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"Segoe UI"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"Cascadia Code"', '"Fira Code"', "Consolas", "monospace"],
      },
      fontSize: {
        xs: ["11px", "16px"],
        sm: ["12px", "16px"],
        base: ["13px", "20px"],
        lg: ["14px", "20px"],
        xl: ["16px", "24px"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease",
        "slide-up": "slide-up 0.2s ease",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
