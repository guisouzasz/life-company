import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { AppModal } from '../../components/ui/modal';
import { CreditosAlunoModal } from '../../components/admin/creditos-aluno-modal';
import { HorariosFixosAlunoModal } from '../../components/admin/horarios-fixos-aluno-modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import { useGerarLink, useAtualizarAluno } from '../../services/usuarios/usuarios.mutations';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import { ApiError } from '../../services/http';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { mascaraCep, mascaraCpf, mascaraData, mascaraTelefone, dataParaIso, isoParaData, soDigitos } from '../../services/mascaras';

/**
 * Ficha cadastral no card do aluno. Some inteira quando o cadastro é antigo e
 * não tem nenhum destes dados, para não poluir a lista com linhas vazias.
 */
function FichaCadastral({ aluno }: { aluno: AlunoAdmin }) {
  const linhas: { icone: React.ComponentProps<typeof Icon>['name']; texto: string }[] = [];
  if (aluno.cpf) linhas.push({ icone: 'card-outline', texto: `CPF ${mascaraCpf(aluno.cpf)}` });
  if (aluno.rg) linhas.push({ icone: 'id-card-outline', texto: `RG ${aluno.rg}` });
  if (aluno.dataNascimento) {
    linhas.push({ icone: 'calendar-number-outline', texto: `Nasc. ${isoParaData(aluno.dataNascimento)}` });
  }
  if (aluno.telefone) linhas.push({ icone: 'call-outline', texto: mascaraTelefone(aluno.telefone) });
  if (aluno.endereco || aluno.cep) {
    const cep = aluno.cep ? `CEP ${mascaraCep(aluno.cep)}` : '';
    linhas.push({
      icone: 'location-outline',
      texto: [aluno.endereco, cep].filter(Boolean).join(' — '),
    });
  }
  if (linhas.length === 0) return null;
  return (
    <View style={s.ficha}>
      {linhas.map((l) => (
        <View key={l.texto} style={s.fichaLinha}>
          <Icon name={l.icone} size={13} color={LC.textMuted} />
          <Text style={s.fichaTexto} numberOfLines={2}>{l.texto}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AdminAlunos() {
  const isDesktop = useIsDesktop();
  const { busca: buscaParam } = useLocalSearchParams<{ busca?: string }>();
  const [busca, setBusca] = useState(typeof buscaParam === 'string' ? buscaParam : '');
  const alunos = useAlunos(busca.trim() || undefined);

  // Busca vinda da topbar do painel (a tela pode já estar montada)
  useEffect(() => {
    if (typeof buscaParam === 'string' && buscaParam) setBusca(buscaParam);
  }, [buscaParam]);
  const gerarLink = useGerarLink();
  const atualizar = useAtualizarAluno();

  // Modal de link gerado
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Modal de créditos
  const [creditosAluno, setCreditosAluno] = useState<AlunoAdmin | null>(null);

  // Modal de plano e horário fixo
  const [planoHorarioAluno, setPlanoHorarioAluno] = useState<AlunoAdmin | null>(null);

  // Modal de edição (cadastro completo)
  const [editando, setEditando] = useState<AlunoAdmin | null>(null);
  const [form, setForm] = useState({
    nome: '', rg: '', cpf: '', endereco: '', cep: '', email: '', nascimento: '', telefone: '', ativo: true,
  });
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const abrirEdicao = (aluno: AlunoAdmin) => {
    setEditando(aluno);
    setErroEdicao(null);
    setForm({
      nome: aluno.nome,
      rg: aluno.rg ?? '',
      cpf: mascaraCpf(aluno.cpf ?? ''),
      endereco: aluno.endereco ?? '',
      cep: mascaraCep(aluno.cep ?? ''),
      email: aluno.email ?? '',
      nascimento: isoParaData(aluno.dataNascimento),
      telefone: mascaraTelefone(aluno.telefone ?? ''),
      ativo: aluno.ativo,
    });
  };

  const salvarEdicao = () => {
    if (!editando) return;
    if (!form.nome.trim()) {
      setErroEdicao('Nome é obrigatório.');
      return;
    }
    if (soDigitos(form.cpf).length !== 11) {
      setErroEdicao('CPF deve ter 11 dígitos.');
      return;
    }
    if (form.cep && soDigitos(form.cep).length !== 8) {
      setErroEdicao('CEP deve ter 8 dígitos.');
      return;
    }
    // Data em branco limpa o campo; preenchida, precisa ser uma data real.
    let nascimento = '';
    if (form.nascimento.trim()) {
      const iso = dataParaIso(form.nascimento);
      if (!iso) {
        setErroEdicao('Data de nascimento inválida — confira o dia, o mês e o ano.');
        return;
      }
      nascimento = iso;
    }
    atualizar.mutate(
      {
        id: editando.id,
        payload: {
          nome: form.nome.trim(),
          cpf: soDigitos(form.cpf),
          email: form.email.trim(), // vazio limpa o e-mail
          telefone: soDigitos(form.telefone),
          rg: form.rg.trim(),
          endereco: form.endereco.trim(),
          cep: soDigitos(form.cep),
          dataNascimento: nascimento,
          ativo: form.ativo,
        },
      },
      {
        onSuccess: () => setEditando(null),
        onError: (e) => setErroEdicao(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    );
  };

  const gerar = (id: string) => {
    gerarLink.mutate(id, {
      onSuccess: (data) => {
        setCopiado(false);
        setLink(data.link);
      },
      onError: (e) => {
        setCopiado(false);
        setLink(`Erro: ${e instanceof ApiError ? e.message : 'tente novamente.'}`);
      },
    });
  };

  const copiar = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopiado(true);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Alunos</Text>
        <Text style={s.subtitle}>{alunos.data?.length ?? 0} cadastrados</Text>
      </View>

      <View style={s.searchWrap}>
        <Input
          placeholder="Buscar por nome, CPF ou e-mail"
          value={busca}
          onChangeText={setBusca}
          autoCapitalize="none"
          leftIcon={<Icon name="search-outline" size={18} color={LC.textMuted} />}
        />
      </View>

      {alunos.isLoading ? (
        <Loading />
      ) : alunos.isError ? (
        <ErrorState onRetry={() => alunos.refetch()} />
      ) : isDesktop ? (
        // ── Desktop: tabela ──────────────────────────────────────────
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {alunos.data && alunos.data.length > 0 ? (
            <Card style={s.tabela} padding={0}>
              <View style={[s.tRow, s.tHead]}>
                <Text style={[s.tCol, s.tColNome, s.tHeadText]}>Aluno</Text>
                <Text style={[s.tCol, s.tColEmail, s.tHeadText]}>E-mail</Text>
                <Text style={[s.tCol, s.tColPlano, s.tHeadText]}>Plano</Text>
                <Text style={[s.tCol, s.tColStatus, s.tHeadText]}>Status</Text>
                <Text style={[s.tCol, s.tColAcoes, s.tHeadText]}>Ações</Text>
              </View>
              {alunos.data.map((aluno) => {
                const plano = aluno.usuarioPlanos?.[0];
                return (
                  <View key={aluno.id} style={s.tRow}>
                    <View style={[s.tCol, s.tColNome, s.tNomeWrap]}>
                      <Avatar nome={aluno.nome} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.tNome} numberOfLines={1}>{aluno.nome}</Text>
                        <Text style={s.tCpf}>CPF {aluno.cpf}</Text>
                      </View>
                    </View>
                    <Text style={[s.tCol, s.tColEmail, s.tTexto]} numberOfLines={1}>
                      {aluno.email ?? 'Aguardando ativação'}
                    </Text>
                    <Text style={[s.tCol, s.tColPlano, s.tTexto]} numberOfLines={1}>
                      {plano?.plano?.nome ?? '—'}
                    </Text>
                    <View style={[s.tCol, s.tColStatus]}>
                      <Badge label={aluno.ativo ? 'Ativo' : 'Inativo'} variant={aluno.ativo ? 'success' : 'danger'} />
                    </View>
                    <View style={[s.tCol, s.tColAcoes, s.tAcoes]}>
                      <Pressable style={s.tAcao} onPress={() => abrirEdicao(aluno)} accessibilityLabel="Editar dados do aluno">
                        <Icon name="create-outline" size={15} color={LC.primary} />
                        <Text style={s.tAcaoText}>Editar</Text>
                      </Pressable>
                      <Pressable style={s.tAcao} onPress={() => setPlanoHorarioAluno(aluno)} accessibilityLabel="Plano e horário fixo">
                        <Icon name="calendar-outline" size={15} color={LC.primary} />
                        <Text style={s.tAcaoText}>Plano</Text>
                      </Pressable>
                      <Pressable style={s.tAcao} onPress={() => setCreditosAluno(aluno)} accessibilityLabel="Créditos de reposição">
                        <Icon name="ticket-outline" size={15} color={LC.primary} />
                        <Text style={s.tAcaoText}>Créditos</Text>
                      </Pressable>
                      <Pressable style={s.tAcao} onPress={() => gerar(aluno.id)} accessibilityLabel="Gerar link de acesso">
                        <Icon name="link-outline" size={15} color={LC.primary} />
                        <Text style={s.tAcaoText}>Link</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon="people-outline" title="Nenhum aluno encontrado" description={busca ? 'Tente outra busca.' : 'Cadastre o primeiro aluno.'} />
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {alunos.data && alunos.data.length > 0 ? (
            alunos.data.map((aluno) => {
              const plano = aluno.usuarioPlanos?.[0];
              return (
                <Card key={aluno.id} style={s.card} padding={14}>
                  <View style={s.cardTop}>
                    <Avatar nome={aluno.nome} size={46} />
                    <View style={s.cardInfo}>
                      <Text style={s.nome}>{aluno.nome}</Text>
                      <Text style={s.email} numberOfLines={1}>{aluno.email ?? 'Sem e-mail — aguardando ativação'}</Text>
                      {plano?.plano ? <Text style={s.plano}>{plano.plano.nome}</Text> : null}
                    </View>
                    <Badge label={aluno.ativo ? 'Ativo' : 'Inativo'} variant={aluno.ativo ? 'success' : 'danger'} />
                  </View>

                  <FichaCadastral aluno={aluno} />

                  <View style={s.actions}>
                    <Button
                      title="Editar"
                      variant="outline"
                      size="sm"
                      onPress={() => abrirEdicao(aluno)}
                      leftIcon={<Icon name="create-outline" size={16} color={LC.primary} />}
                      style={s.actionBtn}
                    />
                    <Button
                      title="Gerar link"
                      size="sm"
                      onPress={() => gerar(aluno.id)}
                      loading={gerarLink.isPending && gerarLink.variables === aluno.id}
                      leftIcon={<Icon name="link-outline" size={16} color="#fff" />}
                      style={s.actionBtn}
                    />
                  </View>
                  <Pressable style={s.credLink} onPress={() => setCreditosAluno(aluno)}>
                    <Icon name="ticket-outline" size={16} color={LC.primary} />
                    <Text style={s.credLinkText}>Gerenciar créditos de reposição</Text>
                  </Pressable>
                  <Pressable style={s.credLink} onPress={() => setPlanoHorarioAluno(aluno)}>
                    <Icon name="calendar-outline" size={16} color={LC.primary} />
                    <Text style={s.credLinkText}>Editar plano e horário fixo</Text>
                  </Pressable>
                </Card>
              );
            })
          ) : (
            <EmptyState icon="people-outline" title="Nenhum aluno encontrado" description={busca ? 'Tente outra busca.' : 'Cadastre o primeiro aluno.'} />
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {!isDesktop ? (
        <Pressable style={s.fab} onPress={() => router.push('/admin/novo-aluno')}>
          <Icon name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}
      <TabBar isAdmin />

      {/* Modal: link de primeiro acesso */}
      <AppModal visible={!!link} onClose={() => setLink(null)} title="Link de primeiro acesso">
        <Text style={s.modalHint}>Envie este link ao aluno para ele criar a senha:</Text>
        <View style={s.linkBox}>
          <Text style={s.linkText} selectable>{link}</Text>
        </View>
        <View style={s.modalActions}>
          <Button title="Fechar" variant="outline" onPress={() => setLink(null)} style={{ flex: 1 }} />
          <Button
            title={copiado ? 'Copiado!' : 'Copiar'}
            onPress={copiar}
            leftIcon={<Icon name={copiado ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>
      </AppModal>

      {/* Modal: editar aluno */}
      <AppModal visible={!!editando} onClose={() => setEditando(null)} title="Editar aluno">
        <ScrollView style={s.editScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.editForm}>
            <Input label="Nome completo" value={form.nome} onChangeText={(t) => setForm((f) => ({ ...f, nome: t }))} autoCapitalize="words" />
            <Input label="RG" value={form.rg} onChangeText={(t) => setForm((f) => ({ ...f, rg: t }))} autoCapitalize="characters" placeholder="00.000.000-0" />
            <Input label="CPF" value={form.cpf} onChangeText={(t) => setForm((f) => ({ ...f, cpf: mascaraCpf(t) }))} keyboardType="numeric" placeholder="000.000.000-00" />
            <Input label="Endereço" value={form.endereco} onChangeText={(t) => setForm((f) => ({ ...f, endereco: t }))} autoCapitalize="words" placeholder="Rua, número, bairro, cidade" />
            <Input label="CEP" value={form.cep} onChangeText={(t) => setForm((f) => ({ ...f, cep: mascaraCep(t) }))} keyboardType="numeric" placeholder="00000-000" />
            <Input label="E-mail" value={form.email} onChangeText={(t) => setForm((f) => ({ ...f, email: t }))} keyboardType="email-address" autoCapitalize="none" placeholder="vazio = aluno cadastra na ativação" />
            <Input label="Data de nascimento" value={form.nascimento} onChangeText={(t) => setForm((f) => ({ ...f, nascimento: mascaraData(t) }))} keyboardType="numeric" placeholder="DD/MM/AAAA" />
            <Input label="Telefone" value={form.telefone} onChangeText={(t) => setForm((f) => ({ ...f, telefone: mascaraTelefone(t) }))} keyboardType="phone-pad" placeholder="(00) 00000-0000" />

            <Text style={s.editLabel}>Status</Text>
            <View style={s.editChips}>
              <Pressable style={[s.editChip, form.ativo && s.editChipAtivo]} onPress={() => setForm((f) => ({ ...f, ativo: true }))}>
                <View style={[s.editDot, { backgroundColor: form.ativo ? LC.success : LC.textMuted }]} />
                <Text style={[s.editChipText, form.ativo && { color: LC.successFg, fontWeight: '700' }]}>Ativo</Text>
              </Pressable>
              <Pressable style={[s.editChip, !form.ativo && s.editChipInativo]} onPress={() => setForm((f) => ({ ...f, ativo: false }))}>
                <View style={[s.editDot, { backgroundColor: !form.ativo ? LC.danger : LC.textMuted }]} />
                <Text style={[s.editChipText, !form.ativo && { color: LC.dangerFg, fontWeight: '700' }]}>Inativo</Text>
              </Pressable>
            </View>
            {!form.ativo ? (
              <Text style={s.editAviso}>Inativo não consegue entrar no app nem agendar aulas.</Text>
            ) : null}

            {erroEdicao ? <Text style={s.erro}>{erroEdicao}</Text> : null}
          </View>
        </ScrollView>
        <View style={s.modalActions}>
          <Button title="Cancelar" variant="outline" onPress={() => setEditando(null)} style={{ flex: 1 }} />
          <Button title="Salvar" loading={atualizar.isPending} onPress={salvarEdicao} style={{ flex: 1 }} />
        </View>
      </AppModal>

      {/* Modal: créditos do aluno */}
      <CreditosAlunoModal aluno={creditosAluno} onClose={() => setCreditosAluno(null)} />

      {/* Modal: plano e horário fixo do aluno */}
      <HorariosFixosAlunoModal aluno={planoHorarioAluno} onClose={() => setPlanoHorarioAluno(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  scroll: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  email: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  plano: { fontSize: 11, color: LC.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1 },
  ficha: { gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LC.border },
  fichaLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  fichaTexto: { flex: 1, fontSize: 12, color: LC.textSecondary, lineHeight: 17 },
  credLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  credLinkText: { fontSize: 13, fontWeight: '600', color: LC.primary },
  fab: {
    position: 'absolute', right: 20, bottom: 92, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center', ...LC.shadowStrong,
  },
  modalHint: { fontSize: 13, color: LC.textSecondary, marginBottom: 10 },
  linkBox: { backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border, borderRadius: LC.radius.md, padding: 12, marginBottom: 16 },
  linkText: { fontSize: 13, color: LC.textPrimary },
  modalActions: { flexDirection: 'row', gap: 10 },
  editScroll: { maxHeight: 440, marginBottom: 18 },
  editForm: { gap: 14 },
  editLabel: { fontSize: 12, fontWeight: '700', color: LC.textSecondary, marginBottom: -6 },
  editChips: { flexDirection: 'row', gap: 8 },
  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border,
  },
  editChipAtivo: { backgroundColor: LC.successBg, borderColor: LC.success },
  editChipInativo: { backgroundColor: LC.dangerBg, borderColor: LC.danger },
  editDot: { width: 8, height: 8, borderRadius: 4 },
  editChipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  editAviso: { fontSize: 12, color: LC.textMuted, marginTop: -4 },
  erro: { fontSize: 13, color: LC.danger },

  // ── Tabela desktop ──────────────────────────────────────────────
  tabela: { overflow: 'hidden' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LC.border },
  tHead: { backgroundColor: LC.bg, paddingVertical: 12 },
  tHeadText: { fontSize: 12, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tCol: { paddingHorizontal: 4 },
  tColNome: { flex: 3 },
  tColEmail: { flex: 3 },
  tColPlano: { flex: 2 },
  tColStatus: { flex: 1.2 },
  tColAcoes: { flex: 2.8 },
  tNomeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  tCpf: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  tTexto: { fontSize: 13, color: LC.textSecondary },
  tAcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  tAcao: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: LC.radius.full, backgroundColor: LC.primaryLight,
  },
  tAcaoText: { fontSize: 12, fontWeight: '700', color: LC.primary },
});
