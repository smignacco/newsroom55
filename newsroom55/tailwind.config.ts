import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        nr: {
          bg: "#060D18",
          surface: "#0B1726",
          surface2: "#112235",
          accent: "#35C6F4",
          text: "#F4F8FC",
          text2: "#91A8BD",
          critical: "#F04452",
          positive: "#32C997",
          info: "#F2B85B",
        },
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
