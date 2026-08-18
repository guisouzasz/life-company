import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Icon } from '../ui/icon';
import { formatDate } from '../../services/date';
import { formatarReal, mascaraReal, realParaNumero } from '../../services/mascaras';
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

/**
 * Marcar o mês do aluno como pago.
 *
 * O valor vem preenchido com a mensalidade dele, mas fica editável: aluno
 * paga metade, traz o mês anterior junto, ou combina um desconto — e o que o
 * histórico precisa guardar é o que entrou, não o que era para entrar.
 */
export function RegistrarPagamentoModal({ aluno, onClose }: { aluno: AlunoFinanceiro | null; onClose: () => void }) {
  const registrar = useRegistrarPagamento();
  const [refSel, setRefSel] = useState(0); // offset de mês: -1, 0, +1
  const [valorTexto, setValorTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aluno) {
      setRefSel(0);
      setValorTexto(
        aluno.valorMensalidade === null ? '' : aluno.valorMensalidade.toFixed(2).replace('.', ','),
      );
      setErro(null);
    }
  }, [aluno]);

  const salvar = () => {
    if (!aluno) return;
    const valor = realParaNumero(valorTexto);
    if (valorTexto.trim() && (valor === null || valor < 0)) {
      setErro('Valor inválido.');
      return;
    }
    registrar.mutate(
      { usuarioId: aluno.usuarioId, referencia: mesRef(refSel).key, valor: valor ?? undefined },
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

      <Text style={s.label}>Valor recebido</Text>
      <Input
        value={valorTexto}
        onChangeText={(v) => setValorTexto(mascaraReal(v))}
        keyboardType="number-pad"
        placeholder="0,00"
        leftIcon={<Text style={s.prefixo}>R$</Text>}
      />
      {aluno?.valorMensalidade === null ? (
        <Text style={s.avisoSemValor}>
          Este aluno ainda não tem mensalidade definida. Informe o valor aqui, ou defina no botão de
          vencimento para não precisar digitar todo mês.
        </Text>
      ) : null}

      <View style={s.actions}>
        <Button title="Cancelar" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Confirmar pagamento" loading={registrar.isPending} onPress={salvar} style={{ flex: 1 }} />
      </View>
      <Text style={s.hint}>O pagamento foi feito direto ao estúdio — aqui é só a marcação de pago.</Text>
    </AppModal>
  );
}

/** Mensalidade do aluno: quanto é e quando vence. */
export function ConfigFinanceiroModal({ aluno, onClose }: { aluno: AlunoFinanceiro | null; onClose: () => void }) {
  const configurar = useConfigurarFinanceiroAluno();
  const [diaTexto, setDiaTexto] = useState('5');
  const [valorTexto, setValorTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aluno) {
      setDiaTexto(String(aluno.diaVencimento));
      setValorTexto(
        aluno.valorMensalidade === null ? '' : aluno.valorMensalidade.toFixed(2).replace('.', ','),
      );
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
    const valor = realParaNumero(valorTexto);
    if (valorTexto.trim() && (valor === null || valor < 0)) {
      setErro('Valor da mensalidade inválido.');
      return;
    }
    configurar.mutate(
      // Campo vazio limpa o valor de propósito: é como desfazer um lançamento
      // errado sem mexer no cadastro do aluno.
      { usuarioId: aluno.usuarioId, diaVencimento: dia, valorMensalidade: valor },
      {
        onSuccess: onClose,
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    );
  };

  return (
    <AppModal visible={!!aluno} onClose={onClose} title={aluno ? `Mensalidade — ${aluno.nome.split(' ')[0]}` : ''}>
      <Text style={s.label}>Valor da mensalidade</Text>
      <Input
        value={valorTexto}
        onChangeText={(v) => setValorTexto(mascaraReal(v))}
        keyboardType="number-pad"
        placeholder="0,00"
        leftIcon={<Text style={s.prefixo}>R$</Text>}
      />
      <Text style={s.ajuda}>
        O valor é deste aluno — não vem do plano. Deixe vazio se ainda não houver valor combinado.
      </Text>

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
      <Text style={s.hint}>
        O aluno recebe um lembrete no app quando o vencimento se aproxima, e o valor entra no total
        previsto do mês.
      </Text>
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
  prefixo: { fontSize: 15, fontWeight: '700', color: LC.textSecondary },
  ajuda: { fontSize: 11.5, color: LC.textMuted, marginTop: 6, lineHeight: 16 },
  avisoSemValor: {
    fontSize: 11.5, color: LC.warningFg, marginTop: 8, lineHeight: 16,
    backgroundColor: LC.warningBg, borderRadius: LC.radius.sm, padding: 10,
  },
  hint: { fontSize: 11, color: LC.textMuted, marginTop: 10, textAlign: 'center' },
});
