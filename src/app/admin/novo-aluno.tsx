import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { openBrowserAsync } from 'expo-web-browser';
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
import { mascaraCep, mascaraCpf, mascaraData, mascaraTelefone, mascaraReal, realParaNumero, dataParaIso, soDigitos } from '../../services/mascaras';
import { linkWhatsapp, mensagemPrimeiroAcesso, telefoneParaWhatsapp } from '../../services/whatsapp';

export default function NovoAluno() {
  const [tipo, setTipo] = useState<'ALUNO' | 'PROFESSOR'>('ALUNO');
  const [nome, setNome] = useState('');
  const [rg, setRg] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cep, setCep] = useState('');
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [valorTexto, setValorTexto] = useState('');
  const [diaTexto, setDiaTexto] = useState('5');
  const [modalidadeProfId, setModalidadeProfId] = useState('');

  const planos = usePlanos();
  const modalidades = useModalidades();
  const criar = useCriarAluno();

  const [linkCriado, setLinkCriado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const ehProfessor = tipo === 'PROFESSOR';

  const submit = () => {
    if (!nome.trim() || soDigitos(cpf).length !== 11) {
      setErro('Preencha nome completo e CPF (11 dígitos).');
      return;
    }
    if (ehProfessor && !modalidadeProfId) {
      setErro('Escolha a modalidade do professor.');
      return;
    }
    // A ficha completa é exigida só do aluno; o professor entra com nome e CPF.
    let nascimentoIso: string | undefined;
    if (!ehProfessor) {
      if (!planoId) {
        setErro('Escolha o plano do aluno.');
        return;
      }
      const faltando: string[] = [];
      if (rg.trim().length < 5) faltando.push('RG');
      if (endereco.trim().length < 5) faltando.push('endereço');
      if (soDigitos(cep).length !== 8) faltando.push('CEP');
      if (!email.trim()) faltando.push('e-mail');
      if (faltando.length > 0) {
        setErro(`Preencha ${faltando.join(', ')}.`);
        return;
      }
      nascimentoIso = dataParaIso(nascimento) ?? undefined;
      if (!nascimentoIso) {
        setErro(
          soDigitos(nascimento).length === 8
            ? 'Data de nascimento inválida — confira o dia, o mês e o ano.'
            : 'Preencha a data de nascimento (DD/MM/AAAA).',
        );
        return;
      }
    }
    // O plano dá acesso a todas as modalidades; o backend exige um modalidadeId
    // por schema, então usamos a primeira disponível (não restringe agendamentos).
    const modalidadeId = modalidades.data?.[0]?.id;
    if (!ehProfessor && !modalidadeId) {
      setErro('Aguarde carregar as modalidades e tente novamente.');
      return;
    }
    // Mensalidade é opcional: nem sempre o preço está fechado na hora de
    // cadastrar. Quando vem, precisa ser um número que faça sentido.
    const valor = realParaNumero(valorTexto);
    if (!ehProfessor && valorTexto.trim() && (valor === null || valor < 0)) {
      setErro('Valor da mensalidade inválido.');
      return;
    }
    const dia = parseInt(diaTexto, 10);
    if (!ehProfessor && (!Number.isFinite(dia) || dia < 1 || dia > 28)) {
      setErro('Dia de vencimento deve ser entre 1 e 28.');
      return;
    }
    criar.mutate(
      {
        nome: nome.trim(),
        cpf: soDigitos(cpf),
        email: email.trim() || undefined,
        telefone: soDigitos(telefone) || undefined,
        tipoUsuario: tipo,
        ...(ehProfessor
          ? { modalidadeId: modalidadeProfId }
          : {
              planoId,
              modalidadeId,
              rg: rg.trim(),
              endereco: endereco.trim(),
              cep: soDigitos(cep),
              dataNascimento: nascimentoIso,
              ...(valor !== null ? { valorMensalidade: valor } : {}),
              diaVencimento: dia,
            }),
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

  /**
   * O telefone já foi digitado neste formulário — não faz sentido copiar o
   * link, sair do sistema, procurar o aluno na agenda e colar. O botão abre a
   * conversa com o número do cadastro e o texto pronto.
   */
  const numeroWhatsapp = telefoneParaWhatsapp(telefone);
  const enviarWhatsapp = async () => {
    if (!linkCriado || !numeroWhatsapp) return;
    const texto = mensagemPrimeiroAcesso({ nome, link: linkCriado, professor: ehProfessor });
    try {
      await openBrowserAsync(linkWhatsapp(numeroWhatsapp, texto));
    } catch {
      setErro('Não foi possível abrir o WhatsApp neste aparelho. Copie o link e envie do seu jeito.');
    }
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
              <Input label="Nome completo *" placeholder={ehProfessor ? 'Nome do professor' : 'Nome do aluno'} value={nome} onChangeText={setNome} autoCapitalize="words" />
              {ehProfessor ? null : (
                <Input label="RG *" placeholder="00.000.000-0" value={rg} onChangeText={setRg} autoCapitalize="characters" />
              )}
              <Input label="CPF *" placeholder="000.000.000-00" value={cpf} onChangeText={(t) => setCpf(mascaraCpf(t))} keyboardType="numeric" />
              {ehProfessor ? null : (
                <>
                  <Input label="Endereço *" placeholder="Rua, número, complemento, bairro, cidade" value={endereco} onChangeText={setEndereco} autoCapitalize="words" />
                  <Input label="CEP *" placeholder="00000-000" value={cep} onChangeText={(t) => setCep(mascaraCep(t))} keyboardType="numeric" />
                </>
              )}
              <Input
                label={ehProfessor ? 'E-mail (opcional)' : 'E-mail *'}
                placeholder={ehProfessor ? 'o professor cadastra ao ativar a conta' : 'email@exemplo.com'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {ehProfessor ? null : (
                <Input label="Data de nascimento *" placeholder="DD/MM/AAAA" value={nascimento} onChangeText={(t) => setNascimento(mascaraData(t))} keyboardType="numeric" />
              )}
              <Input label="Telefone" placeholder="(00) 00000-0000" value={telefone} onChangeText={(t) => setTelefone(mascaraTelefone(t))} keyboardType="phone-pad" />
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

          {/* Mensalidade (só aluno) */}
          {ehProfessor ? null : (
          <Card style={s.section} padding={16}>
            <Text style={s.sectionTitle}>Mensalidade</Text>
            <View style={s.linhaDupla}>
              <View style={{ flex: 1.4 }}>
                <Input
                  label="Valor"
                  placeholder="0,00"
                  value={valorTexto}
                  onChangeText={(v) => setValorTexto(mascaraReal(v))}
                  keyboardType="number-pad"
                  leftIcon={<Text style={s.prefixo}>R$</Text>}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Vence dia"
                  placeholder="5"
                  value={diaTexto}
                  onChangeText={setDiaTexto}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
            <View style={s.hintRow}>
              <Icon name="information-circle-outline" size={16} color={LC.primary} />
              <Text style={s.hintText}>
                O valor é deste aluno, não do plano. Preenchido aqui, ele já entra no previsto do
                mês no Financeiro. Pode ficar vazio se o preço ainda não foi combinado.
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
        {numeroWhatsapp ? (
          <Button
            title="Enviar pelo WhatsApp"
            onPress={enviarWhatsapp}
            leftIcon={<Icon name="logo-whatsapp" size={17} color="#fff" />}
            style={s.whatsBtn}
          />
        ) : (
          <Text style={s.semTelefone}>
            {telefone.trim()
              ? 'O telefone informado não forma um número válido — confira o DDD para poder enviar pelo WhatsApp.'
              : 'Sem telefone no cadastro não dá para enviar pelo WhatsApp: copie o link e mande do seu jeito.'}
          </Text>
        )}
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
  linhaDupla: { flexDirection: 'row', gap: 10 },
  prefixo: { fontSize: 15, fontWeight: '700', color: LC.textSecondary },
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
  whatsBtn: { marginBottom: 10 },
  semTelefone: { fontSize: 12.5, color: LC.textMuted, lineHeight: 18, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10 },
});
