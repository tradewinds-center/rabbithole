import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        // Primary
        navy: {
          50: { value: "#e8e9f0" },
          100: { value: "#c5c7d9" },
          200: { value: "#9ea2bf" },
          300: { value: "#777ca5" },
          400: { value: "#596091" },
          500: { value: "#222656" }, // Base
          600: { value: "#1e224e" },
          700: { value: "#1a1d42" }, // Hover
          800: { value: "#151837" },
          900: { value: "#0d0f22" },
        },
        charcoal: {
          50: { value: "#f5f6f7" },
          100: { value: "#e6e8eb" },
          200: { value: "#ccd0d5" },
          300: { value: "#a3aab3" },
          400: { value: "#6d7584" },
          500: { value: "#364153" }, // Base body text
          600: { value: "#303a4a" },
          700: { value: "#2a3340" }, // Hover
          800: { value: "#232b37" },
          900: { value: "#1a2029" },
        },
        // Secondary
        yellow: {
          50: { value: "#FFFDF5" },
          100: { value: "#FFFBEB" },
          200: { value: "#FFF9E6" },
          300: { value: "#FFF2B3" }, // Light bg
          400: { value: "#FFEC8A" },
          500: { value: "#FFE77C" }, // Base
          600: { value: "#E6CC45" },
          700: { value: "#CCB230" }, // Hover
          800: { value: "#B39920" },
          900: { value: "#8A7518" },
        },
        violet: {
          50: { value: "#f9f5fa" },
          100: { value: "#f0e6f3" },
          200: { value: "#e5d4ed" },
          300: { value: "#d4b8df" }, // Light bg
          400: { value: "#c18ccf" },
          500: { value: "#AD60BF" }, // Base
          600: { value: "#9b56ac" },
          700: { value: "#8a4d99" }, // Hover
          800: { value: "#6e3d7a" },
          900: { value: "#522e5c" },
        },
        cyan: {
          50: { value: "#f0fbfc" },
          100: { value: "#ddf6f9" },
          200: { value: "#c9f2f7" },
          300: { value: "#a3e9f0" }, // Light bg
          400: { value: "#68dce9" },
          500: { value: "#2ECCDF" }, // Base
          600: { value: "#29b8c9" },
          700: { value: "#24a3b3" }, // Hover
          800: { value: "#1d828f" },
          900: { value: "#16626c" },
        },
        // Tertiary
        green: {
          50: { value: "#f0fdf8" },
          100: { value: "#dcfaed" },
          200: { value: "#ccf7e8" },
          300: { value: "#99efd0" }, // Light bg
          400: { value: "#4de5b0" },
          500: { value: "#00DD91" }, // Base
          600: { value: "#00c882" },
          700: { value: "#00b574" }, // Hover
          800: { value: "#008f5c" },
          900: { value: "#006a45" },
        },
        orange: {
          50: { value: "#fff9f3" },
          100: { value: "#fff2e6" },
          200: { value: "#ffe8cc" },
          300: { value: "#ffd7a3" }, // Light bg
          400: { value: "#ffbe6b" },
          500: { value: "#FFA639" }, // Base
          600: { value: "#e69533" },
          700: { value: "#d98a2e" }, // Hover
          800: { value: "#b36f24" },
          900: { value: "#8a561c" },
        },
        darkCyan: {
          50: { value: "#f0f7f7" },
          100: { value: "#d9ebec" },
          200: { value: "#b3d7d8" },
          300: { value: "#80bec0" },
          400: { value: "#4d9a9d" },
          500: { value: "#1F6F73" }, // Base
          600: { value: "#1c6467" },
          700: { value: "#195a5d" }, // Hover
          800: { value: "#144749" },
          900: { value: "#0f3536" },
        },
        // Status colors
        status: {
          green: { value: "#00DD91" },
          yellow: { value: "#FFE77C" },
          red: { value: "#EF4444" },
        },
      },
      fonts: {
        heading: { value: "'Hanken Grotesk', sans-serif" },
        body: { value: "'Playfair', serif" },
        mono: { value: "ui-monospace, monospace" },
      },
      fontSizes: {
        xs: { value: "0.75rem" },
        sm: { value: "0.875rem" },
        md: { value: "1rem" },
        lg: { value: "1.125rem" },
        xl: { value: "1.25rem" },
        "2xl": { value: "1.5rem" },
        "3xl": { value: "1.875rem" },
        "4xl": { value: "2.25rem" },
        "5xl": { value: "3rem" },
      },
      radii: {
        none: { value: "0" },
        sm: { value: "0.25rem" },
        md: { value: "0.5rem" },
        lg: { value: "0.75rem" },
        xl: { value: "1rem" },
        "2xl": { value: "1.5rem" },
        full: { value: "9999px" },
      },
    },
    semanticTokens: {
      colors: {
        // Background
        "bg.default": { value: "{colors.white}" },
        "bg.subtle": { value: "{colors.gray.50}" },
        "bg.muted": { value: "{colors.gray.100}" },
        "bg.emphasized": { value: "{colors.navy.500}" },
        // Foreground
        "fg.default": { value: "{colors.charcoal.500}" },
        "fg.muted": { value: "{colors.charcoal.400}" },
        "fg.subtle": { value: "{colors.charcoal.300}" },
        "fg.inverted": { value: "{colors.white}" },
        // Border
        "border.default": { value: "{colors.gray.200}" },
        "border.muted": { value: "{colors.gray.100}" },
        // Brand
        "brand.primary": { value: "{colors.navy.500}" },
        "brand.secondary": { value: "{colors.violet.500}" },
        "brand.accent": { value: "{colors.orange.500}" },
      },
    },
  },
  globalCss: {
    "*": {
      boxSizing: "border-box",
    },
    html: {
      scrollBehavior: "smooth",
    },
    body: {
      fontFamily: "body",
      color: "fg.default",
      bg: "bg.default",
      lineHeight: "1.6",
    },
    "h1, h2, h3, h4, h5, h6": {
      fontFamily: "heading",
      fontWeight: "600",
    },
  },
});

export const system = createSystem(defaultConfig, config);
