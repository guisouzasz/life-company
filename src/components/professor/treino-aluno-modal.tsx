import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import { FichaDoAluno } from './ficha-do-aluno';
import { CargaExercicioModal } from './carga-exercicio-modal';
import { AnamneseModal } from './anamnese-modal';
import { useAnamneseDoAluno } from '../../services/anamnese/anamnese.queries';

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
  /** Hora da turma anterior, quando o aluno estourou o horário e segue na sala. */
  daTurmaDe?: string;
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
  const anamnese = useAnamneseDoAluno(aluno?.id, aberto);


  const [cargaDe, setCargaDe] = useState<{ nome: string; reps: string } | null>(null);
  const [verFicha, setVerFicha] = useState(false);


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
              {(indice ?? 0) + 1} de {alunos.length} na sala
            </Text>
          ) : (
            <Text style={s.contador}>Único aluno na sala</Text>
          )}
          {aluno?.reposicao ? <Badge label="Reposição" variant="info" /> : null}
          {aluno?.extra ? <Badge label="Encaixe" variant="warning" /> : null}
          {aluno?.daTurmaDe ? <Badge label={`Turma das ${aluno.daTurmaDe}`} variant="neutral" /> : null}
        </View>

        <FichaDoAluno
          alunoId={aluno?.id}
          ativo={aberto}
          alturaMax={400}
          onAbrirCarga={setCargaDe}
          onVerFicha={() => setVerFicha(true)}
        />

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
