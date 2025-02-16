export const colors = {
  // Primary colors
  primary: {
    main: "#1976D2",
    light: "#42A5F5",
    dark: "#1565C0",
  },
  // Secondary colors
  secondary: {
    main: "#9C27B0",
    light: "#BA68C8",
    dark: "#7B1FA2",
  },
  // Neutral colors
  neutral: {
    white: "#FFFFFF",
    black: "#000000",
    grey100: "#F5F5F5",
    grey200: "#EEEEEE",
    grey300: "#E0E0E0",
    grey400: "#BDBDBD",
    grey500: "#9E9E9E",
    grey600: "#757575",
    grey700: "#616161",
    grey800: "#424242",
    grey900: "#212121",
  },
  // Status colors
  status: {
    success: "#4CAF50",
    warning: "#FFC107",
    error: "#DC3545",
    info: "#2196F3",
  },
} as const;

export type Colors = typeof colors;
