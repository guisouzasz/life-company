import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Input } from '../ui/input';
import { Icon } from '../ui/icon';
import { Avatar } from '../ui/avatar';
import { Loading } from '../ui/states';
import { useAlunos } from '../../services/usuarios/usuarios.queries';

/**
 * Encaixa um aluno na aula que o professor tem em mãos.
 *
 * Só afeta o que ele vê: a agenda oficial continua sendo da administração.
 * Serve para o caso comum de alguém aparecer fora da lista — reposição
 * combinada na hora, troca de horário — e a ficha precisar estar junto.
 */

interface Props {
  visible: boolean;
  /** IDs já presentes na aula, para não oferecer duas vezes. */
  jaNaAula: string[];
  onEscolher: (aluno: { id: string; nome: string }) => void;
  onClose: () => void;
}

export function AdicionarAlunoModal({ visible, jaNaAula, onEscolher, onClose }: Props) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');

  // Espera a digitação parar: sem isso cada tecla vira uma chamada à API,
  // e o backend tem limite de requisições.
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Só busca com 2+ letras — a lista inteira do estúdio não ajuda em nada aqui.
  const habilitado = visible && termo.length >= 2;
  const alunos = useAlunos(habilitado ? termo : undefined);

  const resultados = habilitado
    ? (alunos.data ?? []).filter((a) => !jaNaAula.includes(a.id)).slice(0, 12)
    : [];

  const fechar = () => {
    setBusca('');
    setTermo('');
    onClose();
  };

  const escolher = (a: { id: string; nome: string }) => {
    onEscolher({ id: a.id, nome: a.nome });
    fechar();
  };

  return (
    <AppModal visible={visible} onClose={fechar} title="Encaixar aluno na aula">
      <Text style={s.explica}>
        O aluno aparece só para você, nesta aula de hoje. A agenda e o plano dele não mudam.
      </Text>

      <Input
        placeholder="Buscar por nome ou CPF"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="words"
        autoCorrect={false}
        leftIcon={<Icon name="search-outline" size={18} color={LC.textMuted} />}
      />

      <ScrollView style={s.lista} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!habilitado ? (
          <Text style={s.dica}>Digite ao menos duas letras do nome.</Text>
        ) : alunos.isLoading ? (
          <View style={{ height: 80 }}>
            <Loading />
          </View>
        ) : resultados.length === 0 ? (
          <Text style={s.dica}>Nenhum aluno encontrado com “{termo}”.</Text>
        ) : (
          resultados.map((a) => (
            <Pressable
              key={a.id}
              style={({ pressed }) => [s.linha, pressed && s.pressed]}
              onPress={() => escolher(a)}
              accessibilityRole="button"
              accessibilityLabel={`Encaixar ${a.nome}`}
            >
              <Avatar nome={a.nome} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={s.nome} numberOfLines={1}>{a.nome}</Text>
                {a.usuarioPlanos?.[0]?.plano ? (
                  <Text style={s.plano} numberOfLines={1}>{a.usuarioPlanos[0].plano?.nome}</Text>
                ) : null}
              </View>
              <Icon name="add-circle-outline" size={20} color={LC.primary} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </AppModal>
  );
}

const s = StyleSheet.create({
  explica: { fontSize: 12.5, color: LC.textSecondary, lineHeight: 18, marginBottom: 12 },
  lista: { maxHeight: 300, marginTop: 10 },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: LC.border,
  },
  pressed: { backgroundColor: LC.neutralBg },
  nome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  plano: { fontSize: 12, color: LC.textMuted, marginTop: 1 },
  dica: { fontSize: 13, color: LC.textMuted, paddingVertical: 16 },
});
