import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import { Loading, ErrorState } from '../ui/states';
import { FichaExercicios } from './ficha-exercicios';
import { CargaExercicioModal } from './carga-exercicio-modal';
import { AnamneseModal } from './anamnese-modal';
import { useTreinosDoAluno } from '../../services/treinos/treinos.queries';
import { useCargasDoAluno } from '../../services/cargas/cargas.queries';
import { useAnamneseDoAluno } from '../../services/anamnese/anamnese.queries';
import { formatDate } from '../../services/date';

/**
 * Ficha do aluno durante a aula, sem sair da tela.
 *
 * Numa turma de quatro o professor abre isto quatro vezes seguidas. Por isso a
 * navegação anterior/próximo mora aqui dentro: fechar o pop-up, procurar o
 * próximo nome e abrir de novo é justamente o que ele reclamou de fazer.
 *
 * É leitura + registro de carga. Editar a ficha continua na tela do aluno —
 * ninguém remonta treino em pé no meio da sala.
 */

export interface AlunoDaAula {
  id: string;
  nome: string;
  /** Veio de crédito de reposição. */
  reposicao?: boolean;
  /** Encaixado pelo professor, fora da agenda oficial. */
  extra?: boolean;
}

interface Props {
  alunos: AlunoDaAula[];
  /** Posição aberta na lista; null fecha o pop-up. */
  indice: number | null;
  onIndice: (i: number) => void;
  onClose: () => void;
}

