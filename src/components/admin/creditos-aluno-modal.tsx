import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_VALIDADE_CREDITO } from '../../constants/app';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Badge, type BadgeVariant } from '../ui/badge';
import { Loading } from '../ui/states';
import { useCreditosDoAluno } from '../../services/creditos/creditos.queries';
import { useConcederCredito, useRevogarCredito } from '../../services/creditos/creditos.mutations';
import type { Credito, StatusCredito } from '../../services/creditos/creditos.types';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import { formatDate } from '../../services/date';
import { nomeCurto } from '../../services/nome';
import { ApiError } from '../../services/http';

const STATUS: Record<StatusCredito, { label: string; variant: BadgeVariant }> = {
  VALIDO: { label: 'Disponível', variant: 'success' },
  USADO: { label: 'Usado', variant: 'neutral' },
  EXPIRADO: { label: 'Venceu', variant: 'danger' },
  // Para a dona, tirar o crédito é excluir: ele some da lista e não vale mais.
  REVOGADO: { label: 'Excluído', variant: 'neutral' },
};

/**
 * Por quantos dias o crédito usado ou vencido continua à vista.
 *
 * Pedido da dona: a lista ia acumulando tudo o que o aluno já teve — crédito
 * usado, vencido, os de teste que ela deu e tirou — e o que importa, o que
 * ainda dá para usar, se perdia no meio. Uma semana basta para ela conferir
 * "a Fátima usou o crédito ontem?"; depois disso vai para o histórico.
 */
const DIAS_RECENTES = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Quando o crédito deixou de valer: o dia em que foi usado, ou em que venceu. */
function terminouEm(c: Credito): Date | null {
  if (c.status === 'USADO' && c.usadoEm) return new Date(c.usadoEm);
  if (c.status === 'EXPIRADO') return new Date(c.expiraEm);
  return null;
}

function separar(lista: Credito[], agora = Date.now()) {
  const disponiveis = lista
    .filter((c) => c.status === 'VALIDO')
    .sort((a, b) => a.expiraEm.localeCompare(b.expiraEm));
  const recentes = lista
    .filter((c) => {
      const fim = terminouEm(c);
      return !!fim && agora - fim.getTime() <= DIAS_RECENTES * DIA_MS;
    })
    // O que acabou de acontecer primeiro: "usado ontem" antes de "venceu há 3 dias".
    .sort((a, b) => terminouEm(b)!.getTime() - terminouEm(a)!.getTime());
  const historico = lista.filter((c) => !disponiveis.includes(c) && !recentes.includes(c));
  return { disponiveis, recentes, historico };
}

/** O que dizer embaixo da origem do crédito, conforme a situação dele. */
function detalhe(c: Credito): string {
  const dia = (d: string | Date) => formatDate(new Date(d), 'DD/MM/YYYY');
  if (c.status === 'USADO' && c.usadoEm) return `Usado em ${dia(c.usadoEm)}`;
  if (c.status === 'EXPIRADO') return `Venceu em ${dia(c.expiraEm)}`;
  if (c.status === 'REVOGADO') return `Valia até ${dia(c.expiraEm)}`;
  return `Vale até ${dia(c.expiraEm)}`;
}

