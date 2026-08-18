import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { LC } from '../../constants/theme';
import { exerciciosDoGrupo } from '../../constants/exercicios';
import { AppModal } from '../ui/modal';
import { Input } from '../ui/input';
import { Icon } from '../ui/icon';

/**
 * Escolha do exercício dentro de um grupo muscular: mostra só os exercícios
 * daquele grupo.
 *
 * A busca também serve de saída: quando o professor digita um nome que não
 * está no catálogo, aparece a opção de usar o que ele escreveu. Sem isso, a
 * lista tiraria uma liberdade que ele já tinha — e nenhum catálogo cobre todo
 * aparelho de toda academia.
 */

/** Ignora acento e caixa, para "triceps" achar "Tríceps". */
const normalizar = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

interface Props {
  /** Grupo cujo catálogo será exibido; null mantém o seletor fechado. */
  grupo: string | null;
  /** Nome já escolhido, para destacar na lista. */
  selecionado?: string;
  onSelecionar: (nome: string) => void;
  onFechar: () => void;
}

export function SeletorExercicio({ grupo, selecionado, onSelecionar, onFechar }: Props) {
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const todos = exerciciosDoGrupo(grupo);
    const b = normalizar(busca);
    return b ? todos.filter((e) => normalizar(e).includes(b)) : todos;
  }, [grupo, busca]);

  const digitado = busca.trim();
  // Só oferece o nome livre quando ele não é igual a algo que já está na lista
  const ofereceLivre =
    digitado.length >= 2 && !lista.some((e) => normalizar(e) === normalizar(digitado));

  const escolher = (nome: string) => {
    onSelecionar(nome);
    setBusca('');
    onFechar();
  };

  const fechar = () => {
    setBusca('');
    onFechar();
  };

  return (
    <AppModal visible={!!grupo} onClose={fechar} title={grupo ? `Exercícios de ${grupo}` : ''}>
      <Input
        placeholder="Buscar ou escrever outro nome"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
        leftIcon={<Icon name="search-outline" size={18} color={LC.textMuted} />}
      />

      <ScrollView style={s.lista} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {ofereceLivre ? (
          <Pressable style={({ pressed }) => [s.linha, pressed && s.pressed]} onPress={() => escolher(digitado)}>
            <Icon name="add-circle-outline" size={18} color={LC.primary} />
            <Text style={s.livreTexto} numberOfLines={2}>
              Usar “{digitado}”
            </Text>
          </Pressable>
        ) : null}

        {lista.map((nome) => {
          const ativo = selecionado === nome;
          return (
            <Pressable
              key={nome}
              style={({ pressed }) => [s.linha, pressed && s.pressed]}
              onPress={() => escolher(nome)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
            >
              <Icon
                name={ativo ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={ativo ? LC.primary : LC.textMuted}
              />
              <Text style={[s.nome, ativo && s.nomeAtivo]} numberOfLines={2}>{nome}</Text>
            </Pressable>
          );
        })}

        {lista.length === 0 && !ofereceLivre ? (
          <Text style={s.vazio}>
            Nenhum exercício de {grupo} com esse nome. Escreva o nome completo para usá-lo mesmo assim.
          </Text>
        ) : null}
      </ScrollView>
    </AppModal>
  );
}

const s = StyleSheet.create({
  lista: { maxHeight: 320, marginTop: 12 },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: LC.border,
  },
  pressed: { backgroundColor: LC.neutralBg },
  nome: { flex: 1, fontSize: 14, color: LC.textPrimary },
  nomeAtivo: { fontWeight: '700', color: LC.primary },
  livreTexto: { flex: 1, fontSize: 14, fontWeight: '700', color: LC.primary },
  vazio: { fontSize: 13, color: LC.textMuted, lineHeight: 19, paddingVertical: 14 },
});
