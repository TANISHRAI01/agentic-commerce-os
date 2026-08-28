import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "tertiary-container": "#b94900",
        "surface-container-low": "#1b1b20",
        "surface-variant": "#35343a",
        "secondary-fixed-dim": "#e9c349",
        "inverse-surface": "#e4e1e9",
        "surface-container": "#1f1f25",
        "primary-fixed": "#e3dfff",
        "on-error-container": "#ffdad6",
        "tertiary-fixed": "#ffdbcc",
        "on-primary-fixed-variant": "#3214da",
        "on-primary": "#1f00a5",
        "tertiary": "#ffb595",
        "surface-dim": "#131318",
        "secondary-container": "#af8d11",
        "surface-bright": "#39383e",
        "on-primary-container": "#f0edff",
        "surface": "#131318",
        "surface-container-highest": "#35343a",
        "error": "#ffb4ab",
        "surface-container-lowest": "#0e0e13",
        "surface-container-high": "#2a292f",
        "on-tertiary-fixed": "#351000",
        "outline": "#918fa2",
        "on-secondary-fixed-variant": "#574500",
        "on-surface": "#e4e1e9",
        "on-primary-fixed": "#100069",
        "tertiary-fixed-dim": "#ffb595",
        "surface-tint": "#c3c0ff",
        "on-tertiary-fixed-variant": "#7c2e00",
        "secondary-fixed": "#ffe088",
        "on-tertiary": "#571e00",
        "secondary": "#e9c349",
        "on-secondary-fixed": "#241a00",
        "outline-variant": "#464556",
        "on-tertiary-container": "#ffebe4",
        "inverse-on-surface": "#303036",
        "primary-container": "#5b4fff",
        "inverse-primary": "#4c3df1",
        "on-error": "#690005",
        "primary": "#c3c0ff",
        "primary-fixed-dim": "#c3c0ff",
        "background": "#131318",
        "on-secondary-container": "#342800",
        "on-background": "#e4e1e9",
        "on-surface-variant": "#c7c4d9",
        "on-secondary": "#3c2f00",
        "error-container": "#93000a",
        "warning": "#f59e0b",
        "warning-bg": "#451a03",
        "info": "#6366f1",
        "info-bg": "#1e1b4b"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "container_max_width": "1440px",
        "stack_sm": "8px",
        "stack_md": "16px",
        "base_unit": "4px",
        "margin_desktop": "48px",
        "gutter": "24px",
        "stack_lg": "32px",
        "margin_mobile": "16px"
      },
      fontFamily: {
        "headline-sm": ["Space Grotesk", "sans-serif"],
        "tabular-data": ["Geist", "monospace"],
        "label-micro": ["Geist", "sans-serif"],
        "headline-md": ["Space Grotesk", "sans-serif"],
        "display-lg": ["Space Grotesk", "sans-serif"],
        "body-main": ["Geist", "sans-serif"]
      },
      fontSize: {
        "headline-sm": ["20px", { "lineHeight": "1.4", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "tabular-data": ["14px", { "lineHeight": "1", "fontWeight": "600" }],
        "label-micro": ["11px", { "lineHeight": "1", "letterSpacing": "0.08em", "fontWeight": "600" }],
        "headline-md": ["32px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "display-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "800" }],
        "body-main": ["15px", { "lineHeight": "1.6", "letterSpacing": "0em", "fontWeight": "400" }]
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms")
  ],
};
export default config;
