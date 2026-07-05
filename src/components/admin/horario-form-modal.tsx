import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { corPorModalidade, iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Icon } from '../ui/icon';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import { useCriarHorario, useAtualizarHorario } from '../../services/horarios/horarios.mutations';
import type { HorarioAdmin } from '../../services/horarios/horarios.types';
import type { DiaSemana } from '../../services/agendamentos/agendamentos.types';
import { ApiError } from '../../services/http';

const DIAS: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
const DIAS_CURTO: Record<string, string> = { SEGUNDA: 'Seg', TERCA: 'Ter', QUARTA: 'Qua', QUINTA: 'Qui', SEXTA: 'Sex' };
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Props {
  visible: boolean;
  /** Horário em edição (null = criação). */
  horario: HorarioAdmin | null;
  /** Modalidade pré-selecionada na criação. */
  modalidadeIdPadrao?: string;
  onClose: () => void;
}

/**
 * Modal único de criar/editar horário.
 * Criação: seleção múltipla de dias (cria um horário por dia).
 * Edição: dia único (cada horário pertence a um dia).
 */
export function HorarioFormModal({ visible, horario, modalidadeIdPadrao, onClose }: Props) {
  const editando = !!horario;
  const modalidades = useModalidades();
  const criar = useCriarHorario();
  const atualizar = useAtualizarHorario();

  const [modalidadeId, setModalidadeId] = useState<string | undefined>(undefined);
  const [dias, setDias] = useState<DiaSemana[]>([]);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [capacidade, setCapacidade] = useState('4');
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalidadeId(horario?.modalidadeId ?? modalidadeIdPadrao ?? modalidades.data?.[0]?.id);
      setDias(horario ? [horario.diaSemana] : []);
      setHoraInicio(horario?.horaInicio ?? '');
      setHoraFim(horario?.horaFim ?? '');
      setCapacidade(String(horario?.capacidadeMaxima ?? 4));
      setAtivo(horario?.ativo ?? true);
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, horario?.id]);

  const alternarDia = (dia: DiaSemana) => {
    if (editando) {
      setDias([dia]); // edição: dia único
      return;
    }
    setDias((atual) => (atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia]));
  };

  const validar = (): string | null => {
    if (!modalidadeId) return 'Escolha a modalidade';
    if (dias.length === 0) return 'Escolha pelo menos um dia da semana';
    if (!HORA_RE.test(horaInicio)) return 'Horário de início inválido (use HH:MM, ex: 06:00)';
    if (!HORA_RE.test(horaFim)) return 'Horário de término inválido (use HH:MM, ex: 07:00)';
    if (horaFim <= horaInicio) return 'O término deve ser depois do início';
    const cap = parseInt(capacidade, 10);
    if (!Number.isFinite(cap) || cap < 1 || cap > 20) return 'Capacidade deve ser entre 1 e 20';
    return null;
  };

  const salvar = async () => {
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setSalvando(true);
    const cap = parseInt(capacidade, 10);
    try {
      if (editando && horario) {
        await atualizar.mutateAsync({
          id: horario.id,
          payload: { modalidadeId, diaSemana: dias[0], horaInicio, horaFim, capacidadeMaxima: cap, ativo },
        });
      } else {
        for (const dia of dias) {
          await criar.mutateAsync({ modalidadeId: modalidadeId!, diaSemana: dia, horaInicio, horaFim, capacidadeMaxima: cap, ativo });
        }
      }
      onClose();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={onClose} title={editando ? 'Editar horário' : 'Adicionar horário'}>
      {/* Modalidade */}
      <Text style={s.label}>Modalidade</Text>
      <View style={s.chips}>
        {modalidades.data?.map((m) => {
          const sel = modalidadeId === m.id;
          const cor = corPorModalidade(m.nome);
          return (
            <Pressable
              key={m.id}
              style={[s.chip, sel && { backgroundColor: cor + '1A', borderColor: cor }]}
              onPress={() => setModalidadeId(m.id)}
            >
              <Icon name={iconePorModalidade(m.nome)} size={15} color={sel ? cor : LC.textSecondary} />
              <Text style={[s.chipText, sel && { color: cor, fontWeight: '700' }]}>{nomeModalidade(m.nome)}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Dias da semana */}
      <Text style={s.label}>{editando ? 'Dia da semana' : 'Dias da semana (pode marcar vários)'}</Text>
      <View style={s.chips}>
        {DIAS.map((dia) => {
          const sel = dias.includes(dia);
          return (
            <Pressable key={dia} style={[s.chip, sel && s.chipSel]} onPress={() => alternarDia(dia)}>
              {sel ? <Icon name="checkmark" size={13} color={LC.primary} /> : null}
              <Text style={[s.chipText, sel && s.chipTextSel]}>{DIAS_CURTO[dia]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Horários */}
      <View style={s.horaRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Início</Text>
          <Input value={horaInicio} onChangeText={setHoraInicio} placeholder="06:00" keyboardType="numbers-and-punctuation" maxLength={5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Término</Text>
          <Input value={horaFim} onChangeText={setHoraFim} placeholder="07:00" keyboardType="numbers-and-punctuation" maxLength={5} />
        </View>
        <View style={{ width: 110 }}>
          <Text style={s.label}>Capacidade</Text>
          <Input value={capacidade} onChangeText={setCapacidade} placeholder="4" keyboardType="number-pad" maxLength={2} />
        </View>
      </View>

      {/* Status */}
      <Text style={s.label}>Status</Text>
      <View style={s.chips}>
        <Pressable style={[s.chip, ativo && s.chipAtivo]} onPress={() => setAtivo(true)}>
          <View style={[s.dot, { backgroundColor: ativo ? LC.success : LC.textMuted }]} />
          <Text style={[s.chipText, ativo && { color: '#15803D', fontWeight: '700' }]}>Ativo</Text>
        </Pressable>
        <Pressable style={[s.chip, !ativo && s.chipInativo]} onPress={() => setAtivo(false)}>
          <View style={[s.dot, { backgroundColor: !ativo ? LC.danger : LC.textMuted }]} />
          <Text style={[s.chipText, !ativo && { color: '#B91C1C', fontWeight: '700' }]}>Inativo</Text>
        </Pressable>
      </View>

      {erro ? <Text style={s.erro}>{erro}</Text> : null}

      <View style={s.actions}>
        <Button title="Cancelar" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={editando ? 'Salvar' : dias.length > 1 ? `Criar ${dias.length} horários` : 'Salvar'}
          loading={salvando}
          onPress={salvar}
          style={{ flex: 1 }}
        />
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: LC.textSecondary, marginBottom: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border,
  },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextSel: { color: LC.primary, fontWeight: '700' },
  chipAtivo: { backgroundColor: LC.successBg, borderColor: LC.success },
  chipInativo: { backgroundColor: LC.dangerBg, borderColor: LC.danger },
  dot: { width: 8, height: 8, borderRadius: 4 },
  horaRow: { flexDirection: 'row', gap: 10 },
  erro: { fontSize: 12, color: LC.danger, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
