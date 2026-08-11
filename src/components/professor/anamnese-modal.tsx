import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import type { Anamnese } from '../../services/anamnese/anamnese.types';
import { formatDate } from '../../services/date';

interface Props {
  visible: boolean;
  alunoNome: string;
  ficha: Anamnese | null | undefined;
  onClose: () => void;
}

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <View style={s.campo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

/** Leitura da ficha de saúde do aluno (o professor não edita). */
export function AnamneseModal({ visible, alunoNome, ficha, onClose }: Props) {
  const alertas = [
    ficha?.gestante ? 'Gestante' : null,
    ficha?.fumante ? 'Fumante' : null,
    ficha && !ficha.liberacaoMedica ? 'Sem liberação médica' : null,
  ].filter(Boolean) as string[];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.caixa}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Ficha de saúde</Text>
              <Text style={s.sub}>{alunoNome}</Text>
            </View>
            <Pressable hitSlop={8} onPress={onClose}>
              <Icon name="close" size={22} color={LC.textSecondary} />
            </Pressable>
          </View>

          {!ficha ? (
            <View style={s.vazio}>
              <Icon name="clipboard-outline" size={30} color={LC.textMuted} />
              <Text style={s.vazioTexto}>
                {alunoNome.split(' ')[0]} ainda não preencheu a ficha de saúde no app.
              </Text>
            </View>
          ) : (
            <ScrollView style={s.corpo} showsVerticalScrollIndicator={false}>
              {alertas.length > 0 ? (
                <View style={s.alertas}>
                  {alertas.map((a) => (
                    <Badge key={a} label={a} variant="danger" />
                  ))}
                </View>
              ) : null}

              <Campo rotulo="Objetivo" valor={ficha.objetivo} />
              <Campo rotulo="Rotina de treino" valor={ficha.nivelAtividade} />
              <Campo rotulo="Problemas de saúde" valor={ficha.problemasSaude} />
              <Campo rotulo="Lesões e cirurgias" valor={ficha.lesoes} />
              <Campo rotulo="Dores" valor={ficha.dores} />
              <Campo rotulo="Medicamentos" valor={ficha.medicamentos} />
              <Campo rotulo="Alergias" valor={ficha.alergias} />
              <Campo rotulo="Observações do aluno" valor={ficha.observacoes} />

              <Text style={s.rodape}>Preenchida em {formatDate(ficha.updatedAt, 'DD/MM/YYYY')}</Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,28,29,0.55)', justifyContent: 'center', padding: 20 },
  caixa: {
    backgroundColor: LC.bgCard, borderRadius: LC.radius.xl, padding: 20,
    maxHeight: '82%', width: '100%', maxWidth: 480, alignSelf: 'center', ...LC.shadowStrong,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  titulo: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  sub: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  corpo: { flexGrow: 0 },
  alertas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  campo: { marginBottom: 14 },
  rotulo: { fontSize: 11, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  valor: { fontSize: 14.5, color: LC.textPrimary, marginTop: 3, lineHeight: 20 },
  vazio: { alignItems: 'center', gap: 10, paddingVertical: 26 },
  vazioTexto: { fontSize: 14, color: LC.textSecondary, textAlign: 'center', lineHeight: 20 },
  rodape: { fontSize: 12, color: LC.textMuted, marginTop: 4, marginBottom: 4 },
});