export function TreinoAlunoModal({ alunos, indice, onIndice, onClose }: Props) {
  const aberto = indice !== null && indice >= 0 && indice < alunos.length;
  const aluno = aberto ? alunos[indice] : null;

  const treinos = useTreinosDoAluno(aluno?.id, aberto);
  const cargas = useCargasDoAluno(aluno?.id, aberto);
  const anamnese = useAnamneseDoAluno(aluno?.id, aberto);

  const [cargaDe, setCargaDe] = useState<{ nome: string; reps: string } | null>(null);
  const [verFicha, setVerFicha] = useState(false);

  const evolucaoDe = (nome: string) => (cargas.data ?? []).find((e) => e.exercicio === nome) ?? null;

  // A ficha que interessa em aula é a que está valendo; as concluídas ficam
  // só como contagem, para o professor saber que existe histórico.
  const todas = treinos.data ?? [];
  const ativos = todas.filter((t) => !t.concluido);
  const concluidos = todas.length - ativos.length;

  const alertas = [
    anamnese.data?.gestante ? 'Gestante' : null,
    anamnese.data && !anamnese.data.liberacaoMedica ? 'Sem liberação médica' : null,
    anamnese.data?.lesoes ? 'Lesão' : null,
    anamnese.data?.problemasSaude ? 'Problema de saúde' : null,
  ].filter(Boolean) as string[];

  const irPara = (delta: number) => {
    if (indice === null) return;
    const proximo = (indice + delta + alunos.length) % alunos.length;
    setCargaDe(null);
    setVerFicha(false);
    onIndice(proximo);
  };

  const fechar = () => {
    setCargaDe(null);
    setVerFicha(false);
    onClose();
  };

  const editar = () => {
    if (!aluno) return;
    fechar();
    router.push({ pathname: '/professor/treinos-aluno' as any, params: { id: aluno.id, nome: aluno.nome } });
  };

  const varios = alunos.length > 1;

  return (
    <>
      <AppModal
        visible={aberto}
        onClose={fechar}
        larguraMax={560}
        title={aluno?.nome ?? ''}
        headerLeft={
          varios ? (
            <Pressable
              style={s.seta}
              hitSlop={6}
              onPress={() => irPara(-1)}
              accessibilityRole="button"
              accessibilityLabel="Aluno anterior"
            >
              <Icon name="chevron-back" size={20} color={LC.textPrimary} />
            </Pressable>
          ) : null
        }
      >
        {/* Posição na turma + etiquetas do aluno */}
        <View style={s.subHeader}>
          {varios ? (
            <Text style={s.contador}>
              {(indice ?? 0) + 1} de {alunos.length} na aula
            </Text>
          ) : (
            <Text style={s.contador}>Único aluno na aula</Text>
          )}
          {aluno?.reposicao ? <Badge label="Reposição" variant="info" /> : null}
          {aluno?.extra ? <Badge label="Encaixe" variant="warning" /> : null}
        </View>

        {alertas.length > 0 ? (
          <Pressable style={s.alerta} onPress={() => setVerFicha(true)} accessibilityRole="button">
            <Icon name="warning-outline" size={16} color={LC.warningFg} />
            <Text style={s.alertaTexto} numberOfLines={2}>{alertas.join(' • ')}</Text>
            <Icon name="chevron-forward" size={15} color={LC.warningFg} />
          </Pressable>
        ) : anamnese.data ? (
          <Pressable style={s.fichaLink} onPress={() => setVerFicha(true)} accessibilityRole="button">
            <Icon name="clipboard-outline" size={15} color={LC.primary} />
            <Text style={s.fichaLinkTexto}>Ver ficha de saúde</Text>
          </Pressable>
        ) : null}

        <ScrollView style={s.corpo} showsVerticalScrollIndicator={false}>
          {treinos.isLoading ? (
            <View style={{ height: 120 }}>
              <Loading />
            </View>
          ) : treinos.isError ? (
            <ErrorState onRetry={() => treinos.refetch()} />
          ) : ativos.length === 0 ? (
            <Text style={s.vazio}>
              {concluidos > 0
                ? `Nenhuma ficha ativa — ${concluidos} já concluída${concluidos > 1 ? 's' : ''}. Toque em “Abrir treinos” para montar a próxima.`
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
                <FichaExercicios exercicios={t.exercicios} evolucaoDe={evolucaoDe} onAbrirCarga={setCargaDe} />
                {t.observacoes ? <Text style={s.obs}>{t.observacoes}</Text> : null}
                {t.vencimento ? (
                  <Text style={s.venc}>Ficha vence em {formatDate(t.vencimento, 'DD/MM/YYYY')}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        {/* Rodapé: avançar na turma é a ação mais repetida, então fica larga */}
        <View style={s.rodape}>
          <Pressable style={s.acaoSecundaria} onPress={editar} accessibilityRole="button">
            <Icon name="create-outline" size={16} color={LC.primary} />
            <Text style={s.acaoSecundariaTexto}>Abrir treinos</Text>
          </Pressable>
          {varios ? (
            <Pressable
              style={s.acaoPrincipal}
              onPress={() => irPara(1)}
              accessibilityRole="button"
              accessibilityLabel="Próximo aluno"
            >
              <Text style={s.acaoPrincipalTexto}>Próximo aluno</Text>
              <Icon name="chevron-forward" size={17} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      </AppModal>

      {/* Irmãos, não aninhados: dois modais empilhados dentro de um terceiro
          não têm comportamento confiável em todas as plataformas. */}
      <CargaExercicioModal
        exercicio={cargaDe?.nome ?? null}
        alunoId={aluno?.id}
        alunoNome={aluno?.nome}
        repeticoesPadrao={cargaDe?.reps}
        onClose={() => setCargaDe(null)}
      />
      <AnamneseModal
        visible={verFicha}
        alunoNome={aluno?.nome ?? ''}
        ficha={anamnese.data}
        onClose={() => setVerFicha(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  seta: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: LC.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 10 },
  contador: { fontSize: 12.5, color: LC.textMuted, fontWeight: '600' },

  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
    backgroundColor: LC.warningBg, borderRadius: LC.radius.md, paddingHorizontal: 12, paddingVertical: 9,
  },
  alertaTexto: { flex: 1, fontSize: 12.5, fontWeight: '700', color: LC.warningFg },
  fichaLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  fichaLinkTexto: { fontSize: 12.5, fontWeight: '700', color: LC.primary },

  corpo: { maxHeight: 400 },
  vazio: { fontSize: 13.5, color: LC.textSecondary, lineHeight: 20, paddingVertical: 18 },
  treino: { marginBottom: 14 },
  treinoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  treinoTitulo: { fontSize: 14.5, fontWeight: '800', color: LC.primary, letterSpacing: 0.4 },
  treinoMeta: { fontSize: 12, color: LC.textSecondary },
  conteudo: { fontSize: 14, color: LC.textPrimary, lineHeight: 22, marginTop: 8 },
  obs: { fontSize: 12, color: LC.textMuted, marginTop: 8, fontStyle: 'italic' },
  venc: { fontSize: 11.5, color: LC.textMuted, marginTop: 6 },

  rodape: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: LC.border },
  acaoSecundaria: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: LC.radius.md, backgroundColor: LC.primaryLight,
  },
  acaoSecundariaTexto: { fontSize: 13, fontWeight: '700', color: LC.primary },
  acaoPrincipal: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderRadius: LC.radius.md, backgroundColor: LC.primary,
  },
  acaoPrincipalTexto: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
});
