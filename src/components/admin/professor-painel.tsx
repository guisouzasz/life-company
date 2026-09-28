import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { openBrowserAsync } from 'expo-web-browser';
import { LC } from '../../constants/theme';
import { corPorModalidade, iconePorModalidade, juntarNomes, modalidadesDe, nomeModalidade } from '../../constants/assets';
import { Avatar } from '../ui/avatar';
import { Icon, type IconName } from '../ui/icon';
import { Input } from '../ui/input';
import { nomeCurto } from '../../services/nome';
import {
  dataParaIso, isoParaData, mascaraCpf, mascaraData, mascaraTelefone, soDigitos,
} from '../../services/mascaras';
import { linkWhatsapp, mensagemPrimeiroAcesso, telefoneParaWhatsapp } from '../../services/whatsapp';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import {
  useAtualizarAluno, useDefinirSenha, useExcluirProfessor, useGerarLink,
} from '../../services/usuarios/usuarios.mutations';
import { ApiError } from '../../services/http';
import type { ProfessorAdmin } from '../../services/usuarios/usuarios.admin.types';

/**
 * Tudo o que a dona faz com UM professor, num painel só.
 *
 * Mesmo desenho do painel de alunos: a lista serve para achar, o painel para
 * agir. Cada ação troca o CONTEÚDO do painel (editar, modalidades, senha,
 * link, excluir) em vez de abrir outra janela por cima — no navegador a
 * janela de cima aparecia ATRÁS do painel, e a dona tocava sem ver nada.
 */

type Tela = 'inicio' | 'editar' | 'modalidades' | 'senha' | 'link' | 'excluir';

/** As mesmas regras que a tela de primeiro acesso mostra ao usuário. */
const REGRAS = [
  { label: 'Mínimo de 6 caracteres', test: (v: string) => v.length >= 6 },
  { label: 'Pelo menos uma maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Pelo menos um número', test: (v: string) => /\d/.test(v) },
];

interface Props {
  professor: ProfessorAdmin | null;
  /** A equipe toda: é dela que sai quem pode receber as fichas na exclusão. */
  equipe: ProfessorAdmin[];
  onClose: () => void;
  /** Depois de excluir: o painel fecha e a tela mostra o que aconteceu. */
  onExcluido: (mensagem: string) => void;
}

