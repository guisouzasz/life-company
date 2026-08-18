import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { nomeModalidade } from '../../constants/assets';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { Avatar } from '../ui/avatar';
import { Loading } from '../ui/states';
import { TreinoAlunoModal, type AlunoDaAula } from './treino-aluno-modal';
import { AdicionarAlunoModal } from './adicionar-aluno-modal';
import { useAulaAgora } from '../../hooks/use-aula-agora';
import { useAlunosExtras } from '../../services/aula-extras';
import { useAgendamentosDoHorario } from '../../services/agendamentos/agendamentos.queries';
import type { HorarioVaga } from '../../services/horarios/horarios.types';

/**
 * A aula que está acontecendo, no topo da tela do professor.
 *
 * O problema que isto resolve: com quatro alunos na sala, ver a ficha de cada
 * um custava abrir a agenda, achar o horário, abrir a lista, tocar no nome,
 * voltar e repetir. Aqui os quatro já estão na tela; um toque abre a ficha e
 * de dentro dela se passa para o próximo.
 */

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

interface Props {
  /** Aulas de hoje do professor (já filtradas pelo dia da semana). */
  aulasDeHoje: HorarioVaga[];
  /** Data de hoje em YYYY-MM-DD. */
  hoje: string;
  /**
   * A modalidade tem ficha por aluno (Musculação, Pilates). No Funcional o
   * treino é um só para a turma, então tocar num aluno não levaria a lugar
   * nenhum — a lista serve para saber quem está na sala.
   */
  porAluno: boolean;
}

