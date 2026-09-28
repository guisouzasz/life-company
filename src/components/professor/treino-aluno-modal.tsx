import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { Avatar } from '../ui/avatar';
import { FichaDoAluno } from './ficha-do-aluno';
import { CargaExercicioModal } from './carga-exercicio-modal';
import { AnamneseModal } from './anamnese-modal';
import { useStatusDaTurma } from './use-turma';
import { apelidosDaTurma } from './situacao';
import type { ExercicioAberto } from './ficha-exercicios';
import { useAnamneseDoAluno } from '../../services/anamnese/anamnese.queries';
import { nomeCurto } from '../../services/nome';

/**
 * A sala: o treino de cada aluno da turma, em tela cheia, no celular.
 *
 * Era um pop-up no meio da tela — a ficha espremida em 400px, o nome do aluno
 * em duas linhas de título e setas pequenas para trocar de aluno. Na sala o
 * professor passa a aula inteira aqui dentro, então ela ganhou a tela:
 *
 *  - a turma fica no topo, como fotos: um toque troca de aluno, e o pontinho
 *    avisa quem tem alerta de saúde (âmbar) ou está sem ficha (vermelho);
 *  - a ficha ocupa o resto, com uma aba por treino (A, B, C) e a de hoje
 *    aberta;
 *  - embaixo, largo, "Próximo: Carlos" — a ação mais repetida da aula.
 *
 * Registrar carga abre por cima e segue exercício a exercício.
 */

export interface AlunoDaAula {
  id: string;
  nome: string;
  /** Veio de crédito de reposição. */
  reposicao?: boolean;
  /** Encaixado pelo professor, fora da agenda oficial. */
  extra?: boolean;
  /** Hora da turma anterior, quando o aluno estourou o horário e segue na sala. */
  daTurmaDe?: string;
}

interface Props {
  alunos: AlunoDaAula[];
  /** Posição aberta na lista; null fecha. */
  indice: number | null;
  onIndice: (i: number) => void;
  onClose: () => void;
  /** "Aula das 18:00 · Musculação" — o topo da tela. */
  titulo?: string;
}

type CargaAberta = ExercicioAberto & { sequencia: ExercicioAberto[] };

