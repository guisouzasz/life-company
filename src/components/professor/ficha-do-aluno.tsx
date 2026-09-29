import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { Loading, ErrorState } from '../ui/states';
import { FichaExercicios, type ExercicioAberto } from './ficha-exercicios';
import { alertasDaFicha } from './ficha-saude';
import { cargaDeHoje, diasAte, fichaSugerida, ordenarFichas } from './situacao';
import { useTreinosDoAluno } from '../../services/treinos/treinos.queries';
import { useCargasDoAluno } from '../../services/cargas/cargas.queries';
import { useAnamneseDoAluno } from '../../services/anamnese/anamnese.queries';
import { formatDate } from '../../services/date';
import { nomeCurto } from '../../services/nome';

/** Aquecimento (antes) ou o complemento (depois) escrito livre na ficha. */
function TextoLivre({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={s.livre}>
      <Text style={s.livreTitulo}>{titulo}</Text>
      <Text style={s.livreTexto}>{texto}</Text>
    </View>
  );
}

/** "Treino A — Inferiores" → ["Treino A", "Inferiores"]. */
function partesDoTitulo(titulo: string): [string, string | null] {
  const m = titulo.split(/\s+[—–-]\s+/);
  return m.length > 1 ? [m[0], m.slice(1).join(' — ')] : [titulo, null];
}

/**
 * O treino de um aluno durante a aula: alerta de saúde, uma aba por ficha e
 * os exercícios da ficha escolhida.
 *
 * Quem tem Treino A, B e C tinha as três fichas empilhadas numa rolagem só —
 * 25 exercícios em sequência, e o professor procurando onde começava a de
 * hoje. Agora é uma aba por ficha, e a de hoje já vem aberta: é a que está
 * há mais tempo sem carga registrada (ver `fichaSugerida`), com o motivo
 * escrito embaixo para o professor concordar ou trocar num toque.
 *
 * Vive separado porque aparece no celular (tela da sala) e no tablet (painel
 * ao lado da turma). O que muda entre os dois é só a moldura.
 */

interface Props {
  alunoId?: string;
  /** Falso desliga as consultas — a tela fechada não busca nada. */
  ativo: boolean;
  onAbrirCarga: (exercicio: ExercicioAberto & { sequencia: ExercicioAberto[] }) => void;
  /** Abre a ficha de saúde completa. */
  onVerFicha: () => void;
  /** Limita a rolagem. Sem isto, ocupa a altura que o pai der. */
  alturaMax?: number;
}

