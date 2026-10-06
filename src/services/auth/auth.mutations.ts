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
  return async (data: AuthResponse, destinoAoEntrar?: string) => {
    await setTokens(
      {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tipoUsuario: data.tipoUsuario,
        usuarioId: data.usuarioId,
        nome: data.nome,
      },
      destinoAoEntrar,
    );
  };
}

/**
 * Ativação de conta: o aluno vai para `destinoDoAluno` (a ficha de saúde) em
 * vez do Início. Fica aqui, no onSuccess da mutação, e não no `mutate` da
 * tela: o do `mutate` não roda quando a tela é desmontada — e ela é, assim que
 * a sessão é salva e o layout leva a pessoa para dentro do app.
 */
type OpcoesAtivacao = { destinoDoAluno?: string };

export function useLogin() {
  const salvarSessao = useSalvarSessao();
  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    // Só o `data`: o segundo argumento do onSuccess é o pedido, não um destino.
    onSuccess: (data) => salvarSessao(data),
  });
}

export function usePrimeiroAcesso({ destinoDoAluno }: OpcoesAtivacao = {}) {
  const salvarSessao = useSalvarSessao();
  return useMutation({
    mutationFn: (payload: PrimeiroAcessoPayload) => authService.primeiroAcesso(payload),
    onSuccess: (data) => salvarSessao(data, data.tipoUsuario === 'ALUNO' ? destinoDoAluno : undefined),
  });
}

export function useAtivarConta({ destinoDoAluno }: OpcoesAtivacao = {}) {
  const salvarSessao = useSalvarSessao();
  return useMutation({
    mutationFn: (payload: AtivarContaPayload) => authService.ativarConta(payload),
    onSuccess: (data) => salvarSessao(data, data.tipoUsuario === 'ALUNO' ? destinoDoAluno : undefined),
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
 * Trocar a própria senha. As OUTRAS sessões caem, do lado do servidor; esta
 * continua com os tokens novos que vêm na resposta — os antigos caíram junto.
 */
export function useAlterarSenha() {
  const salvarSessao = useSalvarSessao();
  return useMutation({
    mutationFn: (payload: { senhaAtual: string; novaSenha: string }) =>
      authService.alterarSenha(payload),
    onSuccess: async (data) => {
      if (data.accessToken && data.refreshToken) await salvarSessao(data as AuthResponse);
    },
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