export function AulaAgora({ aulasDeHoje, hoje, porAluno }: Props) {
  const { foco, anterior } = useAulaAgora(aulasDeHoje);
  const aula = foco?.aula ?? null;

  const agendamentos = useAgendamentosDoHorario(aula?.id, hoje, !!aula);
  // Turma que acabou de sair, quando a próxima já começou: quem estourou o
  // horário continua treinando, e o professor precisa da ficha dele.
  const daAnterior = useAgendamentosDoHorario(anterior?.id, hoje, !!anterior);
  const { extras, adicionar, remover } = useAlunosExtras(hoje, aula?.id);

  const [indice, setIndice] = useState<number | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  const alunos: AlunoDaAula[] = useMemo(() => {
    const daAgenda = (agendamentos.data ?? [])
      .map((ag) => ({ id: ag.usuario.id, nome: ag.usuario.nome, reposicao: !!ag.reposicao }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // Encaixes ficam no fim: quem está na agenda oficial vem primeiro.
    const encaixes = extras
      .filter((e) => !daAgenda.some((a) => a.id === e.id))
      .map((e) => ({ id: e.id, nome: e.nome, extra: true }));
    const atuais = [...daAgenda, ...encaixes];
    // Quem ficou da turma anterior entra por último e sinalizado. Aluno
    // agendado nas duas aulas conta uma vez só, como aluno da atual.
    const restantes = anterior
      ? (daAnterior.data ?? [])
          .filter((ag) => !atuais.some((a) => a.id === ag.usuario.id))
          .map((ag) => ({ id: ag.usuario.id, nome: ag.usuario.nome, daTurmaDe: anterior.horaInicio }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      : [];
    return [...atuais, ...restantes];
  }, [agendamentos.data, extras, daAnterior.data, anterior]);

  if (!aula || !foco) return null;

  // Índice em que começam os alunos da turma anterior (-1 = não há)
  const inicioRestantes = alunos.findIndex((a) => a.daTurmaDe);

  const rotulo =
    foco.estado === 'agora' ? 'AGORA' : foco.estado === 'proxima' ? 'A SEGUIR' : 'ENCERRANDO';
  const corRotulo = foco.estado === 'agora' ? LC.success : LC.textSecondary;

  return (
    <View style={s.wrap}>
      <Card style={s.card} padding={16}>
        <View style={s.topo}>
          <View style={[s.rotulo, { backgroundColor: corRotulo + '1A' }]}>
            <View style={[s.ponto, { backgroundColor: corRotulo }]} />
            <Text style={[s.rotuloTexto, { color: corRotulo }]}>{rotulo}</Text>
          </View>
          <Text style={s.hora}>
            {aula.horaInicio} – {aula.horaFim}
          </Text>
          <Text style={s.modalidade}>{nomeModalidade(aula.modalidade.nome)}</Text>
        </View>

        {agendamentos.isLoading ? (
          <View style={{ height: 70 }}>
            <Loading />
          </View>
        ) : alunos.length === 0 ? (
          <Text style={s.vazio}>Nenhum aluno agendado nesta aula.</Text>
        ) : (
          <View style={s.grade}>
            {alunos.map((a, i) => (
              <Fragment key={a.id}>
                {i === inicioRestantes ? (
                  <View style={s.separador}>
                    <Text style={s.separadorTexto}>
                      Ainda na sala · turma das {a.daTurmaDe}
                    </Text>
                  </View>
                ) : null}
              <Pressable
                style={({ pressed }) => [
                  s.aluno,
                  pressed && s.alunoPress,
                  !porAluno && s.alunoInerte,
                  a.daTurmaDe && s.alunoAnterior,
                ]}
                onPress={porAluno ? () => setIndice(i) : undefined}
                disabled={!porAluno}
                accessibilityRole={porAluno ? 'button' : undefined}
                accessibilityLabel={porAluno ? `Ver treino de ${a.nome}` : undefined}
              >
                <Avatar nome={a.nome} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={s.alunoNome} numberOfLines={1}>
                    {primeiroNome(a.nome)}
                  </Text>
                  {a.reposicao ? (
                    <Text style={s.alunoTag}>reposição</Text>
                  ) : a.extra ? (
                    <Text style={[s.alunoTag, { color: LC.warningFg }]}>encaixe</Text>
                  ) : a.daTurmaDe ? (
                    <Text style={[s.alunoTag, { color: LC.textMuted }]}>das {a.daTurmaDe}</Text>
                  ) : null}
                </View>
                {a.extra ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() => remover(a.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Tirar ${primeiroNome(a.nome)} da aula`}
                  >
                    <Icon name="close" size={15} color={LC.textMuted} />
                  </Pressable>
                ) : porAluno ? (
                  <Icon name="chevron-forward" size={16} color={LC.primary} />
                ) : null}
              </Pressable>
              </Fragment>
            ))}
          </View>
        )}

        <View style={s.rodape}>
          <Pressable
            style={s.encaixar}
            onPress={() => setAdicionando(true)}
            accessibilityRole="button"
            accessibilityLabel="Encaixar aluno na aula"
          >
            <Icon name="person-add-outline" size={15} color={LC.primary} />
            <Text style={s.encaixarTexto}>Encaixar aluno</Text>
          </Pressable>

          {!porAluno ? (
            <Pressable
              style={s.linkDia}
              onPress={() => router.push('/professor/treinos' as any)}
              accessibilityRole="button"
            >
              <Text style={s.linkDiaTexto}>Treino do dia</Text>
              <Icon name="chevron-forward" size={15} color={LC.primary} />
            </Pressable>
          ) : alunos.length > 1 ? (
            <Pressable style={s.linkDia} onPress={() => setIndice(0)} accessibilityRole="button">
              <Text style={s.linkDiaTexto}>Ver as {alunos.length} fichas</Text>
              <Icon name="chevron-forward" size={15} color={LC.primary} />
            </Pressable>
          ) : null}
        </View>
      </Card>

      <TreinoAlunoModal
        alunos={alunos}
        indice={indice}
        onIndice={setIndice}
        onClose={() => setIndice(null)}
      />
      <AdicionarAlunoModal
        visible={adicionando}
        jaNaAula={alunos.map((a) => a.id)}
        onEscolher={adicionar}
        onClose={() => setAdicionando(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { ...LC.coluna, paddingHorizontal: 16, paddingBottom: 4 },
  card: { borderWidth: 1.5, borderColor: LC.primaryLight },

  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: LC.radius.full },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  rotuloTexto: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  hora: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  modalidade: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aluno: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    flexGrow: 1, flexBasis: '46%', minWidth: 150,
    backgroundColor: LC.bg, borderRadius: LC.radius.md, borderWidth: 1, borderColor: LC.border,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  alunoPress: { borderColor: LC.primary, backgroundColor: LC.primaryLight },
  alunoInerte: { opacity: 0.95 },
  // Quem sobrou da turma anterior fica visivelmente mais apagado, para não
  // ser confundido com a turma de agora numa olhada rápida.
  alunoAnterior: { backgroundColor: LC.bgCard, borderStyle: 'dashed' },
  // Ocupa a linha inteira da grade, separando as duas turmas
  separador: { flexBasis: '100%', paddingTop: 6, paddingBottom: 2 },
  separadorTexto: { fontSize: 11, fontWeight: '700', color: LC.textMuted, letterSpacing: 0.3 },
  alunoNome: { fontSize: 13.5, fontWeight: '700', color: LC.textPrimary },
  alunoTag: { fontSize: 10.5, fontWeight: '700', color: LC.infoFg, marginTop: 1 },

  vazio: { fontSize: 13, color: LC.textSecondary, paddingVertical: 10 },

  rodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  encaixar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  encaixarTexto: { fontSize: 13, fontWeight: '700', color: LC.primary },
  linkDia: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  linkDiaTexto: { fontSize: 13, fontWeight: '700', color: LC.primary },
});
