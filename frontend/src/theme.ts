import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { menuSlots } from "./theme/menuhelper";
import { dialogcust } from "./theme/dialogcust";
import { messageRecipes } from "./theme/file";
import { editableRecipes } from "./theme/editableRecipes";
import { codeBlockRecipes } from "./theme/codeBlockRecipes";

const tokens = {
  colors: {
    brand: {
      50: { value: "rgba(34, 197, 94, 0.05)" },
      100: { value: "rgba(34, 197, 94, 0.1)" },
      200: { value: "rgba(34, 197, 94, 0.2)" },
      300: { value: "rgba(34, 197, 94, 0.3)" },
      400: { value: "rgba(34, 197, 94, 0.4)" },
      500: { value: "rgba(34, 197, 94, 0.5)" },
      600: { value: "#22c55e" },
      700: { value: "#16a34a" },
      800: { value: "#15803d" },
      900: { value: "#166534" },
      950: { value: "#14532d" },
    },
    emerald: {
      50: { value: "rgba(16, 185, 129, 0.05)" },
      100: { value: "rgba(16, 185, 129, 0.1)" },
      200: { value: "rgba(16, 185, 129, 0.2)" },
      300: { value: "rgba(16, 185, 129, 0.3)" },
      400: { value: "rgba(16, 185, 129, 0.4)" },
      500: { value: "#10b981" },
      600: { value: "#059669" },
      700: { value: "#047857" },
      800: { value: "#065f46" },
      900: { value: "#064e3b" },
    },
  },
  fonts: {
    heading: { value: "'Outfit', 'Red Rose', sans-serif" },
    body: { value: "'Outfit', sans-serif" },
  },
  fontSizes: {
    xs: { value: "12px" },
    sm: { value: "14px" },
    md: { value: "16px" },
    lg: { value: "18px" },
    xl: { value: "20px" },
    "2xl": { value: "24px" },
    "3xl": { value: "30px" },
    "4xl": { value: "36px" },
    "5xl": { value: "48px" },
    "6xl": { value: "60px" },
  },
  fontWeights: {
    normal: { value: "400" },
    medium: { value: "500" },
    semibold: { value: "600" },
    bold: { value: "700" },
  },
  lineHeights: {
    tight: { value: "1.25" },
    normal: { value: "1.5" },
    relaxed: { value: "1.6" },
    loose: { value: "1.7" },
  },
  spacing: {
    px: { value: "1px" },
    0.5: { value: "2px" },
    1: { value: "4px" },
    1.5: { value: "6px" },
    2: { value: "8px" },
    2.5: { value: "10px" },
    3: { value: "12px" },
    3.5: { value: "14px" },
    4: { value: "16px" },
    5: { value: "20px" },
    6: { value: "24px" },
    7: { value: "28px" },
    8: { value: "32px" },
    9: { value: "36px" },
    10: { value: "40px" },
    12: { value: "48px" },
    14: { value: "56px" },
    16: { value: "64px" },
    20: { value: "80px" },
    24: { value: "96px" },
    28: { value: "112px" },
    32: { value: "128px" },
    36: { value: "144px" },
    40: { value: "160px" },
    44: { value: "176px" },
    48: { value: "192px" },
    52: { value: "208px" },
    56: { value: "224px" },
    60: { value: "240px" },
    64: { value: "256px" },
    72: { value: "288px" },
    80: { value: "320px" },
    96: { value: "384px" },
    // Also add the simplified spacing tokens from ref_theme
    xs: { value: "4px" },
    sm: { value: "8px" },
    md: { value: "16px" },
    lg: { value: "24px" },
    xl: { value: "32px" },
    xxl: { value: "48px" },
  },
  radii: {
    none: { value: "0" },
    sm: { value: "4px" },
    base: { value: "4px" },
    md: { value: "8px" },
    lg: { value: "12px" },
    xl: { value: "16px" },
    "2xl": { value: "16px" },
    "3xl": { value: "24px" },
    xxl: { value: "22px" },
    full: { value: "9999px" },
  },
};

