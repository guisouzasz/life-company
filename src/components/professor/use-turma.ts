import { useQueries } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-keys';
import { anamneseService } from '../../services/anamnese/anamnese.service';
import { useResumoTreinos } from '../../services/treinos/treinos.queries';
import { alertasDaFicha } from './ficha-saude';
import { situacaoDoAluno, type Situacao } from './situacao';

export type StatusDoAluno = {
  /** Resumo curto do alerta de saúde ("Dor: Joelho esquerdo"), se houver. */
  alerta: string | null;
  situacao: Situacao;
  /** Os dados ainda estão chegando — a tela não afirma nada antes. */
  carregando: boolean;
};

/**
 * O que o professor precisa saber de cada aluno da turma antes de chamar o
 * primeiro: quem tem alerta de saúde e quem está sem ficha (ou com ela
 * vencida).
 *
 * A anamnese é buscada aluno por aluno, com a MESMA chave de cache da ficha
 * aberta — quando o professor abre o aluno, ela já está lá. Turma de quatro
 * são quatro consultas pequenas, feitas uma vez.
 */
export function useStatusDaTurma(alunoIds: string[]): Record<string, StatusDoAluno> {
  const resumo = useResumoTreinos(alunoIds.length > 0);
  const fichas = useQueries({
    queries: alunoIds.map((id) => ({
      queryKey: queryKeys.anamneseAluno(id),
      queryFn: () => anamneseService.doAluno(id),
      staleTime: 5 * 60_000,
      // Aluno de outra modalidade responde 403: não adianta insistir.
      retry: false,
    })),
  });

  const status: Record<string, StatusDoAluno> = {};
  alunoIds.forEach((id, i) => {
    const alertas = alertasDaFicha(fichas[i]?.data);
    status[id] = {
      alerta: alertas.length > 0 ? alertas[0] + (alertas.length > 1 ? ` +${alertas.length - 1}` : '') : null,
      situacao: situacaoDoAluno((resumo.data ?? []).find((r) => r.alunoId === id)),
      carregando: resumo.isLoading || !!fichas[i]?.isLoading,
    };
  });
  return status;
}
