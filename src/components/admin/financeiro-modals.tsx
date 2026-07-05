import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Icon } from '../ui/icon';
import { formatarReal, parseValor } from '../../services/money';
import { formatDate } from '../../services/date';
import { usePlanos } from '../../services/planos/planos.queries';
import {
  useRegistrarPagamento,
  useConfigurarFinanceiroAluno,
  useDefinirPrecoPlano,
} from '../../services/financeiro/financeiro.mutations';
import type { AlunoFinanceiro, FormaPagamento } from '../../services/financeiro/financeiro.types';
import { ApiError } from '../../services/http';

const FORMAS: { key: FormaPagamento; label: string }[] = [
  { key: 'PIX', label: 'PIX' },
  { key: 'DINHEIRO', label: 'Dinheiro' },
  { key: 'CARTAO', label: 'Cartão' },
  { key: 'OUTRO', label: 'Outro' },
];

function mesRef(offset: number): { key: string; label: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = formatDate(d, 'MMM/YYYY');
  return { key, label };
}

/** Registrar recebimento de mensalidade (admin marca como pago). */
export function RegistrarPagamentoModal({ aluno, onClose }: { aluno: AlunoFinanceiro | null; onClose: () => void }) {
  const registrar = useRegistrarPagamento();
  const [valorTexto, setValorTexto] = useState('');
  const [forma, setForma] = useState<FormaPagamento>('PIX');
  const [refSel, setRefSel] = useState(0); // offset de mês: -1, 0, +1
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aluno) {
      setValorTexto(aluno.valor != null ? aluno.valor.toFixed(2).replace('.', ',') : '');
      setForma('PIX');
      setRefSel(0);
      setErro(null);
    }
  }, [aluno]);

  const salvar = () => {
    if (!aluno) return;
    const valor = parseValor(valorTexto);
    if (valor === null || valor <= 0) {
      setErro('Informe um valor válido (ex: 250,00)');
      return;
    }
    registrar.mutate(
      { usuarioId: aluno.usuarioId, valor, referencia: mesRef(refSel).key, formaPagamento: forma },
      {
        onSuccess: onClose,
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar.'),
      },
    );
  };

  const meses = [-1, 0, 1].map((off) => ({ off, ...mesRef(off) }));

  return (
    <AppModal visible={!!aluno} onClose={onClose} title={aluno ? `Registrar pagamento — ${aluno.nome.split(' ')[0]}` : ''}>
      <Text style={s.label}>Mês de referência</Text>
      <View style={s.chips}>
        {meses.map((m) => (
          <Pressable key={m.key} style={[s.chip, refSel === m.off && s.chipSel]} onPress={() => setRefSel(m.off)}>
            <Text style={[s.chipText, refSel === m.off && s.chipTextSel]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Valor recebido</Text>
      <Input
        value={valorTexto}
        onChangeText={setValorTexto}
        keyboardType="decimal-pad"
        placeholder="250,00"
        leftIcon={<Icon name="cash-outline" size={18} color={LC.textMuted} />}
      />

      <Text style={s.label}>Forma de pagamento</Text>
      <View style={s.chips}>
        {FORMAS.map((f) => (
          <Pressable key={f.key} style={[s.chip, forma === f.key && s.chipSel]} onPress={() => setForma(f.key)}>
            <Text style={[s.chipText, forma === f.key && s.chipTextSel]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {erro ? <Text style={s.erro}>{erro}</Text> : null}

      <View style={s.actions}>
        <Button title="Cancelar" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Confirmar" loading={registrar.isPending} onPress={salvar} style={{ flex: 1 }} />
      </View>
      <Text style={s.hint}>O pagamento foi feito direto ao estúdio — aqui é só o registro.</Text>
    </AppModal>
  );
}

/** Configurar valor personalizado e dia de vencimento do aluno. */
export function ConfigFinanceiroModal({ aluno, onClose }: { aluno: AlunoFinanceiro | null; onClose: () => void }) {
  const configurar = useConfigurarFinanceiroAluno();
  const [valorTexto, setValorTexto] = useState('');
  const [diaTexto, setDiaTexto] = useState('5');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aluno) {
      setValorTexto(aluno.valorPersonalizado && aluno.valor != null ? aluno.valor.toFixed(2).replace('.', ',') : '');
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
    const valor = valorTexto.trim() ? parseValor(valorTexto) : null;
    if (valorTexto.trim() && valor === null) {
      setErro('Valor inválido (deixe vazio para usar o preço do plano)');
      return;
    }
    configurar.mutate(
      { usuarioId: aluno.usuarioId, payload: { valorMensalidade: valor, diaVencimento: dia } },
      {
        onSuccess: onClose,
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    );
  };

  return (
    <AppModal visible={!!aluno} onClose={onClose} title={aluno ? `Mensalidade — ${aluno.nome.split(' ')[0]}` : ''}>
      <Text style={s.label}>Valor personalizado (vazio = preço do plano)</Text>
      <Input
        value={valorTexto}
        onChangeText={setValorTexto}
        keyboardType="decimal-pad"
        placeholder={aluno?.plano ? 'Usar preço do plano' : '250,00'}
        leftIcon={<Icon name="cash-outline" size={18} color={LC.textMuted} />}
      />

      <Text style={s.label}>Dia do vencimento (1 a 28)</Text>
      <Input value={diaTexto} onChangeText={setDiaTexto} keyboardType="number-pad" placeholder="5" maxLength={2} />

      {erro ? <Text style={s.erro}>{erro}</Text> : null}

      <View style={s.actions}>
        <Button title="Cancelar" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Salvar" loading={configurar.isPending} onPress={salvar} style={{ flex: 1 }} />
      </View>
    </AppModal>
  );
}

/** Preços padrão por plano (tabela de preços do estúdio). */
export function PrecosPlanosModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const planos = usePlanos();
  const definir = useDefinirPrecoPlano();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (visible && planos.data) {
      const iniciais: Record<string, string> = {};
      planos.data.forEach((p: any) => {
        iniciais[p.id] = p.precoPadrao != null ? Number(p.precoPadrao).toFixed(2).replace('.', ',') : '';
      });
      setValores(iniciais);
      setErro(null);
    }
  }, [visible, planos.data]);

  const salvar = async () => {
    if (!planos.data) return;
    setErro(null);
    for (const p of planos.data) {
      const texto = (valores[p.id] ?? '').trim();
      const valor = texto ? parseValor(texto) : null;
      if (texto && valor === null) {
        setErro(`Valor inválido em ${p.nome}`);
        return;
      }
      const atual = (p as any).precoPadrao != null ? Number((p as any).precoPadrao) : null;
      if (valor !== atual) {
        await definir.mutateAsync({ planoId: p.id, precoPadrao: valor });
      }
    }
    onClose();
  };

  return (
    <AppModal visible={visible} onClose={onClose} title="Preços dos planos">
      {planos.data?.map((p) => (
        <View key={p.id} style={s.precoRow}>
          <Text style={s.precoNome}>{p.nome}</Text>
          <View style={{ width: 130 }}>
            <Input
              value={valores[p.id] ?? ''}
              onChangeText={(t) => setValores((v) => ({ ...v, [p.id]: t }))}
              keyboardType="decimal-pad"
              placeholder="0,00"
            />
          </View>
        </View>
      ))}
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      <View style={s.actions}>
        <Button title="Fechar" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Salvar" loading={definir.isPending} onPress={salvar} style={{ flex: 1 }} />
      </View>
      <Text style={s.hint}>Alunos sem valor personalizado usam o preço do plano.</Text>
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
  precoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  precoNome: { flex: 1, fontSize: 14, fontWeight: '600', color: LC.textPrimary },
});
