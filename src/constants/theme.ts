//import '@/global.css';
import { Platform } from "react-native";

// ─── Life Company Design System ───────────────────────────────────────────────
export const LC = {
  // ── Brand ─────────────────────────────────────────────────────────
  primary: "#16B8A7", // verde Life Company (mockup)
  primaryDark: "#0E8C80", // secondary / pressed
  primaryLight: "#E8F8F6", // fundo suave verde
  primaryMid: "#1DCFBC", // variante clara

  // ── Neutrals ──────────────────────────────────────────────────────
  bg: "#F8FAFC", // background geral (mockup)
  bgCard: "#FFFFFF", // card
  bgDark: "#0F172A", // fundo hero login (dark)
  bgDarkCard: "#1E293B",

  // ── Text ──────────────────────────────────────────────────────────
  textPrimary: "#111827", // dark text
  textSecondary: "#6B7280", // secondary
  textMuted: "#9CA3AF", // placeholder / muted
  textWhite: "#FFFFFF",
  textOnPrimary: "#FFFFFF",

  // ── Status ────────────────────────────────────────────────────────
  success: "#22C55E",
  successBg: "#DCFCE7",
  danger: "#EF4444",
  dangerBg: "#FEE2E2",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  info: "#3B82F6",
  infoBg: "#DBEAFE",

  // ── Border ────────────────────────────────────────────────────────
  border: "#E5E7EB",
  borderFocus: "#16B8A7",

  // ── Shadows ───────────────────────────────────────────────────────
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  shadowStrong: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },

  // ── Radius ────────────────────────────────────────────────────────
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999 },

  // ── Spacing ───────────────────────────────────────────────────────
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
} as const;

// ─── Legacy compat ────────────────────────────────────────────────────────────
export const Colors = {
  light: {
    text: LC.textPrimary,
    background: LC.bg,
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: LC.textSecondary,
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
  },
} as const;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
