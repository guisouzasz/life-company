//import '@/global.css';
import { Platform } from "react-native";

// ─── Life Company Design System ───────────────────────────────────────────────
// Tema único (claro). O modo escuro foi removido a pedido do estúdio.
export const LC = {
  // ── Brand ─────────────────────────────────────────────────────────
  brand: "#028E94", // teal oficial extraído do logo
  primary: "#0E9488", // ação primária (botões, ativos)
  primaryDark: "#0B6F66", // secondary / pressed
  primaryLight: "#E6F4F1", // fundo suave verde
  primaryMid: "#16B8A7", // variante clara
  primarySoft: "#D2ECE7", // chip/avatar bg

  // Gradiente do hero (login / splash)
  gradientHero: ["#063A3D", "#055F63", "#028E94"] as const,
  gradientCard: ["#0E9488", "#0B6F66"] as const,

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
  successFg: "#15803D",
  danger: "#EF4444",
  dangerBg: "#FEE2E2",
  dangerFg: "#B91C1C",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  warningFg: "#B45309", // âmbar escuro: o #F59E0B some sobre o próprio fundo claro
  info: "#3B82F6",
  infoBg: "#DBEAFE",
  infoFg: "#1D4ED8",
  neutralBg: "#F1F5F9",

  // ── Border ────────────────────────────────────────────────────────
  border: "#EEF1F4", // hairline sutil (premium, quase invisível)
  borderStrong: "#E2E8F0",
  borderFocus: "#0E9488",

  // ── Shadows (tom slate, difusas e "flutuantes") ───────────────────
  // No web usamos boxShadow (shadow* está deprecado no react-native-web);
  // no nativo mantemos shadow* (iOS) + elevation (Android).
  shadow: Platform.select({
    web: { boxShadow: "0px 2px 8px rgba(15, 23, 42, 0.04)" },
    default: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 1,
    },
  }) as object,
  // Sombra padrão dos cards flutuantes
  shadowCard: Platform.select({
    web: { boxShadow: "0px 8px 20px rgba(15, 23, 42, 0.06)" },
    default: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 3,
    },
  }) as object,
  shadowStrong: Platform.select({
    web: { boxShadow: "0px 16px 32px rgba(15, 23, 42, 0.14)" },
    default: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.14,
      shadowRadius: 32,
      elevation: 10,
    },
  }) as object,

  // ── Radius ────────────────────────────────────────────────────────
  radius: { sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, full: 999 },

  // ── Spacing ───────────────────────────────────────────────────────
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },

  // ── Coluna central ────────────────────────────────────────────────
  /**
   * Limita a largura do conteúdo e centraliza. No celular ocupa a tela toda
   * (width 100%); no navegador evita que cards e botões estiquem demais.
   * Espalhe no `header` e no `scroll` de cada tela: `...LC.coluna`.
   */
  coluna: { alignSelf: 'center', width: '100%', maxWidth: 560 },
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

// ─── Breakpoints ──────────────────────────────────────────────────────────────
// >= tablet: cabe conteúdo lado a lado (iPad em pé já tem ~820pt de largura),
//            usado na aula do professor para a ficha ficar aberta ao lado da turma.
// >= desktop: admin vira painel com sidebar (web); abaixo disso, layout mobile.
export const Breakpoints = { tablet: 760, desktop: 1024 } as const;