export function CreditosAlunoModal({ aluno, onClose }: { aluno: AlunoAdmin | null; onClose: () => void }) {
  const creditos = useCreditosDoAluno(aluno?.id, !!aluno);
  const conceder = useConcederCredito();
  const revogar = useRevogarCredito();
  /** Crédito que a dona tocou para excluir — falta confirmar. */
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const primeiroNome = aluno ? nomeCurto(aluno.nome) : '';
  const { disponiveis, recentes, historico } = separar(creditos.data ?? []);

  const fechar = () => {
    setExcluindo(null);
    setVerHistorico(false);
    setAviso(null);
    onClose();
  };

  const excluir = (id: string) =>
    revogar.mutate(id, {
      onSuccess: () => {
        setExcluindo(null);
        setAviso('Crédito excluído. Ele não aparece mais para o aluno e não pode ser usado.');
      },
      onError: (e) => {
        setExcluindo(null);
        setAviso(e instanceof ApiError ? e.message : 'Não foi possível excluir o crédito.');
      },
    });

  const Linha = ({ c, podeExcluir }: { c: Credito; podeExcluir?: boolean }) => {
    const st = STATUS[c.status];
    if (excluindo === c.id) {
      return (
        <View style={[styles.row, styles.rowConfirmar]}>
          <Text style={styles.confirmarTexto}>
            Excluir este crédito? Ele sai da lista e {primeiroNome} não pode mais usá-lo.
          </Text>
          <View style={styles.confirmarBotoes}>
            <Button title="Voltar" variant="outline" size="sm" fullWidth={false} onPress={() => setExcluindo(null)} />
            <Button title="Excluir" variant="danger" size="sm" fullWidth={false} loading={revogar.isPending} onPress={() => excluir(c.id)} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowMain}>{c.concedidoAdmin ? 'Dado pelo estúdio' : 'Aula cancelada no prazo'}</Text>
          <Text style={styles.rowSub}>{detalhe(c)}</Text>
        </View>
        <Badge label={st.label} variant={st.variant} />
        {podeExcluir ? (
          <Pressable
            style={styles.revoke}
            hitSlop={6}
            onPress={() => {
              setAviso(null);
              setExcluindo(c.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Excluir crédito que vale até ${formatDate(new Date(c.expiraEm), 'DD/MM')}`}
          >
            <Icon name="trash-outline" size={16} color={LC.danger} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <AppModal visible={!!aluno} onClose={fechar} title={aluno ? `Créditos — ${primeiroNome}` : ''}>
      <Button
        title={`Dar crédito de reposição (${DIAS_VALIDADE_CREDITO} dias)`}
        size="md"
        loading={conceder.isPending}
        onPress={() => {
          setAviso(null);
          if (aluno) conceder.mutate({ usuarioId: aluno.id });
        }}
        leftIcon={<Icon name="add-circle-outline" size={18} color="#fff" />}
        style={styles.grant}
      />

      {aviso ? (
        <View style={styles.aviso}>
          <Icon name="checkmark-circle-outline" size={15} color={LC.primary} />
          <Text style={styles.avisoTexto}>{aviso}</Text>
        </View>
      ) : null}

      {creditos.isLoading ? (
        <View style={styles.loading}>
          <Loading />
        </View>
      ) : (
        <ScrollView style={styles.list}>
          <Text style={styles.secao}>
            Disponíveis{disponiveis.length > 0 ? ` (${disponiveis.length})` : ''}
          </Text>
          {disponiveis.length === 0 ? (
            <Text style={styles.empty}>Nenhum crédito disponível agora.</Text>
          ) : (
            disponiveis.map((c) => <Linha key={c.id} c={c} podeExcluir />)
          )}

          {recentes.length > 0 ? (
            <>
              <Text style={styles.secao}>Usados e vencidos nos últimos {DIAS_RECENTES} dias</Text>
              {recentes.map((c) => (
                <Linha key={c.id} c={c} />
              ))}
              <Text style={styles.nota}>Depois de {DIAS_RECENTES} dias eles saem desta lista e ficam só no histórico.</Text>
            </>
          ) : null}

          {/*
            O histórico fica, recolhido: é o que responde "eu tinha um crédito
            e sumiu" quando um aluno pergunta. Fora da frente, não atrapalha.
          */}
          {historico.length > 0 ? (
            <>
              <Pressable
                style={styles.historicoBtn}
                onPress={() => setVerHistorico((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: verHistorico }}
              >
                <Icon name={verHistorico ? 'chevron-up' : 'chevron-down'} size={15} color={LC.textSecondary} />
                <Text style={styles.historicoTexto}>
                  {verHistorico ? 'Esconder histórico' : `Ver histórico (${historico.length})`}
                </Text>
              </Pressable>
              {verHistorico ? historico.map((c) => <Linha key={c.id} c={c} />) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  grant: { marginBottom: 12 },
  loading: { height: 80 },
  list: { maxHeight: 420 },
  secao: {
    fontSize: 11.5, fontWeight: '800', color: LC.textSecondary, letterSpacing: 0.6,
    textTransform: 'uppercase', marginTop: 10, marginBottom: 2,
  },
  empty: { fontSize: 13.5, color: LC.textSecondary, paddingVertical: 10 },
  nota: { fontSize: 11.5, color: LC.textMuted, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: LC.border },
  rowMain: { fontSize: 13, fontWeight: '700', color: LC.textPrimary },
  rowSub: { fontSize: 12, color: LC.textSecondary, marginTop: 1 },
  revoke: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
  rowConfirmar: { flexDirection: 'column', alignItems: 'stretch', backgroundColor: LC.dangerBg, borderRadius: 10, paddingHorizontal: 10 },
  confirmarTexto: { fontSize: 13, lineHeight: 18, color: LC.textPrimary, fontWeight: '600' },
  confirmarBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10,
    backgroundColor: LC.primaryLight, marginBottom: 6,
  },
  avisoTexto: { flex: 1, fontSize: 12.5, color: LC.textPrimary, fontWeight: '600' },
  historicoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, marginTop: 6 },
  historicoTexto: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
});