const semanticTokens = {
  colors: {
    "brand.solid": {
      value: {
        base: "brand.700",
        _dark: "brand.600",
      },
    },
    "brand.subtle": {
      value: {
        base: "brand.100",
        _dark: "brand.900",
      },
    },
    "brand.emphasized": {
      value: {
        base: "brand.800",
        _dark: "brand.500",
      },
    },
    "bg.canvas": {
      value: {
        base: "#f5f5f5",
        _dark: "#121212",
      },
    },
    "bg.surface": {
      value: {
        base: "white",
        _dark: "#1a1a1a",
      },
    },
    "bg.panel": {
      value: {
        base: "rgba(255, 255, 255, 0.7)",
        _dark: "rgba(26, 26, 26, 0.7)",
      },
    },
    "glass.bg": {
      value: {
        base: "rgba(255, 255, 255, 0.4)",
        _dark: "rgba(0, 0, 0, 0.3)",
      },
    },
    "glass.border": {
      value: {
        base: "rgba(255, 255, 255, 0.5)",
        _dark: "rgba(255, 255, 255, 0.08)",
      },
    },
    "bg.subtle": {
      value: {
        base: "gray.50",
        _dark: "gray.800",
      },
    },
    "bg.muted": {
      value: {
        base: "gray.100",
        _dark: "gray.700",
      },
    },
    "bg.emphasized": {
      value: {
        base: "gray.100",
        _dark: "gray.600",
      },
    },
    "fg.default": {
      value: {
        base: "#1a1a1a",
        _dark: "#ffffff",
      },
    },
    fg: {
      value: {
        base: "#1a1a1a",
        _dark: "#ffffff",
      },
    },
    "fg.muted": {
      value: {
        base: "gray.600",
        _dark: "gray.300",
      },
    },
    "fg.subtle": {
      value: {
        base: "gray.500",
        _dark: "gray.400",
      },
    },
    "fg.inverted": {
      value: {
        base: "#ffffff",
        _dark: "#000000",
      },
    },
    "border.default": {
      value: {
        base: "rgba(0, 0, 0, 0.08)",
        _dark: "rgba(255, 255, 255, 0.1)",
      },
    },
    border: {
      value: {
        base: "rgba(0, 0, 0, 0.12)",
        _dark: "rgba(255, 255, 255, 0.15)",
      },
    },
    "border.subtle": {
      value: {
        base: "rgba(0, 0, 0, 0.05)",
        _dark: "rgba(255, 255, 255, 0.06)",
      },
    },
    "border.emphasized": {
      value: {
        base: "rgba(0, 0, 0, 0.2)",
        _dark: "rgba(255, 255, 255, 0.25)",
      },
    },
    "border.accent": {
      value: {
        base: "brand.600",
        _dark: "brand.500",
      },
    },
    "colorPalette.solid": {
      value: {
        base: "brand.700",
        _dark: "brand.600",
      },
    },
    "colorPalette.contrast": {
      value: {
        base: "black",
        _dark: "white",
      },
    },
    "brand.hover": {
      value: {
        base: "rgba(34, 197, 94, 0.1)",
        _dark: "rgba(34, 197, 94, 0.2)",
      },
    },
    "brand.active": {
      value: {
        base: "rgba(34, 197, 94, 0.15)",
        _dark: "rgba(34, 197, 94, 0.25)",
      },
    },
  },
};

const config = defineConfig({
  strictTokens: true,
  cssVarsPrefix: "ck",
  globalCss: {
    "*": {
      transition:
        "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
    },
    body: {
      bg: "bg.canvas",
      color: "fg.default",
      fontFamily: "fonts.body",
      lineHeight: "normal",
    },
    code: {
      fontFamily:
        "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
    },
    // Custom scrollbar
    "::-webkit-scrollbar": {
      width: "6px",
      height: "6px",
    },
    "::-webkit-scrollbar-thumb": {
      backgroundColor: "brand.600",
      borderRadius: "sm",
    },
    "::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    "*::placeholder": {
      color: "fg.muted",
    },
  },

  theme: {
    tokens,
    semanticTokens,
    recipes: {
      codeBlock: codeBlockRecipes,
      editable: editableRecipes,
    },
    slotRecipes: {
      menuHelper: menuSlots,
      dialogHelper: dialogcust,
      message: messageRecipes,
      codeBlock: codeBlockRecipes,
      editable: editableRecipes,
    },
  },
});

const system = createSystem(defaultConfig, config);
export default system;
