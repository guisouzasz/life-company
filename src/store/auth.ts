/**
 * Store de autenticação usando React Context + useReducer
 * Sem dependências externas (zustand não está instalado)
 */
import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { Storage } from '../services/storage';

export type TipoUsuario = 'ADMIN' | 'ALUNO';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  tipoUsuario: TipoUsuario | null;
  usuarioId: string | null;
  nome: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'SET_TOKENS'; payload: Omit<AuthState, 'isAuthenticated' | 'isLoading'> }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; value: boolean };

const initial: AuthState = {
  accessToken: null, refreshToken: null, tipoUsuario: null,
  usuarioId: null, nome: null, isAuthenticated: false, isLoading: true,
};

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_TOKENS': return { ...action.payload, isAuthenticated: true, isLoading: false };
    case 'LOGOUT': return { ...initial, isLoading: false };
    case 'SET_LOADING': return { ...state, isLoading: action.value };
    default: return state;
  }
}

// Context
import React from 'react';
const AuthCtx = createContext<{
  state: AuthState;
  setTokens: (data: { accessToken: string; refreshToken: string; tipoUsuario: TipoUsuario; usuarioId: string; nome: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const setTokens = useCallback(async (data: any) => {
    await Storage.multiSet([
      ['accessToken', data.accessToken],
      ['refreshToken', data.refreshToken ?? ''],
      ['tipoUsuario', data.tipoUsuario],
      ['usuarioId', data.usuarioId ?? ''],
      ['nome', data.nome ?? ''],
    ]);
    dispatch({ type: 'SET_TOKENS', payload: { ...data, isAuthenticated: true, isLoading: false } });
  }, []);

  const logout = useCallback(async () => {
    await Storage.multiRemove(['accessToken', 'refreshToken', 'tipoUsuario', 'usuarioId', 'nome']);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const loadFromStorage = useCallback(async () => {
    try {
      const pairs = await Storage.multiGet(['accessToken', 'refreshToken', 'tipoUsuario', 'usuarioId', 'nome']);
      const map = Object.fromEntries(pairs);
      if (map.accessToken) {
        dispatch({
          type: 'SET_TOKENS',
          payload: {
            accessToken: map.accessToken,
            refreshToken: map.refreshToken,
            tipoUsuario: map.tipoUsuario as TipoUsuario,
            usuarioId: map.usuarioId,
            nome: map.nome,
            isAuthenticated: true,
            isLoading: false,
          },
        });
      } else {
        dispatch({ type: 'SET_LOADING', value: false });
      }
    } catch {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }, []);

  return React.createElement(AuthCtx.Provider, { value: { state, setTokens, logout, loadFromStorage } }, children);
}

export function useAuthStore() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuthStore deve ser usado dentro de AuthProvider');
  return {
    ...ctx.state,
    setTokens: ctx.setTokens,
    logout: ctx.logout,
    loadFromStorage: ctx.loadFromStorage,
  };
}
