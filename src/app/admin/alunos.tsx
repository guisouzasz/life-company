import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Avatar } from '../../components/ui/avatar';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { AppModal, ConfirmModal, InfoModal } from '../../components/ui/modal';
import { CreditosAlunoModal } from '../../components/admin/creditos-aluno-modal';
import { HorariosFixosAlunoModal } from '../../components/admin/horarios-fixos-aluno-modal';
import { AlunoPainel, resumoDoPlano } from '../../components/admin/aluno-painel';
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

type Filtro = 'todos' | 'treinando' | 'pararam' | 'semAcesso';

/**
 * Os recortes que a dona usa para achar gente.
 *
 * "Sem acesso ao app" é o que mais importa dos quatro: é a lista de quem
 * ainda precisa receber o link. Antes essa informação existia (um selo no
 * canto do cartão), mas para achar essas pessoas era preciso rolar a lista
 * inteira caçando o selo.
 */
const FILTROS: { chave: Filtro; rotulo: string; passa: (a: AlunoAdmin) => boolean }[] = [
  { chave: 'todos', rotulo: 'Todos', passa: () => true },
  { chave: 'treinando', rotulo: 'Treinando', passa: (a) => a.ativo },
  { chave: 'pararam', rotulo: 'Pararam', passa: (a) => !a.ativo },
  { chave: 'semAcesso', rotulo: 'Sem acesso ao app', passa: (a) => !a.ativado },
];

/** "Álvaro" e "alvaro" ficam juntos na letra A. */
const letraDe = (nome: string) =>
  (nome.trim()[0] ?? '#').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/**
 * A lista em blocos por letra, como uma agenda de telefone.
 *
 * A ordem vem do navegador e não do banco: o banco ordena pela collation do
 * servidor, que pode jogar "Álvaro" depois do Z. Aqui acento não conta.
 *
 * E ordena pelo nome QUE APARECE, não pelo completo. Pelo completo, os três
 * Carlos saíam "Carlos Nunes, Carlos Rocha, Carlos Ferreira" (ALBERTO,
 * EDUARDO, MAGNO) — em ordem, mas parecendo bagunça para quem só vê o curto.
 */
function porLetra(alunos: AlunoAdmin[]): { letra: string; alunos: AlunoAdmin[] }[] {
  const comparar = (x: string, y: string) => x.localeCompare(y, 'pt-BR', { sensitivity: 'base' });
  const ordenados = [...alunos].sort(
    (a, b) => comparar(nomeCurto(a.nome), nomeCurto(b.nome)) || comparar(a.nome, b.nome),
  );
  const grupos: { letra: string; alunos: AlunoAdmin[] }[] = [];
  for (const a of ordenados) {
    const letra = letraDe(a.nome);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.letra === letra) ultimo.alunos.push(a);
    else grupos.push({ letra, alunos: [a] });
  }
  return grupos;
}

