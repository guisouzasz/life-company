/**
 * Camada de compatibilidade fina sobre o cliente axios (services/http.ts).
 *
 * Mantida para as telas legadas que chamam api.get/post/patch.
 * O token é injetado automaticamente pelo interceptor — o parâmetro `token`
 * permanece apenas por compatibilidade de assinatura e é ignorado.
 *
 * Código novo deve usar os services/hooks de cada módulo (services/<modulo>),
 * que consomem `http` diretamente.
 */
import { http, BASE_URL, ApiError } from './http';

export { BASE_URL, ApiError, http };

export const api = {
  async get<T = any>(path: string, _token?: string): Promise<T> {
    const { data } = await http.get<T>(path);
    return data;
  },
  async post<T = any>(path: string, body?: unknown, _token?: string): Promise<T> {
    const { data } = await http.post<T>(path, body ?? {});
    return data;
  },
  async patch<T = any>(path: string, body?: unknown, _token?: string): Promise<T> {
    const { data } = await http.patch<T>(path, body ?? {});
    return data;
  },
  async put<T = any>(path: string, body?: unknown, _token?: string): Promise<T> {
    const { data } = await http.put<T>(path, body ?? {});
    return data;
  },
  async del<T = any>(path: string, _token?: string): Promise<T> {
    const { data } = await http.delete<T>(path);
    return data;
  },
};