export function FichaDoAluno({ alunoId, ativo, onAbrirCarga, onVerFicha, alturaMax }: Props) {
  const treinos = useTreinosDoAluno(alunoId, ativo);
  const cargas = useCargasDoAluno(alunoId, ativo);
  const anamnese = useAnamneseDoAluno(alunoId, ativo);

  const evolucaoDe = (nome: string) => (cargas.data ?? []).find((e) => e.exercicio === nome) ?? null;

  const ativos = useMemo(() => ordenarFichas((treinos.data ?? []).filter((t) => !t.concluido)), [treinos.data]);
  const arquivadas = (treinos.data ?? []).length - ativos.length;
  const sugestao = useMemo(() => fichaSugerida(ativos, cargas.data ?? []), [ativos, cargas.data]);

  // A aba aberta: a escolhida pelo professor, senão a sugerida, senão a primeira.
  const [escolhida, setEscolhida] = useState<string | null>(null);
  useEffect(() => setEscolhida(null), [alunoId]);
  const aberta = ativos.find((t) => t.id === escolhida) ?? ativos.find((t) => t.id === sugestao?.id) ?? ativos[0];

  const alertas = alertasDaFicha(anamnese.data);

  const feitos = aberta ? aberta.exercicios.filter((e) => cargaDeHoje(evolucaoDe(e.nome))).length : 0;
  const total = aberta?.exercicios.length ?? 0;
  const diasVenc = aberta?.vencimento ? diasAte(aberta.vencimento) : null;

  return (
    <>
      {alertas.length > 0 ? (
        <Pressable style={s.alerta} onPress={onVerFicha} accessibilityRole="button" accessibilityLabel="Ver ficha de saúde">
          <View style={s.alertaIcone}>
            <Icon name="medkit" size={15} color="#fff" />
          </View>
          <Text style={s.alertaTexto} numberOfLines={2}>{alertas.join(' · ')}</Text>
          <Icon name="chevron-forward" size={15} color={LC.warningFg} />
        </Pressable>
      ) : anamnese.data ? (
        <Pressable style={s.saudeOk} onPress={onVerFicha} accessibilityRole="button" accessibilityLabel="Ver ficha de saúde">
          <Icon name="shield-checkmark-outline" size={15} color={LC.successFg} />
          <Text style={s.saudeOkTexto}>Ficha de saúde sem alertas</Text>
        </Pressable>
      ) : anamnese.isSuccess ? (
        <View style={s.saudeOk}>
          <Icon name="help-circle-outline" size={15} color={LC.textMuted} />
          <Text style={[s.saudeOkTexto, { color: LC.textMuted }]}>Ainda não preencheu a ficha de saúde</Text>
        </View>
      ) : null}

      {/*
        Uma aba por ficha — só quando há mais de uma. Até três cabem lado a
        lado, com o nome em duas linhas ("Treino A" / "Inferiores"); mais do
        que isso vira uma fileira que rola.
      */}
      {ativos.length > 1 ? (
        <ScrollView
          horizontal
          scrollEnabled={ativos.length > 3}
          showsHorizontalScrollIndicator={false}
          style={s.abasScroll}
          contentContainerStyle={[s.abas, ativos.length <= 3 && { flexGrow: 1 }]}
        >
          {ativos.map((t) => {
            const sel = t.id === aberta?.id;
            const hoje = t.id === sugestao?.id;
            const [principal, detalhe] = partesDoTitulo(t.titulo);
            return (
              <Pressable
                key={t.id}
                style={[s.aba, ativos.length <= 3 && s.abaCheia, sel && s.abaSel]}
                onPress={() => setEscolhida(t.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${t.titulo}${hoje ? ' (sugerido para hoje)' : ''}`}
              >
                <View style={s.abaLinha}>
                  <Text style={[s.abaTexto, sel && s.abaTextoSel]} numberOfLines={1}>{principal}</Text>
                  {hoje ? (
                    <View style={[s.hojeSelo, sel && s.hojeSeloSel]}>
                      <Text style={[s.hojeSeloTexto, sel && { color: LC.primary }]}>HOJE</Text>
                    </View>
                  ) : null}
                </View>
                {detalhe ? (
                  <Text style={[s.abaDetalhe, sel && s.abaDetalheSel]} numberOfLines={1}>{detalhe}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {sugestao && aberta?.id === sugestao.id && ativos.length > 1 ? (
        <Text style={s.motivo}>
          <Icon name="sparkles-outline" size={12} color={LC.primary} /> Sugerido para hoje: {sugestao.motivo}.
        </Text>
      ) : null}

      <ScrollView style={alturaMax ? { maxHeight: alturaMax } : { flex: 1 }} showsVerticalScrollIndicator>
        {treinos.isLoading ? (
          <View style={{ height: 120 }}>
            <Loading />
          </View>
        ) : treinos.isError ? (
          <ErrorState onRetry={() => treinos.refetch()} />
        ) : !aberta ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}>
              <Icon name="document-text-outline" size={26} color={LC.danger} />
            </View>
            <Text style={s.vazioTitulo}>Sem ficha de treino</Text>
            <Text style={s.vazioTexto}>
              {arquivadas > 0
                ? `${arquivadas === 1 ? 'A ficha anterior está arquivada' : `As ${arquivadas} fichas anteriores estão arquivadas`}. Toque em "Montar ficha" para fazer a próxima.`
                : 'Toque em "Montar ficha" para criar o primeiro treino.'}
            </Text>
          </View>
        ) : (
          <View>
            <View style={s.fichaTopo}>
              <View style={{ flex: 1 }}>
                {ativos.length === 1 ? <Text style={s.fichaTitulo}>{aberta.titulo}</Text> : null}
                <Text style={s.fichaMeta}>
                  {[
                    total ? `${total} exercícios` : null,
                    aberta.frequencia,
                    aberta.professor ? `prof. ${nomeCurto(aberta.professor.nome)}` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {diasVenc !== null ? (
                <View style={[s.venc, diasVenc < 0 ? s.vencVencida : diasVenc <= 10 ? s.vencPerto : null]}>
                  <Text style={[s.vencTexto, diasVenc < 0 ? { color: LC.dangerFg } : diasVenc <= 10 ? { color: LC.warningFg } : null]}>
                    {diasVenc < 0 ? `Venceu ${formatDate(aberta.vencimento!, 'DD/MM')}` : `Vence ${formatDate(aberta.vencimento!, 'DD/MM')}`}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Progresso da aula: quantos exercícios já têm carga de hoje. */}
            {total > 0 && feitos > 0 ? (
              <View style={s.progresso}>
                <View style={s.progressoTrilho}>
                  <View style={[s.progressoBarra, { width: `${Math.round((feitos / total) * 100)}%` }]} />
                </View>
                <Text style={s.progressoTexto}>
                  {feitos === total ? 'Ficha completa hoje!' : `${feitos} de ${total} com carga hoje`}
                </Text>
              </View>
            ) : null}

            {/*
              A observação vem antes dos exercícios: em aula o professor lê de
              cima para baixo e começa a série. "Dor no ombro" no rodapé é lida
              depois de já ter mandado fazer.
            */}
            {aberta.observacoes ? (
              <View style={s.obs}>
                <Icon name="alert-circle" size={16} color={LC.warningFg} />
                <Text style={s.obsTexto}>{aberta.observacoes}</Text>
              </View>
            ) : null}

            {aberta.textoAntes ? <TextoLivre titulo="Antes dos exercícios" texto={aberta.textoAntes} /> : null}
            <FichaExercicios exercicios={aberta.exercicios} evolucaoDe={evolucaoDe} onAbrirCarga={onAbrirCarga} />
            {aberta.conteudo ? <Text style={s.conteudo}>{aberta.conteudo}</Text> : null}
            <View style={{ height: 12 }} />
          </View>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
    backgroundColor: LC.warningBg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  alertaIcone: { width: 28, height: 28, borderRadius: 9, backgroundColor: LC.warning, alignItems: 'center', justifyContent: 'center' },
  alertaTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: LC.warningFg, lineHeight: 18 },
  saudeOk: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  saudeOkTexto: { fontSize: 12.5, fontWeight: '700', color: LC.successFg },

  abasScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 4 },
  abas: { gap: 8, paddingVertical: 2 },
  aba: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.borderStrong, maxWidth: 220,
  },
  abaCheia: { flex: 1, maxWidth: undefined },
  abaLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  abaDetalhe: { fontSize: 11.5, fontWeight: '600', color: LC.textMuted, marginTop: 1 },
  abaDetalheSel: { color: 'rgba(255,255,255,0.85)' },
  abaSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  abaTexto: { fontSize: 13.5, fontWeight: '700', color: LC.textSecondary, flexShrink: 1 },
  abaTextoSel: { color: '#fff', fontWeight: '800' },
  hojeSelo: { backgroundColor: LC.primaryLight, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  hojeSeloSel: { backgroundColor: '#fff' },
  hojeSeloTexto: { fontSize: 9.5, fontWeight: '900', color: LC.primary, letterSpacing: 0.6 },
  motivo: { fontSize: 12, color: LC.textSecondary, marginTop: 4, marginBottom: 4, lineHeight: 17 },

  fichaTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  fichaTitulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  fichaMeta: { fontSize: 12.5, color: LC.textSecondary, marginTop: 2 },
  venc: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: LC.neutralBg },
  vencPerto: { backgroundColor: LC.warningBg },
  vencVencida: { backgroundColor: LC.dangerBg },
  vencTexto: { fontSize: 11.5, fontWeight: '800', color: LC.textSecondary },

  progresso: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressoTrilho: { flex: 1, height: 8, borderRadius: 4, backgroundColor: LC.neutralBg, overflow: 'hidden' },
  progressoBarra: { height: '100%', borderRadius: 4, backgroundColor: LC.success },
  progressoTexto: { fontSize: 12, fontWeight: '800', color: LC.successFg },

  obs: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: LC.warningBg, borderRadius: 12, padding: 11, marginTop: 10,
  },
  obsTexto: { flex: 1, fontSize: 13, color: LC.warningFg, lineHeight: 19, fontWeight: '700' },

  vazio: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12 },
  vazioIcone: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: LC.dangerBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  vazioTitulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  vazioTexto: { fontSize: 13, color: LC.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 19 },

  conteudo: { fontSize: 14, color: LC.textPrimary, lineHeight: 22, marginTop: 8 },
  livre: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border },
  livreTitulo: { fontSize: 11.5, fontWeight: '800', color: LC.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  livreTexto: { fontSize: 14, color: LC.textPrimary, lineHeight: 21 },
});