/** Os selos da linha: só aparecem quando dizem algo que foge do normal. */
function Selos({ aluno }: { aluno: AlunoAdmin }) {
  return (
    <>
      {!aluno.ativo ? (
        <View style={[s.selo, s.seloParou]}>
          <Text style={[s.seloTexto, { color: LC.textSecondary }]}>Parou</Text>
        </View>
      ) : null}
      {!aluno.ativado ? (
        <View style={[s.selo, s.seloAcesso]}>
          <Text style={[s.seloTexto, { color: LC.warningFg }]}>Sem acesso</Text>
        </View>
      ) : null}
    </>
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
  /** O aluno com o painel aberto. Guardado por id para o painel ver a mudança na hora. */
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');

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
                  : 'Saiu das turmas e não entra mais no app.\n\n') +
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
  /**
   * O servidor marca o link de quem já tem senha (`redefinir=1`), e é daí que
   * sai o texto certo: "criei o seu acesso" para quem só perdeu a senha seria
   * mentira, e deixa o aluno achando que o cadastro dele sumiu.
   */
  const linkDeTroca = !!link && link.includes('redefinir=1');
  const numeroWhatsapp = telefoneParaWhatsapp(alunoDoLink?.telefone);
  const podeMandarWhatsapp = !!link && link.startsWith('http') && !!numeroWhatsapp && !!alunoDoLink;
  const enviarWhatsapp = async () => {
    if (!podeMandarWhatsapp || !link || !numeroWhatsapp || !alunoDoLink) return;
    const texto = mensagemPrimeiroAcesso({ nome: alunoDoLink.nome, link, novaSenha: linkDeTroca });
    await openBrowserAsync(linkWhatsapp(numeroWhatsapp, texto)).catch(() => {});
  };

  const copiar = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopiado(true);
  };

  const todos = alunos.data ?? [];
  const contagem = (f: Filtro) => todos.filter(FILTROS.find((x) => x.chave === f)!.passa).length;
  const visiveis = todos.filter(FILTROS.find((x) => x.chave === filtro)!.passa);
  const aberto = abertoId ? todos.find((a) => a.id === abertoId) ?? null : null;
  const treinando = contagem('treinando');

  /** Ação do painel que abre outra tela: o painel fecha antes, para não empilhar. */
  const agir = (fn: (a: AlunoAdmin) => void) => (a: AlunoAdmin) => {
    setAbertoId(null);
    fn(a);
  };
  const abrirTreinos = (a: AlunoAdmin) =>
    router.push({ pathname: '/admin/treinos-aluno' as any, params: { id: a.id, nome: a.nome } });
  const chamarNoWhatsapp = async (a: AlunoAdmin) => {
    const numero = telefoneParaWhatsapp(a.telefone);
    if (numero) await openBrowserAsync(`https://wa.me/${numero}`).catch(() => {});
  };

  const vazio = (
    <EmptyState
      icon="people-outline"
      title={
        busca ? 'Ninguém encontrado'
        : filtro === 'semAcesso' ? 'Todo mundo já entrou no app'
        : filtro === 'pararam' ? 'Ninguém parou de treinar'
        : 'Nenhum aluno ainda'
      }
      description={busca ? 'Confira o nome, o CPF ou o e-mail.' : filtro === 'todos' ? 'Cadastre o primeiro aluno.' : ''}
    />
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Alunos</Text>
            <Text style={s.subtitle}>
              {todos.length} {todos.length === 1 ? 'cadastrado' : 'cadastrados'}
              {todos.length ? ` · ${treinando} treinando` : ''}
            </Text>
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

      {/* Os recortes, com a conta de cada um. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filtrosScroll}
        contentContainerStyle={s.filtros}
      >
        {FILTROS.map((f) => {
          const ativo = filtro === f.chave;
          const n = contagem(f.chave);
          const alerta = f.chave === 'semAcesso' && n > 0;
          return (
            <Pressable
              key={f.chave}
              style={[s.filtro, ativo && s.filtroAtivo, !ativo && alerta && s.filtroAlerta]}
              onPress={() => setFiltro(f.chave)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
            >
              <Text style={[s.filtroTexto, ativo && s.filtroTextoAtivo, !ativo && alerta && { color: LC.warningFg }]}>
                {f.rotulo}
              </Text>
              <View style={[s.filtroConta, ativo && s.filtroContaAtiva, !ativo && alerta && s.filtroContaAlerta]}>
                <Text style={[s.filtroContaTexto, ativo && { color: LC.primary }, !ativo && alerta && { color: '#fff' }]}>
                  {n}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {alunos.isLoading ? (
        <Loading />
      ) : alunos.isError ? (
        <ErrorState onRetry={() => alunos.refetch()} />
      ) : isDesktop ? (
        /*
          Computador: uma linha por aluno, com o que se procura de olho — a
          modalidade, o contato e a situação. As ações moram no painel, que
          abre na linha inteira: antes eram cinco botões espremidos em cada
          linha, quebrando em três andares.
        */
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {visiveis.length > 0 ? (
            <Card style={s.tabela} padding={0}>
              <View style={[s.tRow, s.tHead]}>
                <Text style={[s.tCol, s.tColNome, s.tHeadText]}>Aluno</Text>
                <Text style={[s.tCol, s.tColPlano, s.tHeadText]}>Modalidade e plano</Text>
                <Text style={[s.tCol, s.tColContato, s.tHeadText]}>Contato</Text>
                <Text style={[s.tCol, s.tColStatus, s.tHeadText]}>Situação</Text>
                <View style={s.tColSeta} />
              </View>
              {porLetra(visiveis).flatMap((g) => g.alunos).map((aluno) => {
                const plano = resumoDoPlano(aluno);
                return (
                  <Pressable
                    key={aluno.id}
                    style={({ pressed, hovered }: any) => [s.tRow, (hovered || pressed) && s.tRowHover]}
                    onPress={() => setAbertoId(aluno.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${aluno.nome}`}
                  >
                    <View style={[s.tCol, s.tColNome, s.tNomeWrap]}>
                      <View>
                        <Avatar nome={aluno.nome} size={36} />
                        <View style={[s.ponto, { backgroundColor: aluno.ativo ? LC.success : LC.textMuted }]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tNome} numberOfLines={1}>{nomeCurto(aluno.nome)}</Text>
                        <Text style={s.tCpf}>CPF {mascaraCpf(aluno.cpf)}</Text>
                      </View>
                    </View>
                    <Text style={[s.tCol, s.tColPlano, s.tTexto, !plano && { color: LC.warningFg }]} numberOfLines={1}>
                      {plano ?? 'Sem plano'}
                    </Text>
                    <Text style={[s.tCol, s.tColContato, s.tTexto]} numberOfLines={1}>
                      {aluno.telefone ? mascaraTelefone(aluno.telefone) : aluno.email ?? '—'}
                    </Text>
                    <View style={[s.tCol, s.tColStatus, s.tSelos]}>
                      {aluno.ativo && aluno.ativado ? (
                        <Text style={[s.tTexto, { color: LC.successFg, fontWeight: '700' }]}>Treina</Text>
                      ) : (
                        <Selos aluno={aluno} />
                      )}
                    </View>
                    <View style={s.tColSeta}>
                      <Icon name="chevron-forward" size={18} color={LC.textMuted} />
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          ) : vazio}
          <View style={{ height: 24 }} />
        </ScrollView>
      ) : (
        /*
          Celular: a lista serve para ACHAR a pessoa. Uma linha por aluno,
          separada por letra; tocar abre o painel com tudo que dá para fazer.
          Antes um aluno ocupava a tela inteira — 28 alunos eram quase
          dezesseis telas de rolagem.
        */
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {visiveis.length > 0 ? (
            porLetra(visiveis).map((g) => (
              <View key={g.letra}>
                <Text style={s.letra}>{g.letra}</Text>
                <Card style={s.grupo} padding={0}>
                  {g.alunos.map((aluno, i) => {
                    const plano = resumoDoPlano(aluno);
                    return (
                      <Pressable
                        key={aluno.id}
                        style={({ pressed }) => [s.linha, i > 0 && s.linhaDivisa, pressed && s.linhaApertada]}
                        onPress={() => setAbertoId(aluno.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir ${aluno.nome}`}
                      >
                        <View>
                          <Avatar nome={aluno.nome} size={42} />
                          <View style={[s.ponto, { backgroundColor: aluno.ativo ? LC.success : LC.textMuted }]} />
                        </View>
                        <View style={s.linhaInfo}>
                          <Text style={[s.linhaNome, !aluno.ativo && { color: LC.textSecondary }]} numberOfLines={1}>
                            {nomeCurto(aluno.nome)}
                          </Text>
                          <Text style={[s.linhaPlano, !plano && { color: LC.warningFg }]} numberOfLines={1}>
                            {plano ?? 'Sem plano'}
                          </Text>
                        </View>
                        <View style={s.linhaSelos}>
                          <Selos aluno={aluno} />
                        </View>
                        <Icon name="chevron-forward" size={18} color={LC.textMuted} />
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            ))
          ) : vazio}
          <View style={{ height: 96 }} />
        </ScrollView>
      )}

      {!isDesktop ? (
        <Pressable
          style={s.fab}
          onPress={() => router.push('/admin/novo-aluno')}
          accessibilityRole="button"
          accessibilityLabel="Cadastrar aluno novo"
        >
          <Icon name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}

      <AlunoPainel
        aluno={aberto}
        onClose={() => {
          setAbertoId(null);
          setAviso(null); // o recado já foi lido lá dentro; não reaparece por cima da lista
        }}
        recado={aviso}
        onFecharRecado={() => setAviso(null)}
        mudandoMatricula={!!aberto && mudandoMatricula === aberto.id}
        gerandoLink={!!aberto && gerarLink.isPending && gerarLink.variables === aberto.id}
        onAlternarMatricula={alternarMatricula}
        onEditar={agir(abrirEdicao)}
        onPlano={agir(setPlanoHorarioAluno)}
        onTreinos={agir(abrirTreinos)}
        onCreditos={agir(setCreditosAluno)}
        onLink={agir(gerar)}
        onWhatsapp={chamarNoWhatsapp}
        onExcluir={agir(setExcluindo)}
      />

      <TabBar isAdmin />

      {/* Modal: link de primeiro acesso */}
      <AppModal
        visible={!!link}
        onClose={() => { setLink(null); setAlunoDoLink(null); }}
        title={linkDeTroca ? 'Link para nova senha' : 'Link de primeiro acesso'}
      >
        <Text style={s.modalHint}>
          {linkDeTroca
            ? 'Já tem conta no app. Com este link cria uma senha nova, e a antiga para de valer:'
            : 'Ainda não entrou no app. Com este link cria a senha e completa o cadastro:'}
        </Text>
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

      {/* Com o painel aberto o recado aparece DENTRO dele — por cima, ficaria atrás. */}
      <InfoModal
        visible={!!aviso && !aberto}
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
  // ── Recortes ────────────────────────────────────────────────
  /* O ScrollView cresce e ENCOLHE por padrão; sem travar os dois, a lista de
     baixo espremia esta faixa e os filtros apareciam cortados ao meio. */
  filtrosScroll: { flexGrow: 0, flexShrink: 0 },
  filtros: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filtro: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingLeft: 13, paddingRight: 6, paddingVertical: 6, borderRadius: LC.radius.full,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
  },
  filtroAtivo: { backgroundColor: LC.primary, borderColor: LC.primary },
  /* "Sem acesso" com gente dentro chama atenção mesmo sem estar escolhido. */
  filtroAlerta: { borderColor: '#FCD34D', backgroundColor: LC.warningBg },
  filtroTexto: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
  filtroTextoAtivo: { color: '#fff' },
  filtroConta: {
    minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: 11,
    backgroundColor: LC.neutralBg, alignItems: 'center', justifyContent: 'center',
  },
  filtroContaAtiva: { backgroundColor: '#fff' },
  filtroContaAlerta: { backgroundColor: LC.warning },
  filtroContaTexto: { fontSize: 12, fontWeight: '800', color: LC.textSecondary },

  // ── Lista do celular ────────────────────────────────────────────
  letra: {
    fontSize: 12, fontWeight: '800', color: LC.primary, letterSpacing: 0.8,
    marginTop: 10, marginBottom: 6, marginLeft: 6,
  },
  grupo: { overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  linhaDivisa: { borderTopWidth: 1, borderTopColor: LC.border },
  linhaApertada: { backgroundColor: LC.neutralBg },
  linhaInfo: { flex: 1, minWidth: 0 },
  linhaNome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  linhaPlano: { fontSize: 12.5, color: LC.textSecondary, marginTop: 2 },
  linhaSelos: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  /* O ponto no avatar: verde treina, cinza parou. Lê-se sem ler nada. */
  ponto: {
    position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7,
    borderWidth: 2.5, borderColor: LC.bgCard,
  },
  selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: LC.radius.full },
  seloParou: { backgroundColor: LC.neutralBg },
  seloAcesso: { backgroundColor: LC.warningBg },
  seloTexto: { fontSize: 11, fontWeight: '800' },
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
  tRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: LC.border, cursor: 'pointer' as any,
  },
  tRowHover: { backgroundColor: LC.primaryLight },
  tHead: { backgroundColor: LC.bg, paddingVertical: 12, cursor: 'auto' as any },
  tHeadText: { fontSize: 12, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tCol: { paddingHorizontal: 6 },
  tColNome: { flex: 3 },
  tColPlano: { flex: 2.4 },
  tColContato: { flex: 2.2 },
  tColStatus: { flex: 1.8 },
  tColSeta: { width: 28, alignItems: 'flex-end' },
  tSelos: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tNomeWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  tCpf: { fontSize: 11.5, color: LC.textMuted, marginTop: 1 },
  tTexto: { fontSize: 13, color: LC.textSecondary },
});
