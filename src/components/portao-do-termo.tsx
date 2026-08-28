import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useLogout } from '../services/auth/auth.mutations';
import { useAceitarTermo, useMeuTermo } from '../services/termos/termos.queries';
import { ApiError } from '../services/http';
import { TermoModal } from './termo-modal';

/**
 * O aceite do termo para quem JÁ tinha conta.
 *
 * O aceite do primeiro acesso só alcança quem entra a partir de agora — a
 * turma que já usava o sistema nunca veria o texto, e é justamente ela que
 * está sujeita às regras de falta, reposição e mensalidade. Este portão fecha
 * essa lacuna: na primeira abertura depois do login, o aluno lê e aceita.
 *
 * Vale também quando o estúdio publicar uma redação nova: a consulta pergunta
 * pela versão vigente, então todo mundo é chamado de novo a ler o texto novo.
 *
 * Só aluno. Professor e admin não assinam um termo que fala de mensalidade e
 * reposição de aula — e a API devolve `precisaAceitar: false` para eles de
 * qualquer jeito.
 */
export function PortaoDoTermo() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tipoUsuario = useAuthStore((s) => s.tipoUsuario);
  const ehAluno = isAuthenticated && tipoUsuario === 'ALUNO';

  const situacao = useMeuTermo(ehAluno);
  const aceitar = useAceitarTermo();
  const logout = useLogout();
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Só abre com resposta na mão dizendo que falta aceitar. Enquanto carrega,
   * ou se a chamada falhar, o app segue normal e pergunta na próxima abertura
   * — uma falha de rede não pode trancar o aluno para fora do próprio app.
   */
  if (!ehAluno || !situacao.data?.precisaAceitar) return null;

  return (
    <TermoModal
      visible
      obrigatorio
      aviso={
        'Atualizamos as normas do estúdio. Para continuar usando o app, leia e aceite o termo abaixo.'
      }
      aceitando={aceitar.isPending}
      erro={erro}
      onAceitar={(versao) => {
        setErro(null);
        aceitar.mutate(versao, {
          onError: (e) =>
            setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar o aceite. Tente de novo.'),
        });
      }}
      // Sem aceitar não há app: a única saída é sair da conta.
      onFechar={() => logout.mutate()}
    />
  );
}
