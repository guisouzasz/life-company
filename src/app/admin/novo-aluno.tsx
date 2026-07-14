import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LC } from '../../constants/theme';
import { iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { Header } from '../../components/ui/header';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { AppModal, InfoModal } from '../../components/ui/modal';
import { usePlanos } from '../../services/planos/planos.queries';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import { useCriarAluno } from '../../services/usuarios/usuarios.mutations';
import { ApiError } from '../../services/http';

function formatCpf(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export default function NovoAluno() {
  const [tipo, setTipo] = useState<'ALUNO' | 'PROFESSOR'>('ALUNO');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [modalidadeProfId, setModalidadeProfId] = useState('');

  const planos = usePlanos();
  const modalidades = useModalidades();
  const criar = useCriarAluno();

  const [linkCriado, setLinkCriado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const ehProfessor = tipo === 'PROFESSOR';

  const submit = () => {
    if (!nome.trim() || cpf.replace(/\D/g, '').length !== 11 || (!ehProfessor && !planoId)) {
      setErro(ehProfessor ? 'Preencha nome e CPF (11 dígitos).' : 'Preencha nome, CPF (11 dígitos) e plano.');
      return;
    }
    if (ehProfessor && !modalidadeProfId) {
      setErro('Escolha a modalidade do professor.');
      return;
    }
    // O plano dá acesso a todas as modalidades; o backend exige um modalidadeId
    // por schema, então usamos a primeira disponível (não restringe agendamentos).
    const modalidadeId = modalidades.data?.[0]?.id;
    if (!ehProfessor && !modalidadeId) {
      setErro('Aguarde carregar as modalidades e tente novamente.');
      return;
    }
    criar.mutate(
      {
        nome: nome.trim(),
        cpf: cpf.replace(/\D/g, ''),
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        tipoUsuario: tipo,
        ...(ehProfessor ? { modalidadeId: modalidadeProfId } : { planoId, modalidadeId }),
      },
      {
        onSuccess: (data) => {
          setCopiado(false);
          setLinkCriado(data.linkAcesso);
        },
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível criar o cadastro.'),
      },
    );
  };

  const copiar = async () => {
    if (!linkCriado) return;
    await Clipboard.setStringAsync(linkCriado);
    setCopiado(true);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <Header title="Novo aluno" showBack />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Tipo de cadastro */}
          <Card style={s.section} padding={16}>
            <Text style={s.sectionTitle}>Tipo de cadastro</Text>
            <View style={s.chips}>
              {(['ALUNO', 'PROFESSOR'] as const).map((t) => {
                const sel = tipo === t;
                return (
                  <Pressable key={t} style={[s.chip, sel && s.chipSel]} onPress={() => setTipo(t)}>
                    <Icon name={t === 'ALUNO' ? 'person-outline' : 'school-outline'} size={14} color={sel ? LC.primary : LC.textSecondary} />
                    <Text style={[s.chipText, sel && s.chipTextSel]}>{t === 'ALUNO' ? 'Aluno' : 'Professor'}</Text>
                  </Pressable>
                );
              })}
            </View>
            {ehProfessor ? (
              <View style={s.hintRow}>
                <Icon name="information-circle-outline" size={16} color={LC.primary} />
                <Text style={s.hintText}>
                  Professor acessa somente a agenda (sem alterar horários) e monta os treinos dos alunos.
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Dados pessoais */}
          <Card style={s.section} padding={16}>
            <Text style={s.sectionTitle}>Dados pessoais</Text>
            <View style={s.fields}>
              <Input label="Nome completo *" placeholder="Nome do aluno" value={nome} onChangeText={setNome} autoCapitalize="words" />
              <Input label="CPF *" placeholder="000.000.000-00" value={cpf} onChangeText={(t) => setCpf(formatCpf(t))} keyboardType="numeric" />
              <Input label="E-mail (opcional)" placeholder="o aluno cadastra ao ativar a conta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Input label="Telefone" placeholder="(00) 00000-0000" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
            </View>
          </Card>

          {/* Modalidade do professor */}
          {ehProfessor ? (
            <Card style={s.section} padding={16}>
              <Text style={s.sectionTitle}>Modalidade do professor *</Text>
              <View style={s.chips}>
                {modalidades.data?.map((m) => {
                  const sel = modalidadeProfId === m.id;
                  return (
                    <Pressable key={m.id} style={[s.chip, sel && s.chipSel]} onPress={() => setModalidadeProfId(m.id)}>
                      <Icon name={iconePorModalidade(m.nome)} size={14} color={sel ? LC.primary : LC.textSecondary} />
                      <Text style={[s.chipText, sel && s.chipTextSel]}>{nomeModalidade(m.nome)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.hintRow}>
                <Icon name="information-circle-outline" size={16} color={LC.primary} />
                <Text style={s.hintText}>
                  O professor vê apenas a agenda desta modalidade e monta treinos só dela.
                </Text>
              </View>
            </Card>
          ) : null}

          {/* Plano (só aluno) */}
          {ehProfessor ? null : (
          <Card style={s.section} padding={16}>
            <Text style={s.sectionTitle}>Plano *</Text>
            <View style={s.chips}>
              {planos.data?.map((p) => {
                const sel = planoId === p.id;
                return (
                  <Pressable key={p.id} style={[s.chip, sel && s.chipSel]} onPress={() => setPlanoId(p.id)}>
                    <Text style={[s.chipText, sel && s.chipTextSel]}>{p.nome}</Text>
                    {sel ? <Icon name="checkmark" size={14} color={LC.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={s.hintRow}>
              <Icon name="information-circle-outline" size={16} color={LC.primary} />
              <Text style={s.hintText}>
                O plano dá acesso a todas as modalidades — Musculação, Funcional e Pilates.
              </Text>
            </View>
          </Card>
          )}

          <Button
            title={ehProfessor ? 'Criar professor e gerar link' : 'Criar aluno e gerar link'}
            size="lg"
            loading={criar.isPending}
            onPress={submit}
            style={s.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal: link de primeiro acesso */}
      <AppModal
        visible={!!linkCriado}
        onClose={() => {
          setLinkCriado(null);
          router.back();
        }}
        title={ehProfessor ? 'Professor criado!' : 'Aluno criado!'}
      >
        <Text style={s.modalHint}>
          {ehProfessor
            ? 'Envie este link ao professor para ele criar a senha (ou ele pode ativar pelo CPF no app):'
            : 'Envie este link ao aluno para ele criar a senha:'}
        </Text>
        <View style={s.linkBox}>
          <Text style={s.linkText} selectable>{linkCriado}</Text>
        </View>
        <View style={s.modalActions}>
          <Button
            title="Concluir"
            variant="outline"
            onPress={() => {
              setLinkCriado(null);
              router.back();
            }}
            style={{ flex: 1 }}
          />
          <Button
            title={copiado ? 'Copiado!' : 'Copiar'}
            onPress={copiar}
            leftIcon={<Icon name={copiado ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>
      </AppModal>

      <InfoModal visible={!!erro} title="Atenção" message={erro ?? ''} onClose={() => setErro(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: LC.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  fields: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: LC.radius.full, backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextSel: { color: LC.primary },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: LC.border },
  hintText: { flex: 1, fontSize: 12, color: LC.textSecondary, lineHeight: 17 },
  submit: { marginTop: 4 },
  modalHint: { fontSize: 13, color: LC.textSecondary, marginBottom: 10 },
  linkBox: { backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border, borderRadius: LC.radius.md, padding: 12, marginBottom: 16 },
  linkText: { fontSize: 13, color: LC.textPrimary },
  modalActions: { flexDirection: 'row', gap: 10 },
});
