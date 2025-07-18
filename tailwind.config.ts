import type { Config } from "tailwindcss";

import tailwindForms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            h1: {
              fontWeight: "700",
            },
            h2: {
              fontWeight: "600",
            },
            "ul > li": {
              position: "relative",
            },
          },
        },
      },
    },
  },
  plugins: [tailwindForms, require("@tailwindcss/typography")],
};
export default config;
