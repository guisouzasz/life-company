import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { Loading, ErrorState } from '../ui/states';
import { FichaExercicios } from './ficha-exercicios';
import { alertasDaFicha } from './ficha-saude';
import { useTreinosDoAluno } from '../../services/treinos/treinos.queries';
import { useCargasDoAluno } from '../../services/cargas/cargas.queries';
import { useAnamneseDoAluno } from '../../services/anamnese/anamnese.queries';
import { formatDate } from '../../services/date';

/**
 * O treino de um aluno em leitura: alerta de saúde no topo e as fichas
 * ativas logo abaixo.
 *
 * Vive separado porque aparece em dois lugares que não se parecem: no pop-up
 * do celular e no painel lateral do tablet, onde fica aberto o tempo todo ao
 * lado da lista da turma. O que muda entre os dois é só a moldura.
 */

interface Props {
  alunoId?: string;
  /** Falso desliga as consultas — o pop-up fechado não busca nada. */
  ativo: boolean;
  onAbrirCarga: (exercicio: { nome: string; reps: string }) => void;
  /** Abre a ficha de saúde completa. */
  onVerFicha: () => void;
  /** Limita a rolagem (pop-up). Sem isto, ocupa a altura que o pai der. */
  alturaMax?: number;
}

export function FichaDoAluno({ alunoId, ativo, onAbrirCarga, onVerFicha, alturaMax }: Props) {
  const treinos = useTreinosDoAluno(alunoId, ativo);
  const cargas = useCargasDoAluno(alunoId, ativo);
  const anamnese = useAnamneseDoAluno(alunoId, ativo);

  const evolucaoDe = (nome: string) => (cargas.data ?? []).find((e) => e.exercicio === nome) ?? null;

  // A ficha que interessa em aula é a que está valendo; as concluídas ficam
  // só como contagem, para o professor saber que existe histórico.
  const todas = treinos.data ?? [];
  const ativos = todas.filter((t) => !t.concluido);
  const concluidos = todas.length - ativos.length;

  // Mesma regra da ficha em tela cheia — a lista de alertas mora num lugar só.
  const alertas = alertasDaFicha(anamnese.data);

  return (
    <>
      {alertas.length > 0 ? (
        <Pressable style={s.alerta} onPress={onVerFicha} accessibilityRole="button">
          <Icon name="warning-outline" size={16} color={LC.warningFg} />
          <Text style={s.alertaTexto} numberOfLines={2}>{alertas.join(' • ')}</Text>
          <Icon name="chevron-forward" size={15} color={LC.warningFg} />
        </Pressable>
      ) : anamnese.data ? (
        <Pressable style={s.fichaLink} onPress={onVerFicha} accessibilityRole="button">
          <Icon name="clipboard-outline" size={15} color={LC.primary} />
          <Text style={s.fichaLinkTexto}>Ver ficha de saúde</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={alturaMax ? { maxHeight: alturaMax } : { flex: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {treinos.isLoading ? (
          <View style={{ height: 120 }}>
            <Loading />
          </View>
        ) : treinos.isError ? (
          <ErrorState onRetry={() => treinos.refetch()} />
        ) : ativos.length === 0 ? (
          <Text style={s.vazio}>
            {concluidos > 0
              ? `Nenhuma ficha ativa — ${concluidos} já concluída${concluidos > 1 ? 's' : ''}. Abra os treinos do aluno para montar a próxima.`
              : 'Este aluno ainda não tem treino montado.'}
          </Text>
        ) : (
          ativos.map((t) => (
            <View key={t.id} style={s.treino}>
              <View style={s.treinoTopo}>
                <Text style={s.treinoTitulo}>{t.titulo.toUpperCase()}</Text>
                {t.frequencia ? <Text style={s.treinoMeta}>{t.frequencia}</Text> : null}
              </View>
              {t.conteudo ? <Text style={s.conteudo}>{t.conteudo}</Text> : null}
              <FichaExercicios exercicios={t.exercicios} evolucaoDe={evolucaoDe} onAbrirCarga={onAbrirCarga} />
              {t.observacoes ? <Text style={s.obs}>{t.observacoes}</Text> : null}
              {t.vencimento ? (
                <Text style={s.venc}>Ficha vence em {formatDate(t.vencimento, 'DD/MM/YYYY')}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
    backgroundColor: LC.warningBg, borderRadius: LC.radius.md, paddingHorizontal: 12, paddingVertical: 9,
  },
  alertaTexto: { flex: 1, fontSize: 12.5, fontWeight: '700', color: LC.warningFg },
  fichaLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  fichaLinkTexto: { fontSize: 12.5, fontWeight: '700', color: LC.primary },

  vazio: { fontSize: 13.5, color: LC.textSecondary, lineHeight: 20, paddingVertical: 18 },
  treino: { marginBottom: 14 },
  treinoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  treinoTitulo: { fontSize: 14.5, fontWeight: '800', color: LC.primary, letterSpacing: 0.4 },
  treinoMeta: { fontSize: 12, color: LC.textSecondary },
  conteudo: { fontSize: 14, color: LC.textPrimary, lineHeight: 22, marginTop: 8 },
  obs: { fontSize: 12, color: LC.textMuted, marginTop: 8, fontStyle: 'italic' },
  venc: { fontSize: 11.5, color: LC.textMuted, marginTop: 6 },
});
