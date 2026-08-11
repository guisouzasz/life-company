import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';
import { Header } from '../components/ui/header';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { InfoModal } from '../components/ui/modal';
import { Loading, ErrorState } from '../components/ui/states';
import { useMinhaAnamnese, useSalvarAnamnese } from '../services/anamnese/anamnese.queries';
import { NIVEIS, OBJETIVOS } from '../services/anamnese/anamnese.types';
import { ApiError } from '../services/http';

/** Pergunta de sim/não com dois botões. */
function SimNao({ label, valor, onChange }: { label: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.simNaoRow}>
      <Text style={s.simNaoLabel}>{label}</Text>
      <View style={s.simNaoBtns}>
        {[
          { t: 'Não', v: false },
          { t: 'Sim', v: true },
        ].map(({ t, v }) => (
          <Pressable key={t} style={[s.simNaoBtn, valor === v && s.simNaoBtnSel]} onPress={() => onChange(v)}>
            <Text style={[s.simNaoTexto, valor === v && s.simNaoTextoSel]}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Ficha de anamnese preenchida pelo próprio aluno.
 * O professor lê essa ficha antes de montar o treino.
 */
export default function AnamneseAluno() {
  const ficha = useMinhaAnamnese();
  const salvar = useSalvarAnamnese();

  const [objetivo, setObjetivo] = useState('');
  const [nivel, setNivel] = useState('');
  const [problemasSaude, setProblemasSaude] = useState('');
  const [lesoes, setLesoes] = useState('');
  const [dores, setDores] = useState('');
  const [medicamentos, setMedicamentos] = useState('');
  const [alergias, setAlergias] = useState('');
  const [gestante, setGestante] = useState(false);
  const [fumante, setFumante] = useState(false);
  const [liberacaoMedica, setLiberacaoMedica] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const hidratado = useRef(false);

  // Preenche o formulário UMA vez, quando a ficha existente chega. Sem o
  // guard, cada refetch do React Query (foco da janela, reconexão) sobrescreve
  // o que a pessoa está digitando.
  useEffect(() => {
    if (hidratado.current || ficha.data === undefined) return;
    hidratado.current = true;
    const f = ficha.data;
    if (!f) return;
    setObjetivo(f.objetivo ?? '');
    setNivel(f.nivelAtividade ?? '');
    setProblemasSaude(f.problemasSaude ?? '');
    setLesoes(f.lesoes ?? '');
    setDores(f.dores ?? '');
    setMedicamentos(f.medicamentos ?? '');
    setAlergias(f.alergias ?? '');
    setGestante(f.gestante);
    setFumante(f.fumante);
    setLiberacaoMedica(f.liberacaoMedica);
    setObservacoes(f.observacoes ?? '');
  }, [ficha.data]);

  const enviar = () => {
    if (!objetivo) {
      setAviso('Escolha o seu objetivo para começar.');
      return;
    }
    salvar.mutate(
      {
        objetivo,
        nivelAtividade: nivel || undefined,
        problemasSaude: problemasSaude.trim() || undefined,
        lesoes: lesoes.trim() || undefined,
        dores: dores.trim() || undefined,
        medicamentos: medicamentos.trim() || undefined,
        alergias: alergias.trim() || undefined,
        gestante,
        fumante,
        liberacaoMedica,
        observacoes: observacoes.trim() || undefined,
      },
      {
        onSuccess: () => setAviso('__ok__'),
        onError: (e) => setAviso(e instanceof ApiError ? e.message : 'Não foi possível salvar. Tente de novo.'),
      },
    );
  };

  if (ficha.isLoading) {
    return (
      <View style={s.root}>
        <Header title="Ficha de saúde" showBack />
        <Loading />
      </View>
    );
  }
  if (ficha.isError) {
    return (
      <View style={s.root}>
        <Header title="Ficha de saúde" showBack />
        <ErrorState onRetry={() => ficha.refetch()} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <Header title="Ficha de saúde" subtitle={ficha.data ? 'Mantenha seus dados atualizados' : 'Leva 2 minutos'} showBack />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card style={s.intro} padding={14}>
            <Icon name="information-circle-outline" size={18} color={LC.primary} />
            <Text style={s.introTexto}>
              Essas informações vão só para o seu professor, para montar um treino seguro para você.
            </Text>
          </Card>

          <Text style={s.secao}>Qual é o seu objetivo?</Text>
          <View style={s.chips}>
            {OBJETIVOS.map((o) => (
              <Pressable key={o} style={[s.chip, objetivo === o && s.chipSel]} onPress={() => setObjetivo(o)}>
                <Text style={[s.chipTexto, objetivo === o && s.chipTextoSel]}>{o}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.secao}>Como está sua rotina de treino hoje?</Text>
          <View style={s.chips}>
            {NIVEIS.map((n) => (
              <Pressable key={n} style={[s.chip, nivel === n && s.chipSel]} onPress={() => setNivel(nivel === n ? '' : n)}>
                <Text style={[s.chipTexto, nivel === n && s.chipTextoSel]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.secao}>Saúde</Text>
          <View style={s.campos}>
            <Input
              label="Tem algum problema de saúde?"
              placeholder="Pressão alta, diabetes, asma... (deixe vazio se não tiver)"
              value={problemasSaude}
              onChangeText={setProblemasSaude}
              multiline
            />
            <Input
              label="Já teve lesão ou cirurgia?"
              placeholder="Ex: cirurgia no joelho direito em 2022"
              value={lesoes}
              onChangeText={setLesoes}
              multiline
            />
            <Input
              label="Sente alguma dor?"
              placeholder="Ex: dor lombar no fim do dia"
              value={dores}
              onChangeText={setDores}
              multiline
            />
            <Input
              label="Toma algum medicamento?"
              placeholder="Nome do remédio e para quê"
              value={medicamentos}
              onChangeText={setMedicamentos}
              multiline
            />
            <Input label="Tem alergia a alguma coisa?" placeholder="Deixe vazio se não tiver" value={alergias} onChangeText={setAlergias} />
          </View>

          <View style={s.simNaoBox}>
            <SimNao label="Está gestante?" valor={gestante} onChange={setGestante} />
            <SimNao label="É fumante?" valor={fumante} onChange={setFumante} />
            <SimNao label="Tem liberação médica para treinar?" valor={liberacaoMedica} onChange={setLiberacaoMedica} />
          </View>

          <Text style={s.secao}>Mais alguma coisa?</Text>
          <Input
            placeholder="Algo que o professor precise saber antes de montar seu treino"
            value={observacoes}
            onChangeText={setObservacoes}
            multiline
            style={s.obsInput}
          />

          <View style={{ height: 18 }} />
          <Button title={ficha.data ? 'Salvar alterações' : 'Enviar ficha'} size="lg" loading={salvar.isPending} onPress={enviar} />
          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <InfoModal
        visible={!!aviso}
        title={aviso === '__ok__' ? 'Ficha enviada!' : 'Atenção'}
        message={aviso === '__ok__' ? 'Obrigado! Seu professor já consegue ver essas informações.' : (aviso ?? '')}
        onClose={() => {
          const ok = aviso === '__ok__';
          setAviso(null);
          if (ok) router.back();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  scroll: { ...LC.coluna, padding: 16, paddingBottom: 24 },

  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: LC.primaryLight, borderWidth: 0 },
  introTexto: { flex: 1, fontSize: 13, color: LC.textSecondary, lineHeight: 19 },

  secao: { fontSize: 13, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 22, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: LC.radius.full, backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipTexto: { fontSize: 13.5, fontWeight: '600', color: LC.textSecondary },
  chipTextoSel: { color: LC.primary, fontWeight: '700' },

  campos: { gap: 14 },

  simNaoBox: { marginTop: 20, gap: 12 },
  simNaoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  simNaoLabel: { flex: 1, fontSize: 14.5, color: LC.textPrimary, fontWeight: '600' },
  simNaoBtns: { flexDirection: 'row', gap: 6 },
  simNaoBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: LC.radius.full, backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border },
  simNaoBtnSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  simNaoTexto: { fontSize: 13.5, fontWeight: '700', color: LC.textSecondary },
  simNaoTextoSel: { color: '#fff' },

  obsInput: { minHeight: 90, textAlignVertical: 'top' },
});
