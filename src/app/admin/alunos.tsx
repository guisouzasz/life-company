import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Avatar } from '../../components/ui/avatar';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { AppModal, ConfirmModal, InfoModal } from '../../components/ui/modal';
import { CreditosAlunoModal } from '../../components/admin/creditos-aluno-modal';
import { HorariosFixosAlunoModal } from '../../components/admin/horarios-fixos-aluno-modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import { useGerarLink, useAtualizarAluno, useExcluirAlunoDefinitivamente } from '../../services/usuarios/usuarios.mutations';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import { ApiError } from '../../services/http';
import { nomeCurto } from '../../services/nome';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { mascaraCep, mascaraCpf, mascaraData, mascaraTelefone, dataParaIso, isoParaData, soDigitos } from '../../services/mascaras';
import { openBrowserAsync } from 'expo-web-browser';
import { linkWhatsapp, mensagemPrimeiroAcesso, telefoneParaWhatsapp } from '../../services/whatsapp';

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

/**
 * O selo do canto responde a OUTRA pergunta que não a do botão.
 *
 * São duas coisas independentes: `ativo` = treina aqui (é o botão, que a dona
 * controla) e `ativado` = já abriu o app pela primeira vez (é isto, que
 * depende do aluno). Antes as duas viviam no mesmo campo, e quem nunca tinha
 * entrado aparecia como desligado — sem jeito de dizer que ele treina.
 *
 * Some quando não há o que dizer: repetir "Ativo" ao lado de um botão que já
 * diz "Treina" é ruído, e ruído em toda linha esconde o que importa.
 */
