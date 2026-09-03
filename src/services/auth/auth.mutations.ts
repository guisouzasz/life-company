import { useMutation } from '@tanstack/react-query';
import { authService } from './auth.service';
import { useAuthStore } from '../../store/auth';
import type { AtivarContaPayload, AuthResponse, LoginPayload, PrimeiroAcessoPayload } from './auth.types';

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

export function useAtivarConta() {
  const salvarSessao = useSalvarSessao();
  return useMutation({
    mutationFn: (payload: AtivarContaPayload) => authService.ativarConta(payload),
    onSuccess: salvarSessao,
  });
}

/** Exclui a conta no servidor e encerra a sessão local. */
export function useExcluirConta() {
  const logout = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: () => authService.excluirConta(),
    onSuccess: () => logout(),
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

/**
 * Trocar a própria senha. Não mexe no cache de sessão: o token atual continua
 * válido — quem cai são as OUTRAS sessões, do lado do servidor.
 */
export function useAlterarSenha() {
  return useMutation({
    mutationFn: (payload: { senhaAtual: string; novaSenha: string }) =>
      authService.alterarSenha(payload),
  });
}

/**
 * Pede o link de redefinir senha por e-mail. Rota pública — não mexe em
 * nenhum cache, porque não há sessão para atualizar.
 */
export function useEsqueciSenha() {
  return useMutation({
    mutationFn: (payload: { email: string }) => authService.esqueciSenha(payload),
  });
}
