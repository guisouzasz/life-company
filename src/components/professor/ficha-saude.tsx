import { StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import { BonecoDor } from '../anamnese/boneco-dor';
import { listaDoJson, rotuloDaRegiao } from '../../constants/anamnese';
import type { Anamnese } from '../../services/anamnese/anamnese.types';
import { formatDate } from '../../services/date';
import { nomeCurto } from '../../services/nome';

/**
 * O que o aluno respondeu sobre a saúde dele.
 *
 * Vive separado do pop-up porque aparece em dois lugares muito diferentes:
 * espremido num modal durante a aula, e em tela cheia quando o professor
 * recebe um aluno pela primeira vez e precisa ler tudo antes de montar
 * qualquer treino.
 */

/**
 * O que faz o professor mudar o treino — fica em cima, sempre.
 *
 * A ordem importa: PAR-Q primeiro, porque é a única parte da ficha que pode
 * significar "não treine hoje, procure um médico". Depois o que muda a
 * prescrição (dor, lesão, cirurgia), depois o que muda a intensidade.
 *
 * As perguntas antigas (`problemasSaude` em texto livre) continuam gerando
 * alerta enquanto houver fichas preenchidas na versão anterior — deixar de
 * olhá-las esconderia um problema de saúde já declarado.
 */
export function alertasDaFicha(ficha?: Anamnese | null): string[] {
  if (!ficha) return [];

  const parq = listaDoJson(ficha.parq);
  const patologias = listaDoJson(ficha.patologias);
  const regioes = listaDoJson(ficha.regioesDor);

  return [
    parq.length > 0 ? `PAR-Q: ${parq.length} resposta(s) de risco` : null,
    ficha.temDor
      ? regioes.length > 0
        ? `Dor: ${regioes.map(rotuloDaRegiao).join(', ')}`
        : 'Sente dor'
      : null,
    ficha.temLesao ? 'Lesão atual' : null,
    ficha.fezCirurgia ? 'Cirurgia ou internação' : null,
    patologias.length > 0 ? `${patologias.length} patologia(s)` : null,
    ficha.patologiaOutra ? 'Outra condição declarada' : null,
    ficha.usaMedicamento ? 'Medicamento controlado' : null,
    // Fichas da versão anterior, que não tinham as listas acima.
    !patologias.length && ficha.problemasSaude ? 'Problema de saúde' : null,
    !ficha.temLesao && ficha.lesoes ? 'Lesão ou cirurgia' : null,
    ficha.temDor == null && ficha.dores ? 'Dores' : null,
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

/** Uma pergunta sim/não com o detalhe ao lado. `null` = não respondeu. */
function SimNao({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor?: boolean | null;
  detalhe?: string | null;
}) {
  const resposta = valor == null ? 'Não informado' : valor ? 'Sim' : 'Não';
  return (
    <View style={s.campo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={[s.valor, valor == null && s.valorVazio]}>
        {resposta}
        {valor && detalhe?.trim() ? ` — ${detalhe.trim()}` : ''}
      </Text>
    </View>
  );
}

/** Lista marcada, como selos. Some quando o aluno não marcou nada. */
function Marcadas({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <View style={s.campo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <View style={s.selos}>
        {itens.map((i) => (
          <View key={i} style={s.selo}>
            <Text style={s.seloTexto}>{i}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface Props {
  ficha?: Anamnese | null;
  alunoNome: string;
  /**
   * No modal só cabe o que importa; em tela cheia mostramos tudo, inclusive
   * o que ficou em branco — saber que o aluno NÃO respondeu a profissão é
   * diferente de não ver a linha da profissão.
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
          {nomeCurto(alunoNome)} não respondeu a ficha de saúde no app. Vale pedir que preencha
          antes do primeiro treino — é onde ele conta lesões, cirurgias e limitações.
        </Text>
      </View>
    );
  }

  const objetivos = listaDoJson(ficha.objetivos);
  const patologias = listaDoJson(ficha.patologias);
  const parq = listaDoJson(ficha.parq);
  const regioes = listaDoJson(ficha.regioesDor);

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

      {/*
        Contato de emergência em cima de tudo, e destacado. É a única resposta
        que a ficha exige, e a única que alguém vai procurar correndo.
      */}
      {ficha.contatoEmergenciaNome || ficha.contatoEmergenciaTelefone ? (
        <View style={s.emergencia}>
          <Icon name="call-outline" size={15} color={LC.dangerFg} />
          <Text style={s.emergenciaTexto}>
            Emergência: {ficha.contatoEmergenciaNome ?? '—'}
            {ficha.contatoEmergenciaTelefone ? ` · ${ficha.contatoEmergenciaTelefone}` : ''}
          </Text>
        </View>
      ) : null}

      {/* `objetivo`/`nivelAtividade` são as fichas da versão anterior. */}
      <Marcadas rotulo="Objetivo" itens={objetivos} />
      {objetivos.length === 0 ? <Campo rotulo="Objetivo" valor={ficha.objetivo} /> : null}
      <Campo rotulo="Experiência com treino" valor={ficha.experiencia ?? ficha.nivelAtividade} />

      <Marcadas rotulo="Patologias" itens={patologias} />
      {patologias.length === 0 ? (
        <Campo rotulo="Problemas de saúde" valor={ficha.problemasSaude} />
      ) : null}
      {ficha.patologiaOutra ? <Campo rotulo="Outra condição" valor={ficha.patologiaOutra} /> : null}

      <SimNao rotulo="Sente dor" valor={ficha.temDor} detalhe={ficha.dores} />
      {ficha.temDor && regioes.length > 0 ? (
        <View style={s.campo}>
          <Text style={s.rotulo}>Onde dói</Text>
          <View style={s.boneco}>
            <BonecoDor marcadas={regioes} onAlternar={() => {}} somenteLeitura />
          </View>
        </View>
      ) : null}

      <SimNao rotulo="Lesão atual" valor={ficha.temLesao} detalhe={ficha.lesoes} />
      <SimNao rotulo="Cirurgia ou internação" valor={ficha.fezCirurgia} detalhe={ficha.cirurgiaQual} />
      <SimNao rotulo="Medicamento controlado" valor={ficha.usaMedicamento} detalhe={ficha.medicamentos} />

      {completa ? (
        <>
          <Marcadas rotulo="PAR-Q — respostas de risco" itens={parq} />
          {parq.length === 0 && ficha.parq !== undefined ? (
            <View style={s.campo}>
              <Text style={s.rotulo}>PAR-Q</Text>
              <Text style={s.valor}>Nenhuma das opções se aplica</Text>
            </View>
          ) : null}

          <Campo rotulo="Profissão" valor={ficha.profissao} />
          <Campo rotulo="Postura na maior parte do dia" valor={ficha.posturaPredominante} />
          <SimNao
            rotulo="Movimentos repetitivos no trabalho"
            valor={ficha.movimentosRepetitivos}
            detalhe={ficha.movimentosRepetitivosQuais}
          />
          <Campo rotulo="Observações do aluno" valor={ficha.observacoes} />
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

  emergencia: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: LC.dangerBg, borderRadius: LC.radius.md,
    padding: 11, marginBottom: 16,
  },
  emergenciaTexto: { flex: 1, fontSize: 13.5, fontWeight: '700', color: LC.dangerFg, lineHeight: 19 },

  campo: { marginBottom: 14 },
  rotulo: { fontSize: 11, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  valor: { fontSize: 14.5, color: LC.textPrimary, marginTop: 3, lineHeight: 20 },
  valorVazio: { color: LC.textMuted, fontStyle: 'italic' },

  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  selo: { backgroundColor: LC.neutralBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  seloTexto: { fontSize: 12.5, color: LC.textPrimary, fontWeight: '600' },

  boneco: { marginTop: 8 },

  rodape: { fontSize: 11.5, color: LC.textMuted, marginTop: 4 },

  vazio: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 16 },
  vazioTitulo: { fontSize: 15.5, fontWeight: '800', color: LC.textPrimary, marginTop: 12 },
  vazioTexto: {
    fontSize: 13.5, color: LC.textSecondary, textAlign: 'center',
    lineHeight: 19, marginTop: 8, maxWidth: 340,
  },
});
