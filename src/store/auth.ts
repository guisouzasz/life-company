/**
 * Store de autenticação (Zustand).
 * Mantém usuário, tokens e estado de sessão.
 * Fora de React, o token é lido via useAuthStore.getState().accessToken
 * (usado pelo interceptor do axios em services/http.ts).
 */
import { create } from 'zustand';
import { Storage } from '../services/storage';

export type TipoUsuario = 'ADMIN' | 'ALUNO' | 'PROFESSOR';

export interface Sessao {
  accessToken: string;
  refreshToken: string;
  tipoUsuario: TipoUsuario;
  usuarioId: string;
  nome: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  tipoUsuario: TipoUsuario | null;
  usuarioId: string | null;
  nome: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Para onde levar quem ACABOU de entrar, quando não é a tela inicial do
   * papel — o aluno que criou a senha agora vai para a ficha de saúde.
   *
   * Quem navega é o layout: ele já redireciona quem entra, e a tela do
   * primeiro acesso é desmontada nesse redirecionamento antes de conseguir
   * navegar por conta própria (por isso o aluno novo caía no Início e nunca
   * via a ficha). A tela só diz o destino; o layout leva e apaga.
   */
  destinoAoEntrar: string | null;
  setTokens: (data: Sessao, destinoAoEntrar?: string) => Promise<void>;
  limparDestino: () => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEYS = ['accessToken', 'refreshToken', 'tipoUsuario', 'usuarioId', 'nome'] as const;

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  tipoUsuario: null,
  usuarioId: null,
  nome: null,
  isAuthenticated: false,
  isLoading: true,
  destinoAoEntrar: null,

  setTokens: async (data, destinoAoEntrar) => {
    await Storage.multiSet([
      ['accessToken', data.accessToken],
      ['refreshToken', data.refreshToken ?? ''],
      ['tipoUsuario', data.tipoUsuario],
      ['usuarioId', data.usuarioId ?? ''],
      ['nome', data.nome ?? ''],
    ]);
    set({ ...data, isAuthenticated: true, isLoading: false, destinoAoEntrar: destinoAoEntrar ?? null });
  },

  limparDestino: () => set({ destinoAoEntrar: null }),

  logout: async () => {
    await Storage.multiRemove([...STORAGE_KEYS]);
    set({
      accessToken: null,
      refreshToken: null,
      tipoUsuario: null,
      usuarioId: null,
      nome: null,
      isAuthenticated: false,
      isLoading: false,
      destinoAoEntrar: null,
    });
  },

  hydrate: async () => {
    try {
      const pairs = await Storage.multiGet([...STORAGE_KEYS]);
      const map = Object.fromEntries(pairs) as Record<string, string | null>;
      if (map.accessToken) {
        set({
          accessToken: map.accessToken,
          refreshToken: map.refreshToken ?? null,
          tipoUsuario: (map.tipoUsuario as TipoUsuario) ?? null,
          usuarioId: map.usuarioId ?? null,
          nome: map.nome ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
