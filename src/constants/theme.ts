//import '@/global.css';
import { Platform } from "react-native";

// ─── Pro Treine Design System (BRANCH DE DEMONSTRAÇÃO) ───────────────────────
// Mesma estrutura do tema do Life Company, repintada em escuro + laranja para
// a gravação do vídeo de vendas do Pro Treine. Não vai para a main.
export const LC = {
  // ── Brand ─────────────────────────────────────────────────────────
  brand: "#F26B1D", // laranja da marca Pro Treine
  primary: "#F26B1D", // ação primária (botões, ativos)
  primaryDark: "#C2540F", // secondary / pressed
  primaryLight: "#2A1A0E", // fundo suave (laranja rebaixado no escuro)
  primaryMid: "#FF8F45", // variante clara
  primarySoft: "#3A2413", // chip/avatar bg

  // Gradiente do hero (login / splash)
  gradientHero: ["#0A0A0A", "#1C120A", "#3A1F0B"] as const,
  gradientCard: ["#F26B1D", "#B8480A"] as const,

  // ── Neutrals ──────────────────────────────────────────────────────
  bg: "#121212", // background geral
  bgCard: "#1E1E1E", // card
  bgDark: "#0A0A0A", // fundo hero login
  bgDarkCard: "#1A1A1A",

  // ── Text ──────────────────────────────────────────────────────────
  textPrimary: "#FFFFFF", // texto principal no escuro
  textSecondary: "#A9A9A9", // secondary
  textMuted: "#7C7C7C", // placeholder / muted
  textWhite: "#FFFFFF",
  textOnPrimary: "#FFFFFF",

  // ── Status ────────────────────────────────────────────────────────
  success: "#22C55E",
  successBg: "#122E1B",
  successFg: "#4ADE80",
  danger: "#EF4444",
  dangerBg: "#361517",
  dangerFg: "#F87171",
  warning: "#F59E0B",
  warningBg: "#33240B",
  warningFg: "#FBBF24", // âmbar claro: no fundo escuro o tom escuro sumia
  info: "#3B82F6",
  infoBg: "#12233D",
  infoFg: "#60A5FA",
  neutralBg: "#242424",

  // ── Border ────────────────────────────────────────────────────────
  border: "#2C2C2C", // hairline no escuro
  borderStrong: "#3A3A3A",
  borderFocus: "#F26B1D",

  // ── Shadows (tom slate, difusas e "flutuantes") ───────────────────
  // No web usamos boxShadow (shadow* está deprecado no react-native-web);
  // no nativo mantemos shadow* (iOS) + elevation (Android).
  shadow: Platform.select({
    web: { boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.45)" },
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
    web: { boxShadow: "0px 8px 20px rgba(0, 0, 0, 0.55)" },
    default: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 3,
    },
  }) as object,
  shadowStrong: Platform.select({
    web: { boxShadow: "0px 16px 32px rgba(0, 0, 0, 0.7)" },
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
