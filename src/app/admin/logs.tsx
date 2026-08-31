import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { EmptyState, ErrorState } from '../../components/ui/states';
import { EsqueletoLista } from '../../components/ui/esqueleto';
import { Toque } from '../../components/ui/motion';
import { useLogs, useAutoresDeLog } from '../../services/logs/logs.queries';
import { useMe } from '../../services/auth/auth.queries';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { formatDate } from '../../services/date';
import type { LogAcao } from '../../services/logs/logs.types';

/**
 * O que foi feito no sistema — só para o dono.
 *
 * A pergunta que esta tela responde é sempre a mesma: "quem mexeu nisso, e
 * quando". Por isso a linha começa pela HORA e pelo NOME, e o que foi feito
 * vem escrito por extenso; a rota da API fica escondida atrás do toque, para
 * quem quiser o detalhe técnico.
 *
 * O guard de verdade está na API — isto aqui é só a tela. Se alguém abrir a
 * rota sem ser dono, a lista volta vazia com o aviso de área restrita.
 */

const PERIODOS = [
  { chave: 'hoje', label: 'Hoje', dias: 0 },
  { chave: '7', label: '7 dias', dias: 7 },
  { chave: '30', label: '30 dias', dias: 30 },
  { chave: 'tudo', label: 'Tudo', dias: null as number | null },
] as const;

function desdeDe(dias: number | null): string | undefined {
  if (dias === null) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return formatDate(d, 'YYYY-MM-DD');
}

/** Vermelho quando a ação foi recusada — é o que salta aos olhos numa lista longa. */
function corDoStatus(status: number): string {
  if (status >= 500) return LC.danger;
  if (status >= 400) return LC.warningFg;
  return LC.textMuted;
}

function LinhaDoLog({ log }: { log: LogAcao }) {
  const [aberto, setAberto] = useState(false);
  const recusada = log.status >= 400;

  /** O detalhe vem como JSON; mostrar `chave: valor` lê melhor que a chave crua. */
  const detalhe = useMemo(() => {
    if (!log.detalhe) return null;
    try {
      const obj = JSON.parse(log.detalhe) as Record<string, unknown>;
      return Object.entries(obj).map(([k, v]) => `${k}: ${String(v)}`);
    } catch {
      return [log.detalhe];
    }
  }, [log.detalhe]);

  return (
    <Toque style={s.linha} onPress={() => setAberto((a) => !a)} escala={0.985}>
        <View style={s.linhaTopo}>
          <Text style={s.hora}>{formatDate(log.criadoEm, 'DD/MM HH:mm')}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.resumo}>{log.resumo}</Text>
            <Text style={s.quem}>
              {log.usuarioNome}
              <Text style={s.tipo}> · {log.usuarioTipo.toLowerCase()}</Text>
            </Text>
          </View>
          {recusada && (
            <View style={s.selo}>
              <Text style={[s.seloTexto, { color: corDoStatus(log.status) }]}>recusada</Text>
            </View>
          )}
          <Icon name={aberto ? 'chevron-up' : 'chevron-down'} size={15} color={LC.textMuted} />
        </View>

        {aberto && (
          <View style={s.detalhe}>
            <Text style={s.detalheLinha}>
              <Text style={s.detalheChave}>rota</Text>  {log.metodo} {log.rota}
            </Text>
            <Text style={s.detalheLinha}>
              <Text style={s.detalheChave}>resposta</Text>  {log.status}
            </Text>
            {log.ip && (
              <Text style={s.detalheLinha}>
                <Text style={s.detalheChave}>de</Text>  {log.ip}
              </Text>
            )}
            {detalhe?.map((d, i) => (
              <Text key={i} style={s.detalheLinha}>
                {d}
              </Text>
            ))}
          </View>
      )}
    </Toque>
  );
}