function statusDoAluno(aluno: AlunoAdmin): { label: string; variant: BadgeVariant } | null {
  if (aluno.ativado) return null;
  return { label: 'Ainda não abriu o app', variant: 'warning' };
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
  /** De quem é o link aberto: o botão do WhatsApp precisa do nome e do telefone. */
  const [alunoDoLink, setAlunoDoLink] = useState<AlunoAdmin | null>(null);
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
  /** Recado depois de desativar: o que saiu das turmas. */
  const [aviso, setAviso] = useState<{ titulo: string; texto: string } | null>(null);
  /** Aluno que a dona quer apagar de vez — precisa confirmar. */
  const [excluindo, setExcluindo] = useState<AlunoAdmin | null>(null);
  /** Quem está no meio da troca treina/não treina, para o botão dar retorno. */
  const [mudandoMatricula, setMudandoMatricula] = useState<string | null>(null);
  const excluirDefinitivo = useExcluirAlunoDefinitivamente();

  /**
   * Liga e desliga a matrícula num toque, direto na lista.
   *
   * Antes isso morava no fundo do modal de edição, junto com RG e CEP, e a
   * dona tinha que abrir o cadastro para dizer que alguém parou de treinar.
   * É a operação que ela mais faz — aluno some, aluno volta — e por isso
   * fica ao lado do nome.
   *
   * Vale para qualquer aluno, inclusive quem nunca abriu o app: "treina aqui"
   * e "já fez o primeiro acesso" são perguntas diferentes.
   */
  const alternarMatricula = (aluno: AlunoAdmin) => {
    setMudandoMatricula(aluno.id);
    atualizar.mutate(
      { id: aluno.id, payload: { ativo: !aluno.ativo } },
      {
        onSuccess: (r: any) => {
          setMudandoMatricula(null);
          const fixos = r?.horariosFixosRemovidos ?? 0;
          const aulas = r?.aulasCanceladas ?? 0;
          const quem = nomeCurto(aluno.nome);
          if (aluno.ativo) {
            const partes = [];
            if (fixos > 0) partes.push(`${fixos} horário(s) fixo(s)`);
            if (aulas > 0) partes.push(`${aulas} aula(s) futura(s)`);
            setAviso({
              titulo: `${quem} não treina mais`,
              texto:
                (partes.length
                  ? `Foram liberados: ${partes.join(' e ')}. As vagas voltaram para as turmas.\n\n`
                  : 'Ele sai das turmas e não entra mais no app.\n\n') +
                'Se foi engano, reative o aluno e confirme os dias atuais em Plano e horários.',
            });
          } else {
            setAviso({
              titulo: `${quem} voltou a treinar`,
              texto: 'Cadastro reativado. Confirme os dias atuais em Plano e horários para voltar à agenda. Horários removidos não voltam automaticamente.',
            });
          }
        },
        onError: (e) => {
          setMudandoMatricula(null);
          setAviso({
            titulo: 'Não consegui mudar',
            texto: e instanceof ApiError ? e.message : 'Tente de novo.',
          });
        },
      },
    );
  };

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
        onSuccess: (r: any) => {
          setEditando(null);
          // A API devolve o que foi liberado quando o aluno é desativado.
          const fixos = r?.horariosFixosRemovidos ?? 0;
          const aulas = r?.aulasCanceladas ?? 0;
          if (fixos > 0 || aulas > 0) {
            const partes = [];
            if (fixos > 0) partes.push(`${fixos} horário(s) fixo(s)`);
            if (aulas > 0) partes.push(`${aulas} aula(s) futura(s)`);
            setAviso({
              titulo: 'Aluno desligado',
              texto:
                `Foram liberados: ${partes.join(' e ')}. As vagas voltaram para as turmas.\n\n` +
                'Se foi engano, reative o aluno e confirme os dias atuais em Plano e horários.',
            });
          } else if (r?.revisarHorariosFixos) {
            setAviso({
              titulo: 'Aluno reativado',
              texto:
                'Confirme os dias atuais em Plano e horários. Horários removidos não voltam automaticamente.',
            });
          }
        },
        onError: (e) => setErroEdicao(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    );
  };

  const gerar = (aluno: AlunoAdmin) => {
    gerarLink.mutate(aluno.id, {
      onSuccess: (data) => {
        setCopiado(false);
        setAlunoDoLink(aluno);
        setLink(data.link);
      },
      onError: (e) => {
        setCopiado(false);
        setAlunoDoLink(null);
        setLink(`Erro: ${e instanceof ApiError ? e.message : 'tente novamente.'}`);
      },
    });
  };

  /**
   * Manda o convite pelo número que já está no cadastro. Some quando a
   * geração falhou (aí o "link" é uma mensagem de erro) ou quando o telefone
   * não forma um número que o WhatsApp abra.
   */
  const numeroWhatsapp = telefoneParaWhatsapp(alunoDoLink?.telefone);
  const podeMandarWhatsapp = !!link && link.startsWith('http') && !!numeroWhatsapp && !!alunoDoLink;
  const enviarWhatsapp = async () => {
    if (!podeMandarWhatsapp || !link || !numeroWhatsapp || !alunoDoLink) return;
    const texto = mensagemPrimeiroAcesso({ nome: alunoDoLink.nome, link });
    await openBrowserAsync(linkWhatsapp(numeroWhatsapp, texto)).catch(() => {});
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
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Alunos</Text>
            <Text style={s.subtitle}>{alunos.data?.length ?? 0} cadastrados</Text>
          </View>
          {/* Professor não aparece nesta lista (ela é só de alunos); a gestão
              deles fica a um toque daqui, que é onde se procura por pessoas. */}
          <Pressable
            style={({ pressed }) => [s.professoresBtn, pressed && s.professoresBtnPress]}
            onPress={() => router.push('/admin/professores')}
            accessibilityRole="button"
            accessibilityLabel="Ver professores"
          >
            <Icon name="people-outline" size={15} color={LC.primary} />
            <Text style={s.professoresTexto}>Professores</Text>
          </Pressable>
        </View>
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
                const status = statusDoAluno(aluno);
                return (
                  <View key={aluno.id} style={s.tRow}>
                    <View style={[s.tCol, s.tColNome, s.tNomeWrap]}>
                      <Avatar nome={aluno.nome} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.tNome} numberOfLines={1}>{nomeCurto(aluno.nome)}</Text>
                        <Text style={s.tCpf}>CPF {aluno.cpf}</Text>
                      </View>
                    </View>
                    <Text style={[s.tCol, s.tColEmail, s.tTexto]} numberOfLines={1}>
                      {aluno.email ?? 'Aguardando ativação'}
                    </Text>
                    <Text style={[s.tCol, s.tColPlano, s.tTexto]} numberOfLines={1}>
                      {plano?.plano?.nome ?? '—'}
                    </Text>
                    <View style={[s.tCol, s.tColStatus, s.tStatusWrap]}>
{/*
                        Fica na coluna Status, que é exatamente o que ele diz —
                        e clicável, porque é a operação que a dona mais faz.
                        Um toque, sem abrir cadastro nenhum. No nome ele
                        espremia o texto e quebrava o CPF em duas linhas.
                      */}
                      <Pressable
                        style={({ pressed }) => [
                          s.chaveMatricula,
                          aluno.ativo ? s.chaveTreina : s.chaveParou,
                          pressed && { opacity: 0.6 },
                        ]}
                        onPress={() => alternarMatricula(aluno)}
                        disabled={mudandoMatricula === aluno.id}
                        accessibilityLabel={
                          aluno.ativo
                            ? `Marcar que ${aluno.nome} não treina mais`
                            : `Marcar que ${aluno.nome} voltou a treinar`
                        }
                      >
                        <Icon
                          name={aluno.ativo ? 'checkmark-circle' : 'pause-circle'}
                          size={14}
                          color={aluno.ativo ? LC.successFg : LC.dangerFg}
                        />
                        <Text style={[s.chaveTexto, { color: aluno.ativo ? LC.successFg : LC.dangerFg }]}>
                          {mudandoMatricula === aluno.id ? '…' : aluno.ativo ? 'Treina' : 'Não treina'}
                        </Text>
                      </Pressable>
                      {status ? <Badge label={status.label} variant={status.variant} /> : null}
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
                      <Pressable style={s.tAcao} onPress={() => gerar(aluno)} accessibilityLabel="Gerar link de acesso">
                        <Icon name="link-outline" size={15} color={LC.primary} />
                        <Text style={s.tAcaoText}>Link</Text>
                      </Pressable>
                      <Pressable
                        style={s.tAcao}
                        onPress={() => setExcluindo(aluno)}
                        accessibilityLabel={`Excluir ${aluno.nome} definitivamente`}
                      >
                        <Icon name="trash-outline" size={15} color={LC.danger} />
                        <Text style={[s.tAcaoText, { color: LC.danger }]}>Excluir</Text>
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
              const status = statusDoAluno(aluno);
              return (
                <Card key={aluno.id} style={s.card} padding={14}>
                  <View style={s.cardTop}>
                    <Avatar nome={aluno.nome} size={46} />
                    <View style={s.cardInfo}>
                      <Text style={s.nome}>{nomeCurto(aluno.nome)}</Text>
                      <Text style={s.email} numberOfLines={1}>{aluno.email ?? 'Sem e-mail — aguardando ativação'}</Text>
                      <View style={s.chaveLinha}>
                      {/*
                            O botão fica colado no nome porque é a operação que a
                            dona mais faz. Um toque, sem abrir cadastro nenhum.
                        */}
                        <Pressable
                            style={({ pressed }) => [
                              s.chaveMatricula,
                              aluno.ativo ? s.chaveTreina : s.chaveParou,
                              pressed && { opacity: 0.6 },
                            ]}
                            onPress={() => alternarMatricula(aluno)}
                            disabled={mudandoMatricula === aluno.id}
                            accessibilityLabel={
                              aluno.ativo
                                ? `Marcar que ${aluno.nome} não treina mais`
                                : `Marcar que ${aluno.nome} voltou a treinar`
                            }
                        >
                            <Icon
                              name={aluno.ativo ? 'checkmark-circle' : 'pause-circle'}
                              size={14}
                              color={aluno.ativo ? LC.successFg : LC.dangerFg}
                            />
                            <Text style={[s.chaveTexto, { color: aluno.ativo ? LC.successFg : LC.dangerFg }]}>
                              {mudandoMatricula === aluno.id ? '…' : aluno.ativo ? 'Treina' : 'Não treina'}
                            </Text>
                        </Pressable>
                      </View>
                      {plano?.plano ? <Text style={s.plano}>{plano.plano.nome}</Text> : null}
                    </View>
                    {status ? <Badge label={status.label} variant={status.variant} /> : null}
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
                      onPress={() => gerar(aluno)}
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
                  <Pressable
                    style={[s.credLink, s.credLinkPerigo]}
                    onPress={() => setExcluindo(aluno)}
                    accessibilityLabel={`Excluir ${aluno.nome} definitivamente`}
                  >
                    <Icon name="trash-outline" size={16} color={LC.danger} />
                    <Text style={[s.credLinkText, { color: LC.danger }]}>Excluir aluno definitivamente</Text>
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
      <AppModal
        visible={!!link}
        onClose={() => { setLink(null); setAlunoDoLink(null); }}
        title="Link de primeiro acesso"
      >
        <Text style={s.modalHint}>Envie este link ao aluno para ele criar a senha:</Text>
        <View style={s.linkBox}>
          <Text style={s.linkText} selectable>{link}</Text>
        </View>
        {podeMandarWhatsapp ? (
          <Button
            title="Enviar pelo WhatsApp"
            onPress={enviarWhatsapp}
            leftIcon={<Icon name="logo-whatsapp" size={17} color="#fff" />}
            style={s.whatsBtn}
          />
        ) : link?.startsWith('http') ? (
          <Text style={s.semTelefone}>
            {alunoDoLink?.telefone
              ? 'O telefone do cadastro não forma um número válido — confira o DDD em Editar para enviar pelo WhatsApp.'
              : 'Este aluno não tem telefone no cadastro. Informe o número em Editar para enviar pelo WhatsApp.'}
          </Text>
        ) : null}
        <View style={s.modalActions}>
          <Button title="Fechar" variant="outline" onPress={() => { setLink(null); setAlunoDoLink(null); }} style={{ flex: 1 }} />
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
            {editando && !editando.ativado ? (
              <>
                <View style={s.statusPendenteBox}>
                  <Icon name="time-outline" size={16} color={LC.warningFg} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.statusPendenteTitulo}>Pendente de primeiro acesso</Text>
                    <Text style={s.statusPendenteTexto}>
                      Este cadastro ainda não virou conta no app. Ele pode ter plano e horário fixo,
                      mas só entra como aluno ativo depois de criar a senha.
                    </Text>
                  </View>
                </View>
                <Text style={s.editAviso}>
                  Para aluno que já saiu do estúdio, depois que ele estiver ativo use Inativo/desligado.
                  Essa opção remove os horários fixos e cancela as aulas futuras sem excluir o cadastro.
                </Text>
              </>
            ) : (
              <>
                <View style={s.editChips}>
                  <Pressable style={[s.editChip, form.ativo && s.editChipAtivo]} onPress={() => setForm((f) => ({ ...f, ativo: true }))}>
                    <View style={[s.editDot, { backgroundColor: form.ativo ? LC.success : LC.textMuted }]} />
                    <Text style={[s.editChipText, form.ativo && { color: LC.successFg, fontWeight: '700' }]}>Ativo</Text>
                  </Pressable>
                  <Pressable style={[s.editChip, !form.ativo && s.editChipInativo]} onPress={() => setForm((f) => ({ ...f, ativo: false }))}>
                    <View style={[s.editDot, { backgroundColor: !form.ativo ? LC.danger : LC.textMuted }]} />
                    <Text style={[s.editChipText, !form.ativo && { color: LC.dangerFg, fontWeight: '700' }]}>Inativo/desligado</Text>
                  </Pressable>
                </View>
                {!form.ativo ? (
                  <Text style={s.editAviso}>
                    Inativo/desligado não entra no app nem agenda aulas. Ao salvar, ele sai dos horários
                    fixos e as aulas futuras dele são canceladas — as vagas voltam para as turmas. Se
                    ele voltar, é preciso cadastrar os horários de novo.
                  </Text>
                ) : null}
              </>
            )}

          </View>
        </ScrollView>
        {/*
          O erro fica FORA da rolagem, colado no botão.
          Dentro do formulário ele nascia embaixo do último campo, fora da
          área visível: a dona apertava "Salvar", nada acontecia na tela e o
          motivo estava escondido abaixo da dobra. Aqui ela lê antes de
          apertar de novo.
        */}
        {erroEdicao ? <Text style={[s.erro, s.erroFixo]}>{erroEdicao}</Text> : null}
        <View style={s.modalActions}>
          <Button title="Cancelar" variant="outline" onPress={() => setEditando(null)} style={{ flex: 1 }} />
          <Button title="Salvar" loading={atualizar.isPending} onPress={salvarEdicao} style={{ flex: 1 }} />
        </View>
      </AppModal>

      {/* Modal: créditos do aluno */}
      <CreditosAlunoModal aluno={creditosAluno} onClose={() => setCreditosAluno(null)} />

      {/* Modal: plano e horário fixo do aluno */}
      <HorariosFixosAlunoModal aluno={planoHorarioAluno} onClose={() => setPlanoHorarioAluno(null)} />

      {/*
        Excluir de vez. O texto diz exatamente o que some e o que fica: sem
        isso a escolha entre "desativar" e "excluir" seria um chute, e só uma
        delas tem volta.

        Agora que o botão aparece em qualquer aluno, o aviso carrega o peso
        que antes estava em esconder a opção: quem ainda está ATIVO leva uma
        primeira linha dizendo isso, porque é o caso em que o toque errado
        custa caro — alguém que treina amanhã.
      */}
      <ConfirmModal
        visible={!!excluindo}
        title="Excluir definitivamente?"
        message={
          excluindo
            ? (excluindo.ativo
                ? `Atenção: ${nomeCurto(excluindo.nome)} ainda está em atividade — o cadastro está ` +
                  `ATIVO e pode ter aulas marcadas.\n\n`
                : '') +
              `${excluindo.nome} vai sair da lista para sempre. Somem os dados pessoais (contato, ` +
              `documento), os treinos e os créditos. As aulas e os pagamentos ficam no histórico do ` +
              `estúdio, sem o nome. NÃO TEM VOLTA.\n\nSe ele pode voltar a treinar um dia, use ` +
              `"Inativo/desligado" no cadastro em vez disto.`
            : ''
        }
        confirmLabel="Excluir para sempre"
        destructive
        loading={excluirDefinitivo.isPending}
        onConfirm={() => {
          if (!excluindo) return;
          excluirDefinitivo.mutate(excluindo.id, {
            onSuccess: (r: any) => {
              setExcluindo(null);
              setAviso({ titulo: 'Aluno excluído', texto: r?.mensagem ?? 'Cadastro removido.' });
            },
            onError: (e) => {
              setExcluindo(null);
              setAviso({
                titulo: 'Não foi possível excluir',
                texto: e instanceof ApiError ? e.message : 'Tente de novo.',
              });
            },
          });
        }}
        onCancel={() => setExcluindo(null)}
      />

      <InfoModal
        visible={!!aviso}
        title={aviso?.titulo ?? ''}
        message={aviso?.texto ?? ''}
        onClose={() => setAviso(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  professoresBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.primaryLight,
  },
  professoresBtnPress: { opacity: 0.75 },
  professoresTexto: { fontSize: 12.5, fontWeight: '700', color: LC.primary },
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
  chaveMatricula: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 5,
    paddingVertical: 4, paddingHorizontal: 9,
    borderRadius: 999, borderWidth: 1,
  },
  chaveTreina: { backgroundColor: LC.successBg, borderColor: LC.success },
  chaveParou: { backgroundColor: LC.dangerBg, borderColor: LC.danger },
  chaveTexto: { fontSize: 12, fontWeight: '700' },
  chaveLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  credLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  /** Separado do resto por uma linha: o que não tem volta não fica colado no que tem. */
  credLinkPerigo: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: LC.border },
  credLinkText: { fontSize: 13, fontWeight: '600', color: LC.primary },
  fab: {
    position: 'absolute', right: 20, bottom: 92, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center', ...LC.shadowStrong,
  },
  modalHint: { fontSize: 13, color: LC.textSecondary, marginBottom: 10 },
  linkBox: { backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border, borderRadius: LC.radius.md, padding: 12, marginBottom: 16 },
  linkText: { fontSize: 13, color: LC.textPrimary },
  whatsBtn: { marginBottom: 10 },
  semTelefone: { fontSize: 12.5, color: LC.textMuted, lineHeight: 18, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10 },
  editScroll: { maxHeight: 440, marginBottom: 18 },
  editForm: { gap: 14 },
  editLabel: { fontSize: 12, fontWeight: '700', color: LC.textSecondary, marginBottom: -6 },
  editChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border,
  },
  editChipAtivo: { backgroundColor: LC.successBg, borderColor: LC.success },
  editChipInativo: { backgroundColor: LC.dangerBg, borderColor: LC.danger },
  editDot: { width: 8, height: 8, borderRadius: 4 },
  editChipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  editAviso: { fontSize: 12, color: LC.textMuted, marginTop: -4, lineHeight: 17 },
  statusPendenteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 12, backgroundColor: LC.warningBg,
    borderWidth: 1, borderColor: LC.warning,
  },
  statusPendenteTitulo: { fontSize: 13, fontWeight: '800', color: LC.warningFg },
  statusPendenteTexto: { fontSize: 12, color: LC.warningFg, marginTop: 3, lineHeight: 17 },
  erro: { fontSize: 13, color: LC.danger },
  erroFixo: {
    backgroundColor: LC.dangerBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    lineHeight: 18,
  },

  // ── Tabela desktop ──────────────────────────────────────────────
  tabela: { overflow: 'hidden' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LC.border },
  tHead: { backgroundColor: LC.bg, paddingVertical: 12 },
  tHeadText: { fontSize: 12, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tCol: { paddingHorizontal: 4 },
  tColNome: { flex: 3 },
  tColEmail: { flex: 3 },
  tColPlano: { flex: 2 },
  tColStatus: { flex: 1.5 },
  tStatusWrap: { alignItems: 'flex-start', gap: 4 },
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