export function TreinoAlunoModal({ alunos, indice, onIndice, onClose, titulo }: Props) {
  const aberto = indice !== null && indice >= 0 && indice < alunos.length;
  const aluno = aberto ? alunos[indice] : null;
  const anamnese = useAnamneseDoAluno(aluno?.id, aberto);
  const status = useStatusDaTurma(aberto ? alunos.map((a) => a.id) : []);

  const [cargaDe, setCargaDe] = useState<CargaAberta | null>(null);
  const [verFicha, setVerFicha] = useState(false);

  // Trocou de aluno: fecha o que estava aberto por cima.
  useEffect(() => {
    setCargaDe(null);
    setVerFicha(false);
  }, [aluno?.id]);

  const irPara = (i: number) => onIndice((i + alunos.length) % alunos.length);
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
  const apelidos = useMemo(() => apelidosDaTurma(alunos), [alunos]);
  const proximo = aberto && varios ? alunos[(indice! + 1) % alunos.length] : null;
  const st = aluno ? status[aluno.id] : null;

  return (
    <>
      <Modal visible={aberto} animationType="slide" onRequestClose={fechar}>
        <View style={s.root}>
          <View style={s.coluna}>
            {/* Topo */}
            <View style={s.topo}>
              <Pressable style={s.topoBtn} onPress={fechar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fechar a sala">
                <Icon name="chevron-down" size={22} color={LC.textPrimary} />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {titulo ? <Text style={s.topoTitulo}>{titulo}</Text> : null}
                <Text style={s.topoSub}>{varios ? `${(indice ?? 0) + 1} de ${alunos.length} na sala` : 'Único aluno na sala'}</Text>
              </View>
              <Pressable
                style={s.topoBtn}
                onPress={editar}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={st?.situacao.chave === 'sem-ficha' ? 'Montar ficha' : 'Editar fichas'}
              >
                <Icon name="create-outline" size={20} color={LC.primary} />
              </Pressable>
            </View>

            {/* A turma, como fotos: um toque troca de aluno. */}
            {varios ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.turmaScroll}
                contentContainerStyle={s.turma}
              >
                {alunos.map((a, i) => {
                  const sel = i === indice;
                  const sa = status[a.id];
                  const ponto = sa?.situacao.urgente ? LC.danger : sa?.alerta ? LC.warning : null;
                  return (
                    <Pressable
                      key={a.id}
                      style={[s.turmaItem, sel && s.turmaItemSel]}
                      onPress={() => irPara(i)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: sel }}
                      accessibilityLabel={`Ver ${a.nome}`}
                    >
                      <View>
                        <View style={[s.anel, sel && s.anelSel]}>
                          <Avatar nome={a.nome} size={42} />
                        </View>
                        {ponto ? <View style={[s.ponto, { backgroundColor: ponto }]} /> : null}
                      </View>
                      <Text style={[s.turmaNome, sel && s.turmaNomeSel]} numberOfLines={1}>
                        {apelidos[a.id]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {aluno ? (
              <View style={s.corpo}>
                {/* Quem é */}
                <View style={s.quem}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome} numberOfLines={1}>{nomeCurto(aluno.nome)}</Text>
                    <View style={s.tags}>
                      {aluno.reposicao ? <Tag texto="Reposição" cor={LC.infoFg} fundo={LC.infoBg} /> : null}
                      {aluno.extra ? <Tag texto="Encaixe" cor={LC.warningFg} fundo={LC.warningBg} /> : null}
                      {aluno.daTurmaDe ? <Tag texto={`Turma das ${aluno.daTurmaDe}`} cor={LC.textSecondary} fundo={LC.neutralBg} /> : null}
                      {st && !st.carregando && st.situacao.chave !== 'em-dia' ? (
                        <Tag texto={st.situacao.rotulo} cor={st.situacao.cor} fundo={st.situacao.fundo} />
                      ) : null}
                    </View>
                  </View>
                  {st?.situacao.chave === 'sem-ficha' ? (
                    <Pressable style={s.montar} onPress={editar} accessibilityRole="button">
                      <Icon name="add" size={16} color="#fff" />
                      <Text style={s.montarTexto}>Montar ficha</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <FichaDoAluno
                    key={aluno.id}
                    alunoId={aluno.id}
                    ativo={aberto}
                    onAbrirCarga={setCargaDe}
                    onVerFicha={() => setVerFicha(true)}
                  />
                </View>
              </View>
            ) : null}

            {/* Rodapé: avançar na turma é o que mais se faz na aula. */}
            {proximo ? (
              <View style={s.rodape}>
                <Pressable
                  style={s.anterior}
                  onPress={() => irPara((indice ?? 0) - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Aluno anterior"
                >
                  <Icon name="chevron-back" size={22} color={LC.textPrimary} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.proximo, pressed && { opacity: 0.9 }]}
                  onPress={() => irPara((indice ?? 0) + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Próximo aluno"
                >
                  <Text style={s.proximoTexto} numberOfLines={1}>Próximo: {apelidos[proximo.id]}</Text>
                  <Icon name="chevron-forward" size={20} color="#fff" />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Irmãos, não aninhados: abrem por cima da sala. */}
      <CargaExercicioModal
        exercicio={cargaDe?.nome ?? null}
        alunoId={aluno?.id}
        alunoNome={aluno?.nome}
        repeticoesPadrao={cargaDe?.reps}
        cargaFicha={cargaDe?.carga}
        sequencia={cargaDe?.sequencia}
        onIr={(e) => setCargaDe((atual) => (atual ? { ...atual, ...e } : atual))}
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

function Tag({ texto, cor, fundo }: { texto: string; cor: string; fundo: string }) {
  return (
    <View style={[s.tag, { backgroundColor: fundo }]}>
      <Text style={[s.tagTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  coluna: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },

  topo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: Platform.OS === 'web' ? 14 : 52, paddingBottom: 8,
  },
  topoBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  topoTitulo: { fontSize: 12, fontWeight: '800', color: LC.primary, letterSpacing: 0.6, textTransform: 'uppercase' },
  topoSub: { fontSize: 12.5, color: LC.textSecondary, marginTop: 1 },

  turmaScroll: { flexGrow: 0, flexShrink: 0 },
  turma: { paddingHorizontal: 12, gap: 4, paddingBottom: 6 },
  turmaItem: { alignItems: 'center', width: 68, paddingVertical: 6, borderRadius: 14 },
  turmaItemSel: { backgroundColor: LC.primaryLight },
  anel: { padding: 2, borderRadius: 26, borderWidth: 2, borderColor: 'transparent' },
  anelSel: { borderColor: LC.primary },
  ponto: {
    position: 'absolute', right: 1, top: 1, width: 13, height: 13, borderRadius: 7,
    borderWidth: 2, borderColor: LC.bg,
  },
  turmaNome: { fontSize: 12, fontWeight: '600', color: LC.textSecondary, marginTop: 3, maxWidth: 64 },
  turmaNomeSel: { color: LC.primaryDark, fontWeight: '800' },

  corpo: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },
  quem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  nome: { fontSize: 22, fontWeight: '800', color: LC.textPrimary, letterSpacing: -0.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  tagTexto: { fontSize: 11.5, fontWeight: '800' },
  montar: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: LC.primary,
  },
  montarTexto: { fontSize: 13.5, fontWeight: '800', color: '#fff' },

  rodape: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1, borderTopColor: LC.border, backgroundColor: LC.bg,
  },
  anterior: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  proximo: {
    flex: 1, height: 54, borderRadius: 16, backgroundColor: LC.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    ...LC.shadowCard,
  },
  proximoTexto: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
