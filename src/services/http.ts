/**
 * Cliente HTTP único da aplicação (axios).
 *
 * - Injeta automaticamente o header Authorization: Bearer <token>
 *   lendo o token direto do store de auth (Zustand).
 * - Em 401, tenta renovar o token via /auth/refresh uma única vez.
 * - Normaliza qualquer falha para a classe ApiError.
 *
 * Nenhuma página deve importar axios diretamente: use os services/hooks
 * de cada módulo, que consomem este cliente.
 */
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth';

export const BASE_URL = 'https://life-company-production.up.railway.app';

/** Erro padronizado de API consumido pelas telas. */
export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: anexa o Bearer token ────────────────────────────────────────────
http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: refresh em 401 + normalização de erro ──────────────────────────
let refreshing: Promise<string | null> | null = null;

async function tentarRefresh(): Promise<string | null> {
  const { refreshToken, setTokens, logout, tipoUsuario, usuarioId, nome } =
    useAuthStore.getState();
  if (!refreshToken) {
    await logout();
    return null;
  }
  try {
    const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
    await setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? refreshToken,
      tipoUsuario: data.tipoUsuario ?? tipoUsuario!,
      usuarioId: data.usuarioId ?? usuarioId!,
      nome: data.nome ?? nome!,
    });
    return data.accessToken as string;
  } catch {
    await logout();
    return null;
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status ?? 0;
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing ?? tentarRefresh();
      const novoToken = await refreshing;
      refreshing = null;
      if (novoToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${novoToken}` };
        return http(original);
      }
    }

    const data = error.response?.data as { message?: string | string[] } | undefined;
    const mensagem =
      (Array.isArray(data?.message) ? data?.message[0] : data?.message) ||
      error.message ||
      'Erro de conexão';
    return Promise.reject(new ApiError(mensagem, status, error.response?.data));
  },
);
