import { useMutation } from '@tanstack/react-query';
import { authService } from './auth.service';
import { useAuthStore } from '../../store/auth';
import type { AuthResponse, LoginPayload, PrimeiroAcessoPayload } from './auth.types';

/**
 * Persiste a sessão no store após login/primeiro-acesso bem-sucedido.
 * O redirecionamento por tipo de usuário é responsabilidade da tela.
 */
function useSalvarSessao() {
  const setTokens = useAuthStore((s) => s.setTokens);
  return async (data: AuthResponse) => {
    await setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tipoUsuario: data.tipoUsuario,
      usuarioId: data.usuarioId,
      nome: data.nome,
    });
  };
}

export function useLogin() {
  const salvarSessao = useSalvarSessao();
  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: salvarSessao,
  });
}

export function usePrimeiroAcesso() {
  const salvarSessao = useSalvarSessao();
  return useMutation({
    mutationFn: (payload: PrimeiroAcessoPayload) => authService.primeiroAcesso(payload),
    onSuccess: salvarSessao,
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        try {
          await authService.logout(refreshToken);
        } catch {
          // logout local prossegue mesmo se a chamada remota falhar
        }
      }
    },
    onSettled: () => logout(),
  });
}
