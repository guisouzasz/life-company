import { StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import type { Anamnese } from '../../services/anamnese/anamnese.types';
import { formatDate } from '../../services/date';

/**
 * O que o aluno respondeu sobre a saúde dele.
 *
 * Vive separado do pop-up porque agora aparece em dois lugares muito
 * diferentes: espremido num modal durante a aula, e em tela cheia quando o
 * professor recebe um aluno pela primeira vez e precisa ler tudo antes de
 * montar qualquer treino.
 */

/** O que faz o professor mudar o treino — fica em cima, sempre. */
export function alertasDaFicha(ficha?: Anamnese | null): string[] {
  if (!ficha) return [];
  return [
    ficha.gestante ? 'Gestante' : null,
    !ficha.liberacaoMedica ? 'Sem liberação médica' : null,
    ficha.lesoes ? 'Lesão ou cirurgia' : null,
    ficha.problemasSaude ? 'Problema de saúde' : null,
    ficha.dores ? 'Dores' : null,
    ficha.fumante ? 'Fumante' : null,
  ].filter(Boolean) as string[];
}

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <View style={s.campo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={[s.valor, !valor && s.valorVazio]}>{valor?.trim() || 'Não informado'}</Text>
    </View>
  );
}

interface Props {
  ficha?: Anamnese | null;
  alunoNome: string;
  /**
   * No modal só cabe o que importa; em tela cheia mostramos todos os campos,
   * inclusive os em branco — saber que o aluno NÃO respondeu alergias é
   * diferente de não ver a linha de alergias.
   */
  completa?: boolean;
}

export function FichaSaude({ ficha, alunoNome, completa = false }: Props) {
  const alertas = alertasDaFicha(ficha);

  if (!ficha) {
    return (
      <View style={s.vazio}>
        <Icon name="clipboard-outline" size={34} color={LC.textMuted} />
        <Text style={s.vazioTitulo}>Ficha ainda não preenchida</Text>
        <Text style={s.vazioTexto}>
          {alunoNome.split(' ')[0]} não respondeu a ficha de saúde no app. Vale pedir que preencha
          antes do primeiro treino — é onde ele conta lesões, cirurgias e limitações.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {alertas.length > 0 ? (
        <View style={s.alertaBloco}>
          <View style={s.alertaTopo}>
            <Icon name="warning-outline" size={16} color={LC.warningFg} />
            <Text style={s.alertaTitulo}>Atenção antes de montar o treino</Text>
          </View>
          <View style={s.alertas}>
            {alertas.map((a) => (
              <Badge key={a} label={a} variant="warning" />
            ))}
          </View>
        </View>
      ) : null}

      <Campo rotulo="Objetivo" valor={ficha.objetivo} />
      <Campo rotulo="Rotina de treino" valor={ficha.nivelAtividade} />
      <Campo rotulo="Lesões e cirurgias" valor={ficha.lesoes} />
      <Campo rotulo="Problemas de saúde" valor={ficha.problemasSaude} />
      <Campo rotulo="Dores" valor={ficha.dores} />
      {completa ? (
        <>
          <Campo rotulo="Medicamentos" valor={ficha.medicamentos} />
          <Campo rotulo="Alergias" valor={ficha.alergias} />
          <Campo rotulo="Observações do aluno" valor={ficha.observacoes} />
          <View style={s.simNao}>
            <Text style={s.simNaoItem}>Gestante: {ficha.gestante ? 'sim' : 'não'}</Text>
            <Text style={s.simNaoItem}>Fumante: {ficha.fumante ? 'sim' : 'não'}</Text>
            <Text style={s.simNaoItem}>
              Liberação médica: {ficha.liberacaoMedica ? 'sim' : 'não'}
            </Text>
          </View>
        </>
      ) : null}

      <Text style={s.rodape}>Preenchida em {formatDate(ficha.updatedAt, 'DD/MM/YYYY')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  alertaBloco: {
    backgroundColor: LC.warningBg, borderRadius: LC.radius.md,
    padding: 12, marginBottom: 16,
  },
  alertaTopo: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  alertaTitulo: { fontSize: 13, fontWeight: '800', color: LC.warningFg },
  alertas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  campo: { marginBottom: 14 },
  rotulo: { fontSize: 11, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  valor: { fontSize: 14.5, color: LC.textPrimary, marginTop: 3, lineHeight: 20 },
  valorVazio: { color: LC.textMuted, fontStyle: 'italic' },

  simNao: { gap: 4, marginTop: 2, marginBottom: 12 },
  simNaoItem: { fontSize: 13.5, color: LC.textSecondary },

  rodape: { fontSize: 11.5, color: LC.textMuted, marginTop: 4 },

  vazio: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 16 },
  vazioTitulo: { fontSize: 15.5, fontWeight: '800', color: LC.textPrimary, marginTop: 12 },
  vazioTexto: {
    fontSize: 13.5, color: LC.textSecondary, textAlign: 'center',
    lineHeight: 19, marginTop: 8, maxWidth: 340,
  },
});
