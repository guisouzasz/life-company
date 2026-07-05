import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Icon } from '../ui/icon';
import { formatDate } from '../../services/date';
import { useRegistrarPagamento, useConfigurarFinanceiroAluno } from '../../services/financeiro/financeiro.mutations';
import type { AlunoFinanceiro } from '../../services/financeiro/financeiro.types';
import { ApiError } from '../../services/http';

function mesRef(offset: number): { key: string; label: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = formatDate(d, 'MMM/YYYY');
  return { key, label };
}

/** Marcar o mês do aluno como pago (sem valores — só o registro). */
export function RegistrarPagamentoModal({ aluno, onClose }: { aluno: AlunoFinanceiro | null; onClose: () => void }) {
  const registrar = useRegistrarPagamento();
  const [refSel, setRefSel] = useState(0); // offset de mês: -1, 0, +1
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aluno) {
      setRefSel(0);
      setErro(null);
    }
  }, [aluno]);

  const salvar = () => {
    if (!aluno) return;
    registrar.mutate(
      { usuarioId: aluno.usuarioId, referencia: mesRef(refSel).key },
      {
        onSuccess: onClose,
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar.'),
      },
    );
  };

  const meses = [-1, 0, 1].map((off) => ({ off, ...mesRef(off) }));

  return (
    <AppModal visible={!!aluno} onClose={onClose} title={aluno ? `Marcar como pago — ${aluno.nome.split(' ')[0]}` : ''}>
      <Text style={s.label}>Mês de referência</Text>
      <View style={s.chips}>
        {meses.map((m) => (
          <Pressable key={m.key} style={[s.chip, refSel === m.off && s.chipSel]} onPress={() => setRefSel(m.off)}>
            <Text style={[s.chipText, refSel === m.off && s.chipTextSel]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {erro ? <Text style={s.erro}>{erro}</Text> : null}

      <View style={s.actions}>
        <Button title="Cancelar" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Confirmar pagamento" loading={registrar.isPending} onPress={salvar} style={{ flex: 1 }} />
      </View>
      <Text style={s.hint}>O pagamento foi feito direto ao estúdio — aqui é só a marcação de pago.</Text>
    </AppModal>
  );
}

/** Configurar o dia de vencimento do aluno. */
export function ConfigFinanceiroModal({ aluno, onClose }: { aluno: AlunoFinanceiro | null; onClose: () => void }) {
  const configurar = useConfigurarFinanceiroAluno();
  const [diaTexto, setDiaTexto] = useState('5');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aluno) {
      setDiaTexto(String(aluno.diaVencimento));
      setErro(null);
    }
  }, [aluno]);

  const salvar = () => {
    if (!aluno) return;
    const dia = parseInt(diaTexto, 10);
    if (!Number.isFinite(dia) || dia < 1 || dia > 28) {
      setErro('Dia de vencimento deve ser entre 1 e 28');
      return;
    }
    configurar.mutate(
      { usuarioId: aluno.usuarioId, diaVencimento: dia },
      {
        onSuccess: onClose,
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    );
  };

  return (
    <AppModal visible={!!aluno} onClose={onClose} title={aluno ? `Vencimento — ${aluno.nome.split(' ')[0]}` : ''}>
      <Text style={s.label}>Dia do vencimento (1 a 28)</Text>
      <Input
        value={diaTexto}
        onChangeText={setDiaTexto}
        keyboardType="number-pad"
        placeholder="5"
        maxLength={2}
        leftIcon={<Icon name="calendar-outline" size={18} color={LC.textMuted} />}
      />

      {erro ? <Text style={s.erro}>{erro}</Text> : null}

      <View style={s.actions}>
        <Button title="Cancelar" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Salvar" loading={configurar.isPending} onPress={salvar} style={{ flex: 1 }} />
      </View>
      <Text style={s.hint}>O aluno recebe um lembrete no app quando o vencimento se aproxima.</Text>
    </AppModal>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: LC.textSecondary, marginBottom: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border,
  },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextSel: { color: LC.primary, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  erro: { fontSize: 12, color: LC.danger, marginTop: 10 },
  hint: { fontSize: 11, color: LC.textMuted, marginTop: 10, textAlign: 'center' },
});
