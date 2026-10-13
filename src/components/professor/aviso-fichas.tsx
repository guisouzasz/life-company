import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import { useResumoTreinos } from '../../services/treinos/treinos.queries';
import { formatDate } from '../../services/date';
import { nomeCurto } from '../../services/nome';
import { AVISO_DIAS, diasAte } from './situacao';

/**
 * Aviso de troca de ficha, na primeira tela do professor.
 *
 * Pedido da dona: a professora entra no app e já vê quais fichas venceram e
 * quais vencem na próxima semana — sem ter de lembrar de abrir Treinos e
 * tocar em "Precisam de você". O botão leva direto para essa lista, onde a
 * ficha é trocada.
 *
 * Só alunos das modalidades dela (o resumo da API já vem filtrado assim) e
 * que treinam com ela: aula na semana ou ficha em uso.
 */
export function AvisoFichas({ style }: { style?: object | null }) {
  const alunos = useAlunos();
  const resumo = useResumoTreinos();

  const { vencidas, vencendo } = useMemo(() => {
    const ativos = new Map((alunos.data ?? []).filter((a) => a.ativo).map((a) => [a.id, a.nome]));
    const lista = (resumo.data ?? [])
      .filter((r) => ativos.has(r.alunoId) && r.fichas > 0 && r.vencimento)
      .map((r) => ({ nome: ativos.get(r.alunoId)!, vencimento: r.vencimento!, dias: diasAte(r.vencimento!) }))
      .sort((a, b) => a.dias - b.dias);
    return {
      vencidas: lista.filter((x) => x.dias < 0),
      vencendo: lista.filter((x) => x.dias >= 0 && x.dias <= AVISO_DIAS),
    };
  }, [alunos.data, resumo.data]);

  if (vencidas.length === 0 && vencendo.length === 0) return null;

  const quando = (dias: number, vencimento: string) =>
    dias < 0 ? `venceu ${formatDate(vencimento, 'DD/MM')}`
    : dias === 0 ? 'vence hoje'
    : dias === 1 ? 'vence amanhã'
    : `vence ${formatDate(vencimento, 'DD/MM')}`;
  const primeiros = [...vencidas, ...vencendo].slice(0, 4);
  const resto = vencidas.length + vencendo.length - primeiros.length;

  return (
    <Pressable
      style={({ pressed }) => [s.card, vencidas.length > 0 && s.cardUrgente, style, pressed && { opacity: 0.85 }]}
      onPress={() => router.replace({ pathname: '/professor/treinos' as any, params: { filtro: 'atencao' } })}
      accessibilityRole="button"
      accessibilityLabel="Ver as fichas para trocar"
    >
      <View style={s.topo}>
        <Icon name="alert-circle-outline" size={18} color={vencidas.length > 0 ? LC.dangerFg : LC.warningFg} />
        <Text style={s.titulo}>Troca de ficha</Text>
      </View>
      <Text style={s.resumo}>
        {[
          vencidas.length > 0 ? `${vencidas.length} ${vencidas.length === 1 ? 'ficha vencida' : 'fichas vencidas'}` : null,
          vencendo.length > 0 ? `${vencendo.length} ${vencendo.length === 1 ? 'vence' : 'vencem'} nos próximos ${AVISO_DIAS} dias` : null,
        ].filter(Boolean).join(' · ')}
      </Text>
      {primeiros.map((x) => (
        <Text key={x.nome + x.vencimento} style={[s.linha, x.dias < 0 && { color: LC.dangerFg }]} numberOfLines={1}>
          • {nomeCurto(x.nome)} — {quando(x.dias, x.vencimento)}
        </Text>
      ))}
      {resto > 0 ? <Text style={s.linha}>e mais {resto}</Text> : null}
      <View style={s.acao}>
        <Text style={s.acaoTexto}>Ver e trocar as fichas</Text>
        <Icon name="chevron-forward" size={16} color={LC.primary} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: LC.warningBg, borderRadius: LC.radius.lg, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: LC.warning,
  },
  cardUrgente: { backgroundColor: LC.dangerBg, borderColor: LC.danger },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  titulo: { fontSize: 15, fontWeight: '800', color: LC.textPrimary },
  resumo: { fontSize: 13, fontWeight: '700', color: LC.textPrimary, marginTop: 4, marginBottom: 6 },
  linha: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  acaoTexto: { fontSize: 13.5, fontWeight: '800', color: LC.primary },
});