export default function AdminLogs() {
  const isDesktop = useIsDesktop();
  const me = useMe();
  const ehDono = me.data?.dono === true;

  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['chave']>('7');
  const [autor, setAutor] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  const dias = PERIODOS.find((p) => p.chave === periodo)?.dias ?? null;
  const filtros = useMemo(
    () => ({
      desde: desdeDe(dias),
      usuarioId: autor ?? undefined,
      busca: busca.trim() || undefined,
      pagina,
    }),
    [dias, autor, busca, pagina],
  );

  const logs = useLogs(filtros, ehDono);
  const autores = useAutoresDeLog(ehDono);

  /** Trocar filtro sem voltar para a página 1 mostraria uma lista vazia. */
  const trocar = (fn: () => void) => {
    setPagina(1);
    fn();
  };

  if (me.isLoading) {
    return (
      <View style={s.root}>
        <View style={s.corpo}><EsqueletoLista quantos={5} /></View>
        <TabBar isAdmin />
      </View>
    );
  }

  if (!ehDono) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" />
        <View style={s.corpo}>
          <EmptyState
            icon="lock-closed-outline"
            title="Área restrita"
            description="Esta parte do sistema é do dono."
          />
        </View>
        <TabBar isAdmin />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      <View style={[s.cabecalho, isDesktop && s.cabecalhoDesk]}>
        <Text style={s.titulo}>O que foi feito</Text>
        <Text style={s.subtitulo}>
          {logs.data ? `${logs.data.total} ação(ões) no período` : 'Registro do sistema'}
        </Text>
      </View>

      <View style={s.filtros}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {PERIODOS.map((p) => {
            const sel = periodo === p.chave;
            return (
              <Toque
                key={p.chave}
                escala={0.94}
                style={[s.chip, sel && s.chipSel]}
                onPress={() => trocar(() => setPeriodo(p.chave))}
              >
                <Text style={[s.chipTexto, sel && s.chipTextoSel]}>{p.label}</Text>
              </Toque>
            );
          })}
        </ScrollView>

        {(autores.data?.length ?? 0) > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <Toque escala={0.94} style={[s.chip, !autor && s.chipSel]} onPress={() => trocar(() => setAutor(null))}>
              <Text style={[s.chipTexto, !autor && s.chipTextoSel]}>Todos</Text>
            </Toque>
            {autores.data
              ?.filter((a) => !!a.usuarioId)
              .map((a) => {
                const sel = autor === a.usuarioId;
                return (
                  <Toque
                    key={a.usuarioId}
                    escala={0.94}
                    style={[s.chip, sel && s.chipSel]}
                    onPress={() => trocar(() => setAutor(a.usuarioId))}
                  >
                    <Text style={[s.chipTexto, sel && s.chipTextoSel]}>
                      {a.nome} <Text style={s.chipContagem}>{a.acoes}</Text>
                    </Text>
                  </Toque>
                );
              })}
          </ScrollView>
        )}

        <View style={s.buscaBox}>
          <Input
            placeholder="Buscar ação, pessoa ou rota"
            value={busca}
            onChangeText={(t) => trocar(() => setBusca(t))}
          />
        </View>
      </View>

      <ScrollView style={s.corpo} contentContainerStyle={s.corpoConteudo} showsVerticalScrollIndicator={false}>
        {logs.isLoading ? (
          <EsqueletoLista quantos={6} />
        ) : logs.isError ? (
          <ErrorState onRetry={() => logs.refetch()} />
        ) : !logs.data || logs.data.itens.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="Nada por aqui"
            description="Nenhuma ação no período escolhido."
          />
        ) : (
          <>
            {logs.data.itens.map((l) => (
              <LinhaDoLog key={l.id} log={l} />
            ))}

            {logs.data.paginas > 1 && (
              <View style={s.paginacao}>
                <Pressable
                  style={[s.pagBtn, pagina <= 1 && s.pagBtnOff]}
                  disabled={pagina <= 1}
                  onPress={() => setPagina((p) => p - 1)}
                  accessibilityLabel="Página anterior"
                >
                  <Icon name="chevron-back" size={16} color={pagina <= 1 ? LC.textMuted : LC.primary} />
                </Pressable>
                <Text style={s.pagTexto}>
                  {pagina} de {logs.data.paginas}
                </Text>
                <Pressable
                  style={[s.pagBtn, pagina >= logs.data.paginas && s.pagBtnOff]}
                  disabled={pagina >= logs.data.paginas}
                  onPress={() => setPagina((p) => p + 1)}
                  accessibilityLabel="Próxima página"
                >
                  <Icon
                    name="chevron-forward"
                    size={16}
                    color={pagina >= logs.data.paginas ? LC.textMuted : LC.primary}
                  />
                </Pressable>
              </View>
            )}

          </>
        )}

        {/*
          Sem este aviso a pessoa concluiria que "sumiu do log". O registro
          guarda seis meses; dizer isso na tela evita a leitura errada de que
          alguém apagou alguma coisa.

          Fora do fragmento da lista de propósito: ali dentro ele se sobrepunha
          ao primeiro card e chegava a roubar o toque dele.
        */}
        {!logs.isLoading && !logs.isError && (
          <Text style={s.rodape}>O registro guarda os últimos 180 dias.</Text>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {!isDesktop && <TabBar isAdmin />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  cabecalho: { ...LC.coluna, paddingHorizontal: 18, paddingTop: 56, paddingBottom: 10 },
  cabecalhoDesk: { paddingTop: 24 },
  titulo: { fontSize: 24, fontWeight: '800', color: LC.textPrimary, letterSpacing: -0.5 },
  subtitulo: { fontSize: 13, color: LC.textSecondary, marginTop: 3 },

  filtros: { ...LC.coluna, gap: 6, paddingBottom: 6 },
  chips: { paddingHorizontal: 18, gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border,
  },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipTexto: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary },
  chipTextoSel: { color: LC.primary },
  chipContagem: { color: LC.textMuted, fontWeight: '600' },
  buscaBox: { paddingHorizontal: 18, paddingTop: 4 },

  corpo: { flex: 1 },
  corpoConteudo: { ...LC.coluna, paddingHorizontal: 18, paddingTop: 6 },

  linha: {
    backgroundColor: LC.bgCard, borderRadius: LC.radius.lg,
    borderWidth: 1, borderColor: LC.border,
    padding: 13, marginBottom: 8, ...LC.shadow,
  },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  /** Largura fixa para as horas alinharem numa coluna — a lista fica varrível. */
  hora: {
    fontSize: 11.5, fontWeight: '700', color: LC.textMuted,
    minWidth: 76, fontVariant: ['tabular-nums'],
  },
  resumo: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  quem: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  tipo: { color: LC.textMuted },
  selo: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: LC.radius.full, backgroundColor: LC.warningBg,
  },
  seloTexto: { fontSize: 10, fontWeight: '800' },

  detalhe: {
    marginTop: 11, paddingTop: 10, gap: 3,
    borderTopWidth: 1, borderTopColor: LC.border,
  },
  detalheLinha: { fontSize: 11.5, color: LC.textSecondary, lineHeight: 17 },
  detalheChave: { fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', fontSize: 10 },

  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 14 },
  pagBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  pagBtnOff: { opacity: 0.45 },
  pagTexto: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },

  rodape: { fontSize: 11.5, color: LC.textMuted, textAlign: 'center', paddingVertical: 8 },
});
