//import '@/global.css';
import { Appearance, Platform } from "react-native";

// ─── Tema claro/escuro ────────────────────────────────────────────────────────
// Os StyleSheets capturam as cores do LC na carga dos módulos, então a paleta
// é escolhida UMA vez na inicialização (preferência salva > tema do sistema) e
// alternar o tema recarrega o app para repintar tudo.
export type Tema = 'claro' | 'escuro';
const TEMA_KEY = 'lc-tema';

function temaSalvo(): Tema | null {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const t = localStorage.getItem(TEMA_KEY);
      if (t === 'claro' || t === 'escuro') return t;
    }
  } catch {}
  return null;
}

export const temaAtual: Tema =
  temaSalvo() ?? (Appearance?.getColorScheme?.() === 'dark' ? 'escuro' : 'claro');

/** Alterna claro/escuro, salva a preferência e recarrega o app. */
export function alternarTema(): void {
  const novo: Tema = temaAtual === 'escuro' ? 'claro' : 'escuro';
  if (Platform.OS === 'web') {
    try { localStorage.setItem(TEMA_KEY, novo); } catch {}
    try { (globalThis as any).location?.reload?.(); } catch {}
    return;
  }
  // Nativo: aplica na sessão via Appearance e recarrega o bundle (dev).
  try { (Appearance as any).setColorScheme?.(novo === 'escuro' ? 'dark' : 'light'); } catch {}
  try { const { DevSettings } = require('react-native'); DevSettings?.reload?.(); } catch {}
}

// ─── Paletas ──────────────────────────────────────────────────────────────────
const paletaClara = {
  brand: "#028E94",
  primary: "#0E9488",
  primaryDark: "#0B6F66",
  primaryLight: "#E6F4F1",
  primaryMid: "#16B8A7",
  primarySoft: "#D2ECE7",

  bg: "#F8FAFC",
  bgCard: "#FFFFFF",
  bgDark: "#0F172A",
  bgDarkCard: "#1E293B",

  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textWhite: "#FFFFFF",
  textOnPrimary: "#FFFFFF",

  success: "#22C55E",
  successBg: "#DCFCE7",
  successFg: "#15803D",
  danger: "#EF4444",
  dangerBg: "#FEE2E2",
  dangerFg: "#B91C1C",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  info: "#3B82F6",
  infoBg: "#DBEAFE",
  infoFg: "#1D4ED8",
  neutralBg: "#F1F5F9",

  border: "#EEF1F4",
  borderStrong: "#E2E8F0",
  borderFocus: "#0E9488",
};

const paletaEscura: typeof paletaClara = {
  brand: "#028E94",
  primary: "#14B8A6", // teal um tom mais claro p/ contraste no escuro
  primaryDark: "#0E9488",
  primaryLight: "#12332F", // tint escuro (fundos de chips/ícones)
  primaryMid: "#2DD4BF",
  primarySoft: "#164B45",

  bg: "#0B1220",
  bgCard: "#161F30",
  bgDark: "#0F172A",
  bgDarkCard: "#1E293B",

  textPrimary: "#F1F5F9",
  textSecondary: "#9CA8BB",
  textMuted: "#64748B",
  textWhite: "#FFFFFF",
  textOnPrimary: "#FFFFFF",

  success: "#34D399",
  successBg: "#0E2E22",
  successFg: "#4ADE80",
  danger: "#F87171",
  dangerBg: "#391D1F",
  dangerFg: "#FCA5A5",
  warning: "#FBBF24",
  warningBg: "#39300F",
  info: "#60A5FA",
  infoBg: "#172A4A",
  infoFg: "#93C5FD",
  neutralBg: "#233047",

  border: "#232E42",
  borderStrong: "#334155",
  borderFocus: "#14B8A6",
};

const paleta = temaAtual === 'escuro' ? paletaEscura : paletaClara;

// ─── Life Company Design System ───────────────────────────────────────────────
export const LC = {
  ...paleta,

  // Gradientes (hero/cards — escuros por natureza, iguais nos dois temas)
  gradientHero: ["#063A3D", "#055F63", "#028E94"] as const,
  gradientCard: ["#0E9488", "#0B6F66"] as const,

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
// >= desktop: admin vira painel com sidebar (web); abaixo disso, layout mobile.
export const Breakpoints = { desktop: 1024 } as const;
