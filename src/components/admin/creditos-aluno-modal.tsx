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
import type { StatusCredito } from '../../services/creditos/creditos.types';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import { formatDate } from '../../services/date';
import { nomeCurto } from '../../services/nome';

const STATUS: Record<StatusCredito, { label: string; variant: BadgeVariant }> = {
  VALIDO: { label: 'Disponível', variant: 'success' },
  USADO: { label: 'Usado', variant: 'neutral' },
  EXPIRADO: { label: 'Expirado', variant: 'danger' },
  REVOGADO: { label: 'Revogado', variant: 'neutral' },
};

export function CreditosAlunoModal({ aluno, onClose }: { aluno: AlunoAdmin | null; onClose: () => void }) {
  const creditos = useCreditosDoAluno(aluno?.id, !!aluno);
  const conceder = useConcederCredito();
  const revogar = useRevogarCredito();

  const primeiroNome = aluno ? nomeCurto(aluno.nome) : '';

  return (
    <AppModal visible={!!aluno} onClose={onClose} title={aluno ? `Créditos — ${primeiroNome}` : ''}>
      <Button
        title={`Conceder crédito (${DIAS_VALIDADE_CREDITO} dias)`}
        size="md"
        loading={conceder.isPending}
        onPress={() => aluno && conceder.mutate({ usuarioId: aluno.id })}
        leftIcon={<Icon name="add-circle-outline" size={18} color="#fff" />}
        style={styles.grant}
      />

      {creditos.isLoading ? (
        <View style={styles.loading}>
          <Loading />
        </View>
      ) : !creditos.data || creditos.data.length === 0 ? (
        <Text style={styles.empty}>Nenhum crédito registrado.</Text>
      ) : (
        <ScrollView style={styles.list}>
          {creditos.data.map((c) => {
            const st = STATUS[c.status];
            return (
              <View key={c.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowMain}>
                    {c.concedidoAdmin ? 'Concedido pelo admin' : 'Cancelamento de aula'}
                  </Text>
                  <Text style={styles.rowSub}>Válido até {formatDate(c.expiraEm, 'DD/MM/YYYY')}</Text>
                </View>
                <Badge label={st.label} variant={st.variant} />
                {c.status === 'VALIDO' ? (
                  <Pressable style={styles.revoke} hitSlop={6} onPress={() => revogar.mutate(c.id)}>
                    <Icon name="trash-outline" size={16} color={LC.danger} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  grant: { marginBottom: 14 },
  loading: { height: 80 },
  empty: { fontSize: 14, color: LC.textSecondary, textAlign: 'center', paddingVertical: 16 },
  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: LC.border },
  rowMain: { fontSize: 13, fontWeight: '700', color: LC.textPrimary },
  rowSub: { fontSize: 12, color: LC.textSecondary, marginTop: 1 },
  revoke: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
});
