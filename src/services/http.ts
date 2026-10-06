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

/*
  Mensagens para quando a resposta não traz uma frase do servidor para o
  aluno. Sem elas a tela mostrava o que o axios ou o Nest escrevem — "Network
  Error", "timeout of 20000ms exceeded", "ThrottlerException: Too Many
  Requests", "Internal server error" —, em inglês e sem dizer o que fazer.
*/
const SEM_CONEXAO = 'Sem conexão com o servidor. Confira sua internet e tente de novo.';
const DEMOROU = 'O servidor demorou para responder. Tente de novo.';
const MUITAS_TENTATIVAS = 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
const ERRO_DO_SERVIDOR = 'O sistema teve um problema agora. Tente de novo em instantes.';
const SESSAO_ENCERRADA = 'Sua sessão terminou. Entre de novo.';

function mensagemDe(error: AxiosError, status: number): string {
  if (!error.response) return error.code === 'ECONNABORTED' ? DEMOROU : SEM_CONEXAO;
  if (status === 429) return MUITAS_TENTATIVAS;
  if (status >= 500) return ERRO_DO_SERVIDOR;
  const data = error.response.data as { message?: string | string[] } | undefined;
  const doServidor = Array.isArray(data?.message) ? data?.message[0] : data?.message;
  // O 401 do guard de JWT não tem frase nossa: só "Unauthorized".
  if (status === 401 && (!doServidor || doServidor === 'Unauthorized')) return SESSAO_ENCERRADA;
  return doServidor || 'Não deu para concluir agora. Tente de novo.';
}

/**
 * Resultado da renovação: o token novo, ou por que não veio.
 *
 * `rede` (sem internet, servidor reiniciando) NÃO encerra a sessão: o aluno
 * tenta de novo daqui a pouco e continua logado. Antes, qualquer falha aqui
 * deslogava — um túnel no caminho da academia e era preciso digitar a senha
 * outra vez. Só o servidor dizendo que a renovação não vale mais encerra.
 */
type Renovacao = { token: string } | { falha: 'sessao' | 'rede' };

let refreshing: Promise<Renovacao> | null = null;

async function tentarRefresh(): Promise<Renovacao> {
  const { refreshToken, setTokens, logout, tipoUsuario, usuarioId, nome } =
    useAuthStore.getState();
  if (!refreshToken) {
    await logout();
    return { falha: 'sessao' };
  }
  try {
    const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 20000 });
    await setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? refreshToken,
      tipoUsuario: data.tipoUsuario ?? tipoUsuario!,
      usuarioId: data.usuarioId ?? usuarioId!,
      nome: data.nome ?? nome!,
    });
    return { token: data.accessToken as string };
  } catch (e) {
    const status = (e as AxiosError).response?.status ?? 0;
    if (status === 0 || status === 429 || status >= 500) return { falha: 'rede' };
    await logout();
    return { falha: 'sessao' };
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status ?? 0;
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    // Só quem está logado tem sessão para renovar. O 401 do primeiro acesso
    // ("CPF não corresponde") é resposta da própria tela, não sessão vencida.
    const { accessToken, refreshToken } = useAuthStore.getState();
    const temSessao = !!accessToken || !!refreshToken;

    if (status === 401 && original && !original._retry && !isAuthCall && temSessao) {
      original._retry = true;
      refreshing = refreshing ?? tentarRefresh();
      const renovacao = await refreshing;
      refreshing = null;
      if ('token' in renovacao) {
        original.headers = { ...original.headers, Authorization: `Bearer ${renovacao.token}` };
        return http(original);
      }
      if (renovacao.falha === 'rede') {
        return Promise.reject(new ApiError(SEM_CONEXAO, 0, error.response?.data));
      }
    }

    return Promise.reject(new ApiError(mensagemDe(error, status), status, error.response?.data));
  },
);
