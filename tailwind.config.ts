import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      animation: {
        glow: "glow 1s ease-out",
      },
      keyframes: {
        glow: {
          "0%": { transform: "scale(0)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
