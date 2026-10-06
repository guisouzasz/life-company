import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { formatDate } from '../../services/date';
import { ApiError } from '../../services/http';
import { useMarcarConferenciaRevisada, useRodarConferencia } from '../../services/conferencia/conferencia.queries';
import type { Conferencia } from '../../services/conferencia/conferencia.types';

const hora = (iso: string) => formatDate(new Date(iso), 'HH:mm');
const diaMes = (yyyymmdd: string) => `${yyyymmdd.slice(8, 10)}/${yyyymmdd.slice(5, 7)}`;

/**
 * A conferência das 08:00, aberta pelo alerta do Início.
 *
 * Cada ponto diz o que achou, com quem, e o que fazer. Tocar no nome abre o
 * cadastro do aluno. "Conferir de novo" roda na hora — é como a dona vê que o
 * que ela arrumou resolveu. "Marcar como revisado" apaga o alerta até a
 * conferência de amanhã.
 */
export function ConferenciaModal({
  conferencia,
  visivel,
  onClose,
}: {
  conferencia: Conferencia | null | undefined;
  visivel: boolean;
  onClose: () => void;
}) {
  const rodar = useRodarConferencia();
  const revisar = useMarcarConferenciaRevisada();
  const [aviso, setAviso] = useState<string | null>(null);

  const r = conferencia?.resultado;
  const fechar = () => {
    setAviso(null);
    onClose();
  };
  const abrirAluno = (nome: string) => {
    fechar();
    router.push({ pathname: '/admin/alunos', params: { busca: nome } } as any);
  };

  return (
    <AppModal visible={visivel} onClose={fechar} title="Conferência dos horários fixos">
      {conferencia && r ? (
        <>
          <Text style={s.quando}>
            Conferido às {hora(conferencia.rodadaEm)} · aulas de {diaMes(r.de)} a {diaMes(r.ate)}
          </Text>

          {aviso ? (
            <View style={s.aviso}>
              <Icon name="information-circle-outline" size={15} color={LC.primary} />
              <Text style={s.avisoTexto}>{aviso}</Text>
            </View>
          ) : null}

          {r.pendencias === 0 ? (
            <View style={s.tudoCerto}>
              <Icon name="checkmark-circle" size={18} color={LC.successFg} />
              <Text style={s.tudoCertoTexto}>
                Tudo certo: todo mundo está no seu horário fixo e nenhuma turma passou do limite.
              </Text>
            </View>
          ) : null}

          <ScrollView style={s.lista} showsVerticalScrollIndicator={false}>
            {r.pontos.map((p) => (
              <View key={p.tipo} style={[s.ponto, p.nivel === 'aviso' && s.pontoAviso]}>
                <View style={s.pontoTopo}>
                  <Icon
                    name={p.nivel === 'revisar' ? 'alert-circle' : 'information-circle'}
                    size={16}
                    color={p.nivel === 'revisar' ? LC.danger : LC.warningFg}
                  />
                  <Text style={[s.pontoTitulo, p.nivel === 'aviso' && { color: LC.warningFg }]}>{p.titulo}</Text>
                </View>
                {p.itens.map((it, i) =>
                  it.nome ? (
                    <Pressable
                      key={`${p.tipo}-${i}`}
                      style={({ pressed }) => [s.item, pressed && { opacity: 0.7 }]}
                      onPress={() => abrirAluno(it.nome!)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${it.nome}`}
                    >
                      <Text style={s.itemTexto}>{it.texto}</Text>
                      <Icon name="chevron-forward" size={14} color={LC.textMuted} />
                    </Pressable>
                  ) : (
                    <View key={`${p.tipo}-${i}`} style={s.item}>
                      <Text style={s.itemTexto}>{it.texto}</Text>
                    </View>
                  ),
                )}
                <Text style={s.oQueFazer}>
                  <Text style={{ fontWeight: '800' }}>O que fazer: </Text>
                  {p.oQueFazer}
                </Text>
              </View>
            ))}
          </ScrollView>

          {conferencia.revisadaEm ? (
            <Text style={s.revisada}>
              Revisada às {hora(conferencia.revisadaEm)}
              {conferencia.revisadaPor ? ` por ${conferencia.revisadaPor}` : ''}.
            </Text>
          ) : null}

          <View style={s.botoes}>
            <Button
              title="Conferir de novo agora"
              variant="outline"
              size="sm"
              loading={rodar.isPending}
              onPress={() =>
                rodar.mutate(undefined, {
                  onSuccess: (c) =>
                    setAviso(
                      c.pendencias === 0
                        ? 'Conferido agora: tudo certo.'
                        : `Conferido agora: ${c.pendencias} ${c.pendencias === 1 ? 'ponto' : 'pontos'} para revisar.`,
                    ),
                  onError: (e) => setAviso(e instanceof ApiError ? e.message : 'Não foi possível conferir agora.'),
                })
              }
            />
            {r.pendencias > 0 && !conferencia.revisadaEm ? (
              <Button
                title="Marcar como revisado"
                size="sm"
                loading={revisar.isPending}
                onPress={() =>
                  revisar.mutate(conferencia.id, {
                    onSuccess: () => setAviso('Marcado como revisado. O alerta volta só se a conferência de amanhã achar algo.'),
                    onError: (e) => setAviso(e instanceof ApiError ? e.message : 'Não foi possível marcar agora.'),
                  })
                }
                style={{ marginTop: 8 }}
              />
            ) : null}
          </View>
        </>
      ) : (
        <Text style={s.quando}>A conferência do dia roda às 08:00.</Text>
      )}
    </AppModal>
  );
}

const s = StyleSheet.create({
  quando: { fontSize: 12.5, color: LC.textSecondary, marginBottom: 10 },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10,
    backgroundColor: LC.primaryLight, marginBottom: 10,
  },
  avisoTexto: { flex: 1, fontSize: 12.5, color: LC.textPrimary, fontWeight: '600' },
  tudoCerto: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10,
    backgroundColor: LC.successBg, marginBottom: 10,
  },
  tudoCertoTexto: { flex: 1, fontSize: 13, color: LC.successFg, fontWeight: '700', lineHeight: 18 },
  lista: { maxHeight: 380 },
  ponto: {
    borderRadius: 12, padding: 12, marginBottom: 10,
    backgroundColor: LC.dangerBg,
  },
  pontoAviso: { backgroundColor: LC.warningBg },
  pontoTopo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pontoTitulo: { flex: 1, fontSize: 13.5, fontWeight: '800', color: LC.danger },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  itemTexto: { flex: 1, fontSize: 12.5, color: LC.textPrimary, lineHeight: 17 },
  oQueFazer: { fontSize: 12, color: LC.textSecondary, lineHeight: 17, marginTop: 6 },
  revisada: { fontSize: 12, color: LC.textMuted, marginTop: 4 },
  botoes: { marginTop: 10 },
});
