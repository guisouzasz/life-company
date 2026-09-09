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
import { BonecoDor } from '../components/anamnese/boneco-dor';
import { useMinhaAnamnese, useSalvarAnamnese } from '../services/anamnese/anamnese.queries';
import {
  EXPERIENCIAS,
  MAX_OBJETIVOS,
  OBJETIVOS,
  PARQ,
  PARQ_NENHUMA,
  PATOLOGIAS,
  PATOLOGIA_NENHUMA,
  POSTURAS,
  listaDoJson,
} from '../constants/anamnese';
import { mascaraTelefone } from '../services/mascaras';
import { ApiError } from '../services/http';

/**
 * A ficha de anamnese, na ordem e com as palavras do documento do estúdio.
 *
 * Ela é longa de propósito — o estúdio quer saber isso antes do primeiro
 * treino — então cada seção é um cartão e as perguntas condicionais só
 * aparecem quando a resposta é "sim". Perguntar "qual a sua lesão?" para quem
 * acabou de dizer que não tem nenhuma é o jeito mais rápido de fazer alguém
 * desistir no meio.
 */

/** Sim/não, com "não respondeu" possível: `null` deixa os dois botões apagados. */
function SimNao({
  label,
  ajuda,
  valor,
  onChange,
}: {
  label: string;
  ajuda?: string;
  valor: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.simNaoBloco}>
      <Text style={s.pergunta}>{label}</Text>
      {ajuda ? <Text style={s.ajuda}>{ajuda}</Text> : null}
      <View style={s.simNaoBtns}>
        {[
          { t: 'Não', v: false },
          { t: 'Sim', v: true },
        ].map(({ t, v }) => (
          <Pressable
            key={t}
            style={[s.simNaoBtn, valor === v && s.simNaoBtnSel]}
            onPress={() => onChange(v)}
            accessibilityRole="radio"
            accessibilityState={{ selected: valor === v }}
          >
            <Text style={[s.simNaoTexto, valor === v && s.simNaoTextoSel]}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Uma linha de caixa de seleção, para as listas longas. */
function Caixa({
  texto,
  marcada,
  onPress,
}: {
  texto: string;
  marcada: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.caixaLinha, pressed && s.caixaPress]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
    >
      <View style={[s.caixa, marcada && s.caixaMarcada]}>
        {marcada ? <Icon name="checkmark" size={13} color="#fff" /> : null}
      </View>
      <Text style={[s.caixaTexto, marcada && s.caixaTextoMarcado]}>{texto}</Text>
    </Pressable>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={s.secao}>{titulo}</Text>
      <Card style={s.cartao} padding={14}>
        {children}
      </Card>
    </>
  );
}

export default function AnamneseAluno() {
  const ficha = useMinhaAnamnese();
  const salvar = useSalvarAnamnese();

  const [emergNome, setEmergNome] = useState('');
  const [emergTel, setEmergTel] = useState('');
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [experiencia, setExperiencia] = useState('');
  const [profissao, setProfissao] = useState('');
  const [postura, setPostura] = useState('');
  const [posturaOutra, setPosturaOutra] = useState('');
  const [repetitivos, setRepetitivos] = useState<boolean | null>(null);
  const [repetitivosQuais, setRepetitivosQuais] = useState('');
  const [patologias, setPatologias] = useState<string[]>([]);
  const [patologiaOutra, setPatologiaOutra] = useState('');
  const [usaMedicamento, setUsaMedicamento] = useState<boolean | null>(null);
  const [medicamentos, setMedicamentos] = useState('');
  const [fezCirurgia, setFezCirurgia] = useState<boolean | null>(null);
  const [cirurgiaQual, setCirurgiaQual] = useState('');
  const [temLesao, setTemLesao] = useState<boolean | null>(null);
  const [lesoes, setLesoes] = useState('');
  const [temDor, setTemDor] = useState<boolean | null>(null);
  const [dores, setDores] = useState('');
  const [regioesDor, setRegioesDor] = useState<string[]>([]);
  const [parq, setParq] = useState<string[]>([]);
  const [parqNenhuma, setParqNenhuma] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const hidratado = useRef(false);

  /*
    Preenche o formulário UMA vez, quando a ficha existente chega. Sem o
    guard, cada refetch do React Query (foco da janela, reconexão) sobrescreve
    o que a pessoa está digitando.
  */
  useEffect(() => {
    if (hidratado.current || ficha.data === undefined) return;
    hidratado.current = true;
    const f = ficha.data;
    if (!f) return;
    setEmergNome(f.contatoEmergenciaNome ?? '');
    setEmergTel(f.contatoEmergenciaTelefone ?? '');
    setObjetivos(listaDoJson(f.objetivos));
    setExperiencia(f.experiencia ?? '');
    setProfissao(f.profissao ?? '');
    // Postura fora da lista = a pessoa escreveu em "Outro".
    const p = f.posturaPredominante ?? '';
    if (p && !POSTURAS.includes(p as (typeof POSTURAS)[number])) {
      setPostura('Outro');
      setPosturaOutra(p);
    } else {
      setPostura(p);
    }
    setRepetitivos(f.movimentosRepetitivos ?? null);
    setRepetitivosQuais(f.movimentosRepetitivosQuais ?? '');
    setPatologias(listaDoJson(f.patologias));
    setPatologiaOutra(f.patologiaOutra ?? '');
    setUsaMedicamento(f.usaMedicamento ?? null);
    setMedicamentos(f.medicamentos ?? '');
    setFezCirurgia(f.fezCirurgia ?? null);
    setCirurgiaQual(f.cirurgiaQual ?? '');
    setTemLesao(f.temLesao ?? null);
    setLesoes(f.lesoes ?? '');
    setTemDor(f.temDor ?? null);
    setDores(f.dores ?? '');
    setRegioesDor(listaDoJson(f.regioesDor));
    const marcadosParq = listaDoJson(f.parq);
    setParq(marcadosParq);
    // Ficha já salva e sem nenhum item de risco = respondeu "nenhuma".
    setParqNenhuma(marcadosParq.length === 0 && f.parq !== undefined);
    setObservacoes(f.observacoes ?? '');
  }, [ficha.data]);

  const alternarObjetivo = (o: string) =>
    setObjetivos((atual) => {
      if (atual.includes(o)) return atual.filter((x) => x !== o);
      // Passando de 2, o mais antigo sai — em vez de travar num aviso.
      return atual.length >= MAX_OBJETIVOS ? [...atual.slice(1), o] : [...atual, o];
    });

  /** "Nenhuma" é exclusiva: marcar limpa o resto, e vice-versa. */
  const alternarPatologia = (p: string) =>
    setPatologias((atual) => {
      if (p === PATOLOGIA_NENHUMA) return atual.includes(p) ? [] : [PATOLOGIA_NENHUMA];
      const sem = atual.filter((x) => x !== PATOLOGIA_NENHUMA);
      return sem.includes(p) ? sem.filter((x) => x !== p) : [...sem, p];
    });

  const alternarParq = (item: string) => {
    setParqNenhuma(false);
    setParq((atual) => (atual.includes(item) ? atual.filter((x) => x !== item) : [...atual, item]));
  };

  const enviar = () => {
    /*
      A única resposta obrigatória. O documento diz "indispensável", e a razão
      é prática: é o telefone que alguém vai discar se o aluno passar mal na
      sala. Todo o resto pode ficar em branco e ser completado depois.
    */
    if (!emergNome.trim() || emergTel.replace(/\D/g, '').length < 10) {
      setAviso('Preencha o contato de emergência (nome e telefone). É o único campo obrigatório.');
      return;
    }
    salvar.mutate(
      {
        contatoEmergenciaNome: emergNome.trim(),
        contatoEmergenciaTelefone: emergTel.trim(),
        objetivos,
        experiencia: experiencia || undefined,
        profissao: profissao.trim() || undefined,
        posturaPredominante:
          postura === 'Outro' ? posturaOutra.trim() || undefined : postura || undefined,
        movimentosRepetitivos: repetitivos ?? undefined,
        movimentosRepetitivosQuais: repetitivosQuais.trim() || undefined,
        patologias,
        patologiaOutra: patologiaOutra.trim() || undefined,
        usaMedicamento: usaMedicamento ?? undefined,
        medicamentos: medicamentos.trim() || undefined,
        fezCirurgia: fezCirurgia ?? undefined,
        cirurgiaQual: cirurgiaQual.trim() || undefined,
        temLesao: temLesao ?? undefined,
        lesoes: lesoes.trim() || undefined,
        temDor: temDor ?? undefined,
        dores: dores.trim() || undefined,
        regioesDor,
        parq,
        observacoes: observacoes.trim() || undefined,
      },
      {
        onSuccess: () => setAviso('__ok__'),
        onError: (e) =>
          setAviso(e instanceof ApiError ? e.message : 'Não foi possível salvar. Tente de novo.'),
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
      <Header
        title="Ficha de anamnese"
        subtitle={ficha.data ? 'Mantenha seus dados atualizados' : 'Leva alguns minutos'}
        showBack
      />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={s.intro} padding={14}>
            <Icon name="information-circle-outline" size={18} color={LC.primary} />
            <Text style={s.introTexto}>
              Esse processo é fundamental para que os professores conheçam você e seus hábitos de
              vida e, assim, consigam atender aos seus objetivos de forma mais assertiva.
            </Text>
          </Card>

          <Secao titulo="Identificação">
            <Text style={s.pergunta}>Contato de emergência</Text>
            <Text style={s.ajuda}>Para a sua segurança, este contato é indispensável.</Text>
            <Input
              label="Nome"
              placeholder="Ex: Maria Souza (mãe)"
              value={emergNome}
              onChangeText={setEmergNome}
            />
            <View style={{ height: 10 }} />
            <Input
              label="Telefone"
              placeholder="(41) 99999-8888"
              value={emergTel}
              onChangeText={(v) => setEmergTel(mascaraTelefone(v))}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </Secao>

          <Secao titulo="Objetivos e rotina de treino">
            <Text style={s.pergunta}>Qual seu objetivo principal?</Text>
            <Text style={s.ajuda}>Marque até {MAX_OBJETIVOS}.</Text>
            {OBJETIVOS.map((o) => (
              <Caixa
                key={o}
                texto={o}
                marcada={objetivos.includes(o)}
                onPress={() => alternarObjetivo(o)}
              />
            ))}

            <View style={s.divisor} />
            <Text style={s.pergunta}>Qual sua experiência com exercício físico?</Text>
            {EXPERIENCIAS.map((e) => (
              <Caixa
                key={e}
                texto={e}
                marcada={experiencia === e}
                onPress={() => setExperiencia(experiencia === e ? '' : e)}
              />
            ))}
          </Secao>

          <Secao titulo="Fatores relacionados à sua profissão">
            <Input
              label="Qual a sua profissão?"
              placeholder="Ex: professora, motorista, analista"
              value={profissao}
              onChangeText={setProfissao}
            />

            <View style={s.divisor} />
            <Text style={s.pergunta}>
              Qual a postura que você sustenta por mais tempo durante o dia?
            </Text>
            {[...POSTURAS, 'Outro'].map((p) => (
              <Caixa
                key={p}
                texto={p}
                marcada={postura === p}
                onPress={() => setPostura(postura === p ? '' : p)}
              />
            ))}
            {postura === 'Outro' ? (
              <Input placeholder="Qual?" value={posturaOutra} onChangeText={setPosturaOutra} />
            ) : null}

            <View style={s.divisor} />
            <SimNao
              label="Você realiza muitos movimentos repetitivos ao longo do dia?"
              ajuda="Exemplo: quem trabalha em escritório repete muitas vezes o movimento de digitar e mexer no mouse."
              valor={repetitivos}
              onChange={setRepetitivos}
            />
            {repetitivos ? (
              <Input
                placeholder="Quais movimentos?"
                value={repetitivosQuais}
                onChangeText={setRepetitivosQuais}
                multiline
              />
            ) : null}
          </Secao>

          <Secao titulo="Patologias">
            <Text style={s.pergunta}>Assinale qual(is) patologia(s) você possui</Text>
            <Text style={s.ajuda}>Pode marcar mais de uma.</Text>
            {PATOLOGIAS.map((p) => (
              <Caixa
                key={p}
                texto={p}
                marcada={patologias.includes(p)}
                onPress={() => alternarPatologia(p)}
              />
            ))}
            <Caixa
              texto={PATOLOGIA_NENHUMA}
              marcada={patologias.includes(PATOLOGIA_NENHUMA)}
              onPress={() => alternarPatologia(PATOLOGIA_NENHUMA)}
            />
            {!patologias.includes(PATOLOGIA_NENHUMA) ? (
              <Input
                placeholder="Outra condição (opcional)"
                value={patologiaOutra}
                onChangeText={setPatologiaOutra}
              />
            ) : null}

            <View style={s.divisor} />
            <SimNao
              label="Você utiliza medicamento controlado?"
              valor={usaMedicamento}
              onChange={setUsaMedicamento}
            />
            {usaMedicamento ? (
              <Input
                placeholder="Qual(is)?"
                value={medicamentos}
                onChangeText={setMedicamentos}
                multiline
              />
            ) : null}

            <View style={s.divisor} />
            <SimNao
              label="Já realizou alguma cirurgia ou internação relevante?"
              valor={fezCirurgia}
              onChange={setFezCirurgia}
            />
            {fezCirurgia ? (
              <Input
                placeholder="Qual e há quanto tempo?"
                value={cirurgiaQual}
                onChangeText={setCirurgiaQual}
                multiline
              />
            ) : null}

            <View style={s.divisor} />
            <SimNao
              label="Possui alguma lesão articular ou muscular atualmente?"
              valor={temLesao}
              onChange={setTemLesao}
            />
            {temLesao ? (
              <Input placeholder="Qual?" value={lesoes} onChangeText={setLesoes} multiline />
            ) : null}

            <View style={s.divisor} />
            <SimNao
              label="Você sente alguma dor (aguda ou crônica) ou desconforto?"
              valor={temDor}
              onChange={setTemDor}
            />
            {temDor ? (
              <>
                <Input placeholder="Qual?" value={dores} onChangeText={setDores} multiline />
                <View style={{ height: 14 }} />
                <Text style={s.pergunta}>Marque no boneco onde você sente</Text>
                <BonecoDor
                  marcadas={regioesDor}
                  onAlternar={(id) =>
                    setRegioesDor((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
                  }
                />
              </>
            ) : null}
          </Secao>

          <Secao titulo="Prontidão para atividade física (PAR-Q)">
            <Text style={s.pergunta}>
              Assinale APENAS as opções que se aplicam a você atualmente
            </Text>
            {PARQ.map((p) => (
              <Caixa key={p} texto={p} marcada={parq.includes(p)} onPress={() => alternarParq(p)} />
            ))}
            {/*
              A opção exclusiva fica visualmente separada e limpa as outras:
              sem isso, dá para marcar "tenho dor no peito" e "nenhuma das
              opções" ao mesmo tempo, e o professor não sabe qual vale.
            */}
            <View style={s.divisor} />
            <Caixa
              texto={PARQ_NENHUMA}
              marcada={parqNenhuma}
              onPress={() => {
                const novo = !parqNenhuma;
                setParqNenhuma(novo);
                if (novo) setParq([]);
              }}
            />
          </Secao>

          <Secao titulo="Mais alguma coisa?">
            <Input
              placeholder="Algo que o professor precise saber antes de montar seu treino"
              value={observacoes}
              onChangeText={setObservacoes}
              multiline
              style={s.obsInput}
            />
          </Secao>

          <View style={{ height: 18 }} />
          <Button
            title={ficha.data ? 'Salvar alterações' : 'Enviar ficha'}
            size="lg"
            loading={salvar.isPending}
            onPress={enviar}
          />
          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <InfoModal
        visible={!!aviso}
        title={aviso === '__ok__' ? 'Ficha enviada!' : 'Atenção'}
        message={
          aviso === '__ok__'
            ? 'Parabéns por iniciar o seu processo de treinamento individualizado na Academia Life Company! Seu professor já consegue ver essas informações.'
            : (aviso ?? '')
        }
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

  intro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: LC.primaryLight, borderWidth: 0,
  },
  introTexto: { flex: 1, fontSize: 13, color: LC.textSecondary, lineHeight: 19 },

  secao: {
    fontSize: 13, fontWeight: '800', color: LC.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 22, marginBottom: 10,
  },
  cartao: { gap: 0 },

  pergunta: { fontSize: 14.5, fontWeight: '700', color: LC.textPrimary, lineHeight: 20 },
  ajuda: { fontSize: 12.5, color: LC.textSecondary, marginTop: 4, marginBottom: 8, lineHeight: 18 },
  divisor: { height: 1, backgroundColor: LC.border, marginVertical: 16 },

  caixaLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9 },
  caixaPress: { opacity: 0.6 },
  caixa: {
    width: 21, height: 21, borderRadius: 5, marginTop: 1,
    borderWidth: 1.5, borderColor: LC.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  caixaMarcada: { backgroundColor: LC.primary, borderColor: LC.primary },
  caixaTexto: { flex: 1, fontSize: 13.5, color: LC.textSecondary, lineHeight: 19 },
  caixaTextoMarcado: { color: LC.textPrimary, fontWeight: '600' },

  simNaoBloco: { gap: 0 },
  simNaoBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  simNaoBtn: {
    paddingHorizontal: 26, paddingVertical: 9, borderRadius: LC.radius.full,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
  },
  simNaoBtnSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  simNaoTexto: { fontSize: 13.5, fontWeight: '700', color: LC.textSecondary },
  simNaoTextoSel: { color: '#fff' },

  obsInput: { minHeight: 90, textAlignVertical: 'top' },
});