export function ProfessorPainel({ professor, equipe, onClose, onExcluido }: Props) {
  const isDesktop = useIsDesktop();
  const modalidades = useModalidades();
  const atualizar = useAtualizarAluno();
  const definirSenha = useDefinirSenha();
  const gerarLink = useGerarLink();
  const excluir = useExcluirProfessor();

  const [tela, setTela] = useState<Tela>('inicio');
  const [recado, setRecado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoDesligar, setConfirmandoDesligar] = useState(false);

  // Formulários
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [mods, setMods] = useState<string[]>([]);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  /** Quem passa a assinar as fichas; '' = ficam como estão. */
  const [fichasPara, setFichasPara] = useState('');

  // Outro professor aberto (ou painel fechado) começa do início.
  useEffect(() => {
    setTela('inicio');
    setRecado(null);
    setErro(null);
    setConfirmandoDesligar(false);
    setLink(null);
  }, [professor?.id]);

  if (!professor) return null;
  const p = professor;
  const minhas = modalidadesDe(p);
  const colegas = equipe.filter((o) => o.id !== p.id && o.ativo);

  const ir = (t: Tela) => {
    setErro(null);
    setRecado(null);
    setConfirmandoDesligar(false);
    if (t === 'editar') {
      setNome(p.nome);
      setCpf(mascaraCpf(p.cpf));
      setEmail(p.email ?? '');
      setTelefone(p.telefone ? mascaraTelefone(p.telefone) : '');
      setNascimento(isoParaData(p.dataNascimento));
    }
    if (t === 'modalidades') setMods(minhas.map((m) => m.id));
    if (t === 'senha') {
      setSenha('');
      setConfirmarSenha('');
    }
    if (t === 'excluir') {
      // Sugere quem já é da mesma modalidade: é quem vai atender esses alunos.
      const parecido = colegas.find((c) => modalidadesDe(c).some((m) => minhas.some((x) => x.id === m.id)));
      setFichasPara((p.fichas ?? 0) > 0 ? (parecido ?? colegas[0])?.id ?? '' : '');
    }
    setTela(t);
  };

  const voltar = (texto?: string) => {
    setTela('inicio');
    setErro(null);
    setRecado(texto ?? null);
  };

  const falhou = (e: unknown, padrao: string) => setErro(e instanceof ApiError ? e.message : padrao);

  // ── Ações ──────────────────────────────────────────────────────────
  const salvarDados = () => {
    if (nome.trim().length < 3) return setErro('Escreva o nome completo.');
    if (soDigitos(cpf).length !== 11) return setErro('O CPF precisa de 11 dígitos.');
    let nascimentoIso = '';
    if (nascimento.trim()) {
      nascimentoIso = dataParaIso(nascimento) ?? '';
      if (!nascimentoIso) return setErro('Data de nascimento inválida — confira o dia, o mês e o ano.');
    }
    atualizar.mutate(
      {
        id: p.id,
        payload: {
          nome: nome.trim(),
          cpf: soDigitos(cpf),
          // Vazio limpa o campo — é assim que se tira um dado errado.
          email: email.trim(),
          telefone: soDigitos(telefone),
          dataNascimento: nascimentoIso,
        },
      },
      {
        onSuccess: () =>
          voltar(
            nascimentoIso
              ? 'Dados salvos. O aniversário já entra no card do painel.'
              : 'Dados salvos.',
          ),
        onError: (e) => falhou(e, 'Não foi possível salvar os dados.'),
      },
    );
  };

  const salvarModalidades = () => {
    if (mods.length === 0) return setErro('Marque pelo menos uma modalidade.');
    atualizar.mutate(
      { id: p.id, payload: { modalidadeIds: mods } },
      {
        onSuccess: () => {
          const nomes = juntarNomes(
            mods.map((id) => (modalidades.data ?? []).find((m) => m.id === id)).filter(Boolean) as { nome: string }[],
          );
          voltar(`${nomeCurto(p.nome)} agora vê a agenda e os treinos de ${nomes}.`);
        },
        onError: (e) => falhou(e, 'Não foi possível salvar as modalidades.'),
      },
    );
  };

  const salvarSenha = () => {
    if (!REGRAS.every((r) => r.test(senha))) return setErro('A senha não cumpre os requisitos abaixo.');
    if (senha !== confirmarSenha) return setErro('As senhas não conferem.');
    definirSenha.mutate(
      { id: p.id, senha },
      {
        onSuccess: () => {
          // O acesso é pelo e-mail quando existe; senão, pelo CPF.
          const login = p.email || mascaraCpf(p.cpf);
          voltar(`Senha definida. ${nomeCurto(p.nome)} entra com ${login} e a senha que você acabou de criar.`);
        },
        onError: (e) => falhou(e, 'Não foi possível definir a senha.'),
      },
    );
  };

  const abrirLink = () => {
    ir('link');
    setLink(null);
    setCopiado(false);
    gerarLink.mutate(p.id, {
      onSuccess: (r) => setLink(r.link),
      onError: (e) => falhou(e, 'Não foi possível gerar o link.'),
    });
  };

  const alternarAtivo = () => {
    setConfirmandoDesligar(false);
    atualizar.mutate(
      { id: p.id, payload: { ativo: !p.ativo } },
      {
        onSuccess: () =>
          setRecado(
            p.ativo
              ? `${nomeCurto(p.nome)} não entra mais no sistema. As fichas continuam com os alunos.`
              : `${nomeCurto(p.nome)} volta a entrar com a senha de sempre.`,
          ),
        onError: (e) => falhou(e, 'Não foi possível atualizar.'),
      },
    );
  };

  const confirmarExclusao = () => {
    excluir.mutate(
      { id: p.id, fichasPara: fichasPara || undefined },
      {
        onSuccess: (r) => onExcluido(r.mensagem),
        onError: (e) => falhou(e, 'Não foi possível excluir.'),
      },
    );
  };

  // ── Pedaços da tela ────────────────────────────────────────────────
  const zap = telefoneParaWhatsapp(p.telefone);
  const linkDeTroca = !!link && link.includes('redefinir=1');

  const blocos: { chave: string; icone: IconName; titulo: string; sub: string; cor: string; fundo: string; onPress: () => void }[] = [
    {
      chave: 'editar', icone: 'create-outline', titulo: 'Editar dados', sub: 'Contato e aniversário',
      cor: LC.primary, fundo: LC.primaryLight, onPress: () => ir('editar'),
    },
    {
      chave: 'modalidades', icone: 'layers-outline', titulo: 'Modalidades',
      sub: minhas.length > 0 ? juntarNomes(minhas) : 'Nenhuma definida',
      cor: '#EA580C', fundo: '#FFEDD5', onPress: () => ir('modalidades'),
    },
    {
      chave: 'senha', icone: 'lock-closed-outline', titulo: p.ativado ? 'Trocar senha' : 'Definir senha',
      sub: 'Você escolhe a senha', cor: '#7C3AED', fundo: '#EDE9FE', onPress: () => ir('senha'),
    },
    {
      chave: 'link', icone: 'key-outline', titulo: 'Link de acesso',
      sub: p.ativado ? 'Para criar senha nova' : 'Para criar a senha',
      cor: '#0F766E', fundo: '#CCFBF1', onPress: abrirLink,
    },
  ];
  if (zap) {
    blocos.push({
      chave: 'whats', icone: 'logo-whatsapp', titulo: 'WhatsApp', sub: 'Chamar numa conversa',
      cor: '#15803D', fundo: '#DCFCE7',
      onPress: () => openBrowserAsync(`https://wa.me/${zap}`).catch(() => {}),
    });
  }

  const dados: { icone: IconName; texto: string }[] = [];
  if (p.telefone) dados.push({ icone: 'call-outline', texto: mascaraTelefone(p.telefone) });
  dados.push({ icone: 'mail-outline', texto: p.email || 'Sem e-mail — entra pelo CPF' });
  dados.push({ icone: 'card-outline', texto: `CPF ${mascaraCpf(p.cpf)}` });
  dados.push({
    icone: 'gift-outline',
    texto: p.dataNascimento ? `Nasceu em ${isoParaData(p.dataNascimento)}` : 'Sem data de nascimento — o aniversário não aparece no painel',
  });
  dados.push({
    icone: 'barbell-outline',
    texto: (p.fichas ?? 0) === 1 ? 'Assina 1 ficha de treino em uso' : `Assina ${p.fichas ?? 0} fichas de treino em uso`,
  });

  const cabecalhoDaTela = (titulo: string) => (
    <View style={s.subTopo}>
      <Pressable onPress={() => voltar()} hitSlop={10} style={s.voltar} accessibilityRole="button" accessibilityLabel="Voltar">
        <Icon name="arrow-back" size={18} color={LC.textPrimary} />
      </Pressable>
      <Text style={s.subTitulo}>{titulo}</Text>
    </View>
  );

  const botoes = (rotulo: string, onPress: () => void, carregando: boolean, perigo = false) => (
    <View style={s.botoes}>
      <Pressable style={[s.botao, s.botaoVoltar]} onPress={() => voltar()} accessibilityRole="button">
        <Text style={[s.botaoTexto, { color: LC.textPrimary }]}>Voltar</Text>
      </Pressable>
      <Pressable
        style={[s.botao, perigo ? s.botaoPerigo : s.botaoOk, carregando && { opacity: 0.6 }]}
        onPress={onPress}
        disabled={carregando}
        accessibilityRole="button"
      >
        <Text style={[s.botaoTexto, { color: '#fff' }]}>{carregando ? 'Aguarde…' : rotulo}</Text>
      </Pressable>
    </View>
  );

  const aviso = erro ? (
    <View style={s.erro} accessibilityRole="alert">
      <Icon name="alert-circle" size={16} color={LC.dangerFg} />
      <Text style={s.erroTexto}>{erro}</Text>
    </View>
  ) : null;

  let conteudo: React.ReactNode;
  if (tela === 'editar') {
    conteudo = (
      <>
        {cabecalhoDaTela('Editar dados')}
        <View style={s.campos}>
          <Input label="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" />
          <Input label="CPF" value={cpf} onChangeText={(t) => setCpf(mascaraCpf(t))} keyboardType="numeric" />
          <Input
            label="E-mail"
            placeholder="sem e-mail, entra pelo CPF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input label="Telefone" placeholder="(00) 00000-0000" value={telefone} onChangeText={(t) => setTelefone(mascaraTelefone(t))} keyboardType="phone-pad" />
          <Input
            label="Data de nascimento"
            placeholder="DD/MM/AAAA"
            value={nascimento}
            onChangeText={(t) => setNascimento(mascaraData(t))}
            keyboardType="numeric"
          />
          <Text style={s.dica}>Com a data preenchida, o aniversário aparece no card do painel, igual ao dos alunos.</Text>
        </View>
        {aviso}
        {botoes('Salvar', salvarDados, atualizar.isPending)}
      </>
    );
  } else if (tela === 'modalidades') {
    conteudo = (
      <>
        {cabecalhoDaTela('Modalidades')}
        <Text style={s.texto}>
          Marque todas em que {nomeCurto(p.nome)} dá aula. A agenda e os treinos que aparecem são só
          os das modalidades marcadas.
        </Text>
        <View style={s.chips}>
          {(modalidades.data ?? []).map((m) => {
            const sel = mods.includes(m.id);
            const cor = corPorModalidade(m.nome);
            return (
              <Pressable
                key={m.id}
                style={[s.chip, sel && { backgroundColor: cor + '1A', borderColor: cor }]}
                onPress={() => setMods((a) => (sel ? a.filter((x) => x !== m.id) : [...a, m.id]))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={nomeModalidade(m.nome)}
              >
                <Icon name={sel ? 'checkmark-circle' : iconePorModalidade(m.nome)} size={16} color={sel ? cor : LC.textSecondary} />
                <Text style={[s.chipTexto, sel && { color: cor, fontWeight: '800' }]}>{nomeModalidade(m.nome)}</Text>
              </Pressable>
            );
          })}
        </View>
        {minhas.some((m) => !mods.includes(m.id)) && mods.length > 0 ? (
          <Text style={[s.dica, { color: LC.warningFg }]}>
            Ao tirar {juntarNomes(minhas.filter((m) => !mods.includes(m.id)))}, {nomeCurto(p.nome)} deixa de ver
            essa agenda e as fichas dessa modalidade. As fichas não somem — continuam com os alunos.
          </Text>
        ) : null}
        {aviso}
        {botoes('Salvar', salvarModalidades, atualizar.isPending)}
      </>
    );
  } else if (tela === 'senha') {
    conteudo = (
      <>
        {cabecalhoDaTela(p.ativado ? 'Trocar senha' : 'Definir senha')}
        <Text style={s.texto}>
          {p.ativado
            ? 'A senha antiga deixa de valer e as sessões abertas caem.'
            : 'Definindo aqui, a conta já fica pronta para usar.'}
        </Text>
        <View style={s.campos}>
          <Input label="Nova senha" placeholder="••••••••" value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" autoCorrect={false} />
          <Input label="Repita a senha" placeholder="••••••••" value={confirmarSenha} onChangeText={setConfirmarSenha} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        </View>
        <View style={s.regras}>
          {REGRAS.map((r) => {
            const ok = r.test(senha);
            return (
              <View key={r.label} style={s.regraLinha}>
                <Icon name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={ok ? LC.success : LC.textMuted} />
                <Text style={[s.regraTexto, ok && s.regraOk]}>{r.label}</Text>
              </View>
            );
          })}
        </View>
        {aviso}
        {botoes('Salvar senha', salvarSenha, definirSenha.isPending)}
      </>
    );
  } else if (tela === 'link') {
    conteudo = (
      <>
        {cabecalhoDaTela(linkDeTroca ? 'Link para nova senha' : 'Link de acesso')}
        <Text style={s.texto}>
          {linkDeTroca
            ? `${nomeCurto(p.nome)} já tem conta: pelo link cria uma senha nova, e a antiga deixa de valer.`
            : `Pelo link ${nomeCurto(p.nome)} confirma o CPF e cria a senha dele.`}
        </Text>
        {gerarLink.isPending ? <Text style={s.texto}>Gerando o link…</Text> : null}
        {link ? (
          <>
            <View style={s.linkCaixa}>
              <Text style={s.linkTexto} selectable numberOfLines={3}>{link}</Text>
            </View>
            <View style={s.botoes}>
              {zap ? (
                <Pressable
                  style={[s.botao, { backgroundColor: '#16A34A' }]}
                  onPress={() =>
                    openBrowserAsync(
                      linkWhatsapp(zap, mensagemPrimeiroAcesso({ nome: p.nome, link, professor: true, novaSenha: linkDeTroca })),
                    ).catch(() => {})
                  }
                  accessibilityRole="button"
                >
                  <Text style={[s.botaoTexto, { color: '#fff' }]}>Mandar no WhatsApp</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[s.botao, s.botaoOk]}
                onPress={async () => {
                  await Clipboard.setStringAsync(link);
                  setCopiado(true);
                }}
                accessibilityRole="button"
              >
                <Text style={[s.botaoTexto, { color: '#fff' }]}>{copiado ? 'Copiado!' : 'Copiar link'}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        {aviso}
      </>
    );
  } else if (tela === 'excluir') {
    const fichas = p.fichas ?? 0;
    conteudo = (
      <>
        {cabecalhoDaTela('Excluir professor')}
        <View style={s.pergunta}>
          <Text style={s.perguntaTitulo}>Excluir {nomeCurto(p.nome)} de vez?</Text>
          <Text style={s.perguntaTexto}>
            Nome, CPF, contato e senha são apagados e não dá para desfazer. As fichas de treino
            continuam com os alunos — ninguém perde treino nem histórico de carga.
            {p.ativo ? ' Se for só um afastamento, use "Desligado" em vez de excluir.' : ''}
          </Text>
        </View>
        {fichas > 0 ? (
          <>
            <Text style={s.secao}>
              {fichas === 1 ? `A ficha assinada por ${nomeCurto(p.nome)} passa para` : `As ${fichas} fichas assinadas por ${nomeCurto(p.nome)} passam para`}
            </Text>
            <View style={s.chips}>
              {colegas.map((c) => {
                const sel = fichasPara === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[s.chip, sel && s.chipSel]}
                    onPress={() => setFichasPara(c.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                  >
                    <Text style={[s.chipTexto, sel && s.chipTextoSel]}>
                      {nomeCurto(c.nome)}
                      {modalidadesDe(c).length ? ` · ${juntarNomes(modalidadesDe(c))}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[s.chip, fichasPara === '' && s.chipSel]}
                onPress={() => setFichasPara('')}
                accessibilityRole="radio"
                accessibilityState={{ checked: fichasPara === '' }}
              >
                <Text style={[s.chipTexto, fichasPara === '' && s.chipTextoSel]}>Não passar</Text>
              </Pressable>
            </View>
            {fichasPara === '' ? (
              <Text style={s.dica}>
                Sem passar, as fichas ficam sem nome de professor — os professores da mesma modalidade
                continuam abrindo e editando normalmente.
              </Text>
            ) : null}
          </>
        ) : null}
        {aviso}
        {botoes('Excluir de vez', confirmarExclusao, excluir.isPending, true)}
      </>
    );
  } else {
    conteudo = (
      <>
        {/* Ativo / desligado — só para quem já tem conta: sem senha, não há o
            que desligar, e definir a senha já liga a conta. */}
        {p.ativado ? (
          <View style={s.chave} accessibilityRole="radiogroup">
            {([true, false] as const).map((ativo) => {
              const marcado = p.ativo === ativo;
              return (
                <Pressable
                  key={String(ativo)}
                  style={[s.chaveLado, marcado && (ativo ? s.chaveAtivo : s.chaveDesligado)]}
                  disabled={marcado || atualizar.isPending}
                  onPress={() => (ativo ? alternarAtivo() : setConfirmandoDesligar(true))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: marcado }}
                  accessibilityLabel={ativo ? `${p.nome} dá aula aqui` : `Desligar ${p.nome}`}
                >
                  <Icon
                    name={ativo ? 'checkmark-circle' : 'pause-circle'}
                    size={17}
                    color={marcado ? (ativo ? LC.successFg : LC.textSecondary) : LC.textMuted}
                  />
                  <Text style={[s.chaveTexto, marcado && { color: ativo ? LC.successFg : LC.textPrimary }]}>
                    {ativo ? 'Dá aula aqui' : 'Desligado'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Pressable style={({ pressed }) => [s.convite, pressed && { opacity: 0.8 }]} onPress={abrirLink} accessibilityRole="button">
            <View style={s.conviteIcone}>
              <Icon name="phone-portrait-outline" size={18} color={LC.warningFg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.conviteTitulo}>Ainda não entrou no sistema</Text>
              <Text style={s.conviteTexto}>Toque para gerar o link de acesso, ou defina a senha em "Definir senha".</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={LC.warningFg} />
          </Pressable>
        )}

        {confirmandoDesligar ? (
          <View style={s.pergunta} accessibilityRole="alert">
            <Text style={s.perguntaTitulo}>Desligar {nomeCurto(p.nome)}?</Text>
            <Text style={s.perguntaTexto}>
              {nomeCurto(p.nome)} não consegue mais entrar no sistema. As fichas continuam com os alunos, e
              dá para religar quando quiser.
            </Text>
            <View style={s.botoes}>
              <Pressable style={[s.botao, s.botaoVoltar]} onPress={() => setConfirmandoDesligar(false)} accessibilityRole="button">
                <Text style={[s.botaoTexto, { color: LC.textPrimary }]}>Voltar</Text>
              </Pressable>
              <Pressable
                style={[s.botao, s.botaoPerigo]}
                onPress={alternarAtivo}
                accessibilityRole="button"
                accessibilityLabel={`Confirmar desligar ${p.nome}`}
              >
                <Text style={[s.botaoTexto, { color: '#fff' }]}>Desligar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {recado ? (
          <View style={s.recado} accessibilityRole="alert">
            <Icon name="checkmark-circle" size={18} color={LC.primary} />
            <Text style={[s.recadoTexto, { flex: 1 }]}>{recado}</Text>
            <Pressable onPress={() => setRecado(null)} hitSlop={10} accessibilityLabel="Fechar recado">
              <Icon name="close" size={16} color={LC.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        {aviso}

        <View style={s.grade}>
          {blocos.map((b) => (
            <Pressable
              key={b.chave}
              style={({ pressed }) => [s.bloco, pressed && s.blocoApertado]}
              onPress={b.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${b.titulo} de ${p.nome}`}
            >
              <View style={[s.blocoIcone, { backgroundColor: b.fundo }]}>
                <Icon name={b.icone} size={20} color={b.cor} />
              </View>
              <Text style={s.blocoTitulo}>{b.titulo}</Text>
              <Text style={s.blocoSub} numberOfLines={1}>{b.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.secao}>Cadastro</Text>
        <View style={s.dados}>
          {dados.map((d) => (
            <View key={d.texto} style={s.dadoLinha}>
              <Icon name={d.icone} size={15} color={LC.textMuted} />
              <Text style={s.dadoTexto} selectable>{d.texto}</Text>
            </View>
          ))}
        </View>

        {/* Separado de tudo: é a única ação daqui que não tem volta. */}
        <Pressable
          style={({ pressed }) => [s.excluir, pressed && { opacity: 0.6 }]}
          onPress={() => ir('excluir')}
          accessibilityRole="button"
          accessibilityLabel={`Excluir ${p.nome} definitivamente`}
        >
          <Icon name="trash-outline" size={15} color={LC.danger} />
          <Text style={s.excluirTexto}>Excluir professor</Text>
        </Pressable>
      </>
    );
  }

  return (
    <Modal visible transparent animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[s.fundo, isDesktop && s.fundoDesktop]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[s.folha, isDesktop && s.folhaDesktop]}>
          {isDesktop ? null : <View style={s.alca} />}

          <View style={s.topo}>
            <View>
              <Avatar nome={p.nome} size={56} />
              <View style={[s.ponto, { backgroundColor: p.ativo && p.ativado ? LC.success : LC.textMuted }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nome} numberOfLines={1}>{nomeCurto(p.nome)}</Text>
              {p.nome.trim().toLowerCase() !== nomeCurto(p.nome).toLowerCase() ? (
                <Text style={s.nomeCompleto} numberOfLines={1}>{p.nome}</Text>
              ) : null}
              <View style={s.modsLinha}>
                {minhas.length === 0 ? (
                  <Text style={[s.modTexto, { color: LC.danger }]}>Sem modalidade — não vê agenda nenhuma</Text>
                ) : (
                  minhas.map((m) => (
                    <View key={m.id} style={[s.mod, { backgroundColor: corPorModalidade(m.nome) + '1A' }]}>
                      <Icon name={iconePorModalidade(m.nome)} size={11} color={corPorModalidade(m.nome)} />
                      <Text style={[s.modTexto, { color: corPorModalidade(m.nome) }]}>{nomeModalidade(m.nome)}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={s.fechar} accessibilityLabel="Fechar">
              <Icon name="close" size={20} color={LC.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.corpo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {conteudo}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  fundoDesktop: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  folha: {
    backgroundColor: LC.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', paddingTop: 8,
  },
  folhaDesktop: { width: '100%', maxWidth: 540, borderRadius: 24, paddingTop: 18, maxHeight: '90%' },
  alca: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: LC.borderStrong, marginBottom: 10 },

  topo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 14 },
  ponto: {
    position: 'absolute', right: 1, bottom: 1, width: 15, height: 15, borderRadius: 8,
    borderWidth: 3, borderColor: LC.bg,
  },
  nome: { fontSize: 20, fontWeight: '800', color: LC.textPrimary },
  nomeCompleto: { fontSize: 11.5, color: LC.textMuted, marginTop: 1, letterSpacing: 0.2 },
  modsLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  mod: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  modTexto: { fontSize: 11.5, fontWeight: '700' },
  fechar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: LC.neutralBg,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
  },

  corpo: { paddingHorizontal: 20, paddingBottom: 28 },

  subTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  voltar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  subTitulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  texto: { fontSize: 13.5, color: LC.textSecondary, lineHeight: 19, marginBottom: 12 },
  dica: { fontSize: 12, color: LC.textMuted, lineHeight: 17, marginTop: 8 },
  campos: { gap: 10 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: LC.radius.full,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
  },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipTexto: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextoSel: { color: LC.primary, fontWeight: '800' },

  regras: { marginTop: 12, gap: 6 },
  regraLinha: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  regraTexto: { fontSize: 12.5, color: LC.textMuted },
  regraOk: { color: LC.successFg, fontWeight: '600' },

  linkCaixa: { backgroundColor: LC.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: LC.border },
  linkTexto: { fontSize: 12.5, color: LC.textPrimary },

  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  botao: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  botaoVoltar: { backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border },
  botaoOk: { backgroundColor: LC.primary },
  botaoPerigo: { backgroundColor: LC.danger },
  botaoTexto: { fontSize: 14, fontWeight: '800' },

  erro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: 12,
    borderRadius: 12, backgroundColor: LC.dangerBg,
  },
  erroTexto: { flex: 1, fontSize: 13, color: LC.dangerFg, lineHeight: 18 },

  chave: { flexDirection: 'row', backgroundColor: LC.neutralBg, borderRadius: 14, padding: 4, gap: 4 },
  chaveLado: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 11,
  },
  chaveAtivo: { backgroundColor: LC.successBg },
  chaveDesligado: { backgroundColor: LC.bgCard, ...LC.shadow },
  chaveTexto: { fontSize: 13.5, fontWeight: '700', color: LC.textMuted },

  pergunta: {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: LC.dangerBg, borderWidth: 1, borderColor: '#FCA5A5',
  },
  perguntaTitulo: { fontSize: 15, fontWeight: '800', color: LC.dangerFg },
  perguntaTexto: { fontSize: 13, color: LC.dangerFg, marginTop: 5, lineHeight: 19 },

  recado: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, padding: 13,
    borderRadius: 14, backgroundColor: LC.primaryLight, borderWidth: 1, borderColor: LC.primarySoft,
  },
  recadoTexto: { fontSize: 13, color: LC.textPrimary, lineHeight: 18 },

  convite: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    padding: 13, borderRadius: 14, backgroundColor: LC.warningBg,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  conviteIcone: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE68A',
    alignItems: 'center', justifyContent: 'center',
  },
  conviteTitulo: { fontSize: 14, fontWeight: '800', color: LC.warningFg },
  conviteTexto: { fontSize: 12.5, color: LC.warningFg, marginTop: 2, lineHeight: 17 },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  bloco: {
    flexGrow: 1, flexBasis: '46%',
    backgroundColor: LC.bgCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: LC.border,
  },
  blocoApertado: { backgroundColor: LC.neutralBg },
  blocoIcone: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  blocoTitulo: { fontSize: 14, fontWeight: '800', color: LC.textPrimary },
  blocoSub: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },

  secao: {
    fontSize: 11.5, fontWeight: '800', color: LC.textMuted, letterSpacing: 0.6,
    textTransform: 'uppercase', marginTop: 22, marginBottom: 8,
  },
  dados: { backgroundColor: LC.bgCard, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: LC.border },
  dadoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dadoTexto: { flex: 1, fontSize: 13, color: LC.textSecondary, lineHeight: 18 },

  excluir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 22, paddingVertical: 12,
  },
  excluirTexto: { fontSize: 13, fontWeight: '700', color: LC.danger },
});
