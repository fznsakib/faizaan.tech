import { colors } from "./colors";

export const theme = {
  colors,
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
} as const;

export type Theme = typeof theme;
