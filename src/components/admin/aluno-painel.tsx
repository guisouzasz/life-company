import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { nomeModalidade } from '../../constants/assets';
import { Avatar } from '../ui/avatar';
import { Icon, type IconName } from '../ui/icon';
import { nomeCurto } from '../../services/nome';
import { isoParaData, mascaraCep, mascaraCpf, mascaraTelefone } from '../../services/mascaras';
import { telefoneParaWhatsapp } from '../../services/whatsapp';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';

/**
 * Tudo o que a dona faz com UM aluno, num lugar só.
 *
 * Antes cada aluno era um cartão sempre aberto — cadastro inteiro, dois
 * botões e mais quatro links de texto, um embaixo do outro. Um aluno ocupava
 * a tela do celular, a lista de 28 dava quase dezesseis telas de rolagem, e
 * "Excluir" nem aparecia sem rolar. No computador eram cinco botões
 * espremidos numa coluna, quebrando em três andares — e sem o de Treinos.
 *
 * Agora a lista só serve para ACHAR a pessoa, e este painel para AGIR sobre
 * ela: as ações viram blocos grandes, cada um dizendo o que abre, na mesma
 * ordem no celular e no computador.
 */

interface Props {
  aluno: AlunoAdmin | null;
  onClose: () => void;
  /** A troca treina/parou está a caminho para este aluno. */
  mudandoMatricula: boolean;
  gerandoLink: boolean;
  onAlternarMatricula: (a: AlunoAdmin) => void;
  onEditar: (a: AlunoAdmin) => void;
  onPlano: (a: AlunoAdmin) => void;
  onTreinos: (a: AlunoAdmin) => void;
  onCreditos: (a: AlunoAdmin) => void;
  onLink: (a: AlunoAdmin) => void;
  onWhatsapp: (a: AlunoAdmin) => void;
  onExcluir: (a: AlunoAdmin) => void;
  /**
   * O resultado da troca treina/parou, mostrado AQUI dentro.
   *
   * Janela aberta por cima do painel ficava ATRÁS dele no navegador: a dona
   * tocava e não via nada. Confirmação e recado moram no próprio painel.
   */
  recado?: { titulo: string; texto: string } | null;
  onFecharRecado?: () => void;
}

/** "Pilates · 3x por semana", ou null quando o aluno está sem plano. */
export function resumoDoPlano(aluno: AlunoAdmin): string | null {
  const vinculo = aluno.usuarioPlanos?.[0];
  if (!vinculo?.plano) return null;
  const mod = vinculo.modalidade?.nome ? nomeModalidade(vinculo.modalidade.nome) : null;
  return mod ? `${mod} · ${vinculo.plano.nome}` : vinculo.plano.nome;
}

type Bloco = {
  chave: string;
  icone: IconName;
  titulo: string;
  sub: string;
  cor: string;
  fundo: string;
  onPress: () => void;
  carregando?: boolean;
};

export function AlunoPainel(props: Props) {
  const { aluno, onClose } = props;
  const isDesktop = useIsDesktop();
  /** "Parou de treinar" espera a confirmação aqui dentro antes de ir. */
  const [confirmandoParada, setConfirmandoParada] = useState(false);
  // Outro aluno aberto (ou painel fechado) começa sem pergunta pendente.
  useEffect(() => setConfirmandoParada(false), [aluno?.id]);
  if (!aluno) return null;

  /**
   * Parar tira a pessoa dos horários fixos e desmarca as aulas dela daqui
   * para frente, e voltar a treinar NÃO devolve os horários. Na lista antiga,
   * com o botão no cartão grandão, errar era difícil; aqui a pergunta vem
   * antes. Voltar a treinar não pergunta: não apaga nada.
   */
  const trocar = (treina: boolean) => {
    if (!treina) setConfirmandoParada(true);
    else props.onAlternarMatricula(aluno);
  };

  const plano = resumoDoPlano(aluno);
  const temWhatsapp = !!telefoneParaWhatsapp(aluno.telefone);

  const blocos: Bloco[] = [
    {
      chave: 'editar', icone: 'create-outline', titulo: 'Editar cadastro', sub: 'Contato e documentos',
      cor: LC.primary, fundo: LC.primaryLight, onPress: () => props.onEditar(aluno),
    },
    {
      chave: 'plano', icone: 'calendar-outline', titulo: 'Plano e horários', sub: 'Dias fixos da semana',
      cor: '#2563EB', fundo: '#DBEAFE', onPress: () => props.onPlano(aluno),
    },
    {
      chave: 'treinos', icone: 'barbell-outline', titulo: 'Treinos e saúde', sub: 'Fichas e anamnese',
      cor: '#EA580C', fundo: '#FFEDD5', onPress: () => props.onTreinos(aluno),
    },
    {
      chave: 'creditos', icone: 'ticket-outline', titulo: 'Créditos', sub: 'Aulas de reposição',
      cor: '#7C3AED', fundo: '#EDE9FE', onPress: () => props.onCreditos(aluno),
    },
    {
      chave: 'link', icone: 'key-outline', titulo: 'Link de acesso',
      // O mesmo link faz as duas coisas; o subtítulo diz qual vai ser.
      sub: aluno.ativado ? 'Se esqueceu a senha' : 'Para criar a senha',
      cor: '#0F766E', fundo: '#CCFBF1', onPress: () => props.onLink(aluno), carregando: props.gerandoLink,
    },
  ];
  /*
    Só aparece quando o número do cadastro abre uma conversa. Um botão que
    abre o WhatsApp com número errado é pior do que não ter botão.
  */
  if (temWhatsapp) {
    blocos.push({
      chave: 'whats', icone: 'logo-whatsapp', titulo: 'WhatsApp', sub: 'Chamar numa conversa',
      cor: '#15803D', fundo: '#DCFCE7', onPress: () => props.onWhatsapp(aluno),
    });
  }

  const dados: { icone: IconName; texto: string }[] = [];
  if (aluno.telefone) dados.push({ icone: 'call-outline', texto: mascaraTelefone(aluno.telefone) });
  dados.push({ icone: 'mail-outline', texto: aluno.email ?? 'Sem e-mail — cadastra ao entrar no app' });
  if (aluno.cpf) dados.push({ icone: 'card-outline', texto: `CPF ${mascaraCpf(aluno.cpf)}` });
  if (aluno.rg) dados.push({ icone: 'id-card-outline', texto: `RG ${aluno.rg}` });
  if (aluno.dataNascimento) dados.push({ icone: 'gift-outline', texto: `Nasceu em ${isoParaData(aluno.dataNascimento)}` });
  if (aluno.endereco || aluno.cep) {
    dados.push({
      icone: 'location-outline',
      texto: [aluno.endereco, aluno.cep ? `CEP ${mascaraCep(aluno.cep)}` : ''].filter(Boolean).join(' — '),
    });
  }

  return (
    <Modal visible transparent animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[s.fundo, isDesktop && s.fundoDesktop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[s.folha, isDesktop && s.folhaDesktop]}>
          {isDesktop ? null : <View style={s.alca} />}

          {/* Quem é */}
          <View style={s.topo}>
            <View>
              <Avatar nome={aluno.nome} size={56} />
              <View style={[s.ponto, { backgroundColor: aluno.ativo ? LC.success : LC.textMuted }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nome} numberOfLines={1}>{nomeCurto(aluno.nome)}</Text>
              {/* O completo só quando diz algo a mais: "Daniela Rocha" duas vezes é ruído. */}
              {aluno.nome.trim().toLowerCase() !== nomeCurto(aluno.nome).toLowerCase() ? (
                <Text style={s.nomeCompleto} numberOfLines={1}>{aluno.nome}</Text>
              ) : null}
              {plano ? (
                <Text style={s.plano} numberOfLines={1}>{plano}</Text>
              ) : (
                <Text style={[s.plano, { color: LC.warningFg }]}>Sem plano — defina em Plano e horários</Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={s.fechar} accessibilityLabel="Fechar">
              <Icon name="close" size={20} color={LC.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.corpo} showsVerticalScrollIndicator={false}>
            {/*
              Treina / parou, em duas metades: é a operação que a dona mais
              faz, então vem primeiro e ocupa a largura toda. Parar tem
              confirmação (quem chama decide) porque tira a pessoa dos
              horários fixos, e isso não volta sozinho.
            */}
            <View style={s.chave} accessibilityRole="radiogroup">
              {([true, false] as const).map((treina) => {
                const marcado = aluno.ativo === treina;
                return (
                  <Pressable
                    key={String(treina)}
                    style={[
                      s.chaveLado,
                      marcado && (treina ? s.chaveTreina : s.chaveParou),
                    ]}
                    disabled={marcado || props.mudandoMatricula}
                    onPress={() => trocar(treina)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: marcado }}
                    accessibilityLabel={treina ? `${aluno.nome} treina aqui` : `${aluno.nome} parou de treinar`}
                  >
                    <Icon
                      name={treina ? 'checkmark-circle' : 'pause-circle'}
                      size={17}
                      color={marcado ? (treina ? LC.successFg : LC.textSecondary) : LC.textMuted}
                    />
                    <Text style={[s.chaveTexto, marcado && { color: treina ? LC.successFg : LC.textPrimary }]}>
                      {props.mudandoMatricula && !marcado ? '…' : treina ? 'Treina' : 'Parou de treinar'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {confirmandoParada ? (
              <View style={s.pergunta} accessibilityRole="alert">
                <Text style={s.perguntaTitulo}>{nomeCurto(aluno.nome)} parou de treinar?</Text>
                <Text style={s.perguntaTexto}>
                  Sai dos horários fixos e as aulas marcadas daqui para frente são desmarcadas — as
                  vagas voltam para as turmas. Se voltar a treinar, os horários precisam ser
                  cadastrados de novo.
                </Text>
                <View style={s.perguntaBotoes}>
                  <Pressable
                    style={[s.perguntaBotao, s.perguntaVoltar]}
                    onPress={() => setConfirmandoParada(false)}
                    accessibilityRole="button"
                  >
                    <Text style={[s.perguntaBotaoTexto, { color: LC.textPrimary }]}>Voltar</Text>
                  </Pressable>
                  <Pressable
                    style={[s.perguntaBotao, s.perguntaConfirmar]}
                    onPress={() => {
                      setConfirmandoParada(false);
                      props.onAlternarMatricula(aluno);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Confirmar que ${aluno.nome} parou de treinar`}
                  >
                    <Text style={[s.perguntaBotaoTexto, { color: '#fff' }]}>Confirmar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {props.recado ? (
              <View style={s.recado} accessibilityRole="alert">
                <Icon name="information-circle" size={18} color={LC.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.recadoTitulo}>{props.recado.titulo}</Text>
                  <Text style={s.recadoTexto}>{props.recado.texto}</Text>
                </View>
                <Pressable onPress={props.onFecharRecado} hitSlop={10} accessibilityLabel="Fechar recado">
                  <Icon name="close" size={16} color={LC.textSecondary} />
                </Pressable>
              </View>
            ) : null}

            {/*
              Quem ainda não entrou no app é o que mais trava a agenda: sem
              conta, o aluno não marca nem desmarca nada. O painel já oferece
              o próximo passo em vez de só avisar.
            */}
            {!aluno.ativado ? (
              <Pressable
                style={({ pressed }) => [s.convite, pressed && { opacity: 0.8 }]}
                onPress={() => props.onLink(aluno)}
                accessibilityRole="button"
              >
                <View style={s.conviteIcone}>
                  <Icon name="phone-portrait-outline" size={18} color={LC.warningFg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.conviteTitulo}>Ainda não abriu o app</Text>
                  <Text style={s.conviteTexto}>Toque para gerar o link de acesso e mandar pelo WhatsApp.</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={LC.warningFg} />
              </Pressable>
            ) : null}

            <View style={s.grade}>
              {blocos.map((b) => (
                <Pressable
                  key={b.chave}
                  style={({ pressed }) => [s.bloco, pressed && s.blocoApertado]}
                  onPress={b.onPress}
                  disabled={b.carregando}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.titulo} de ${aluno.nome}`}
                >
                  <View style={[s.blocoIcone, { backgroundColor: b.fundo }]}>
                    <Icon name={b.icone} size={20} color={b.cor} />
                  </View>
                  <Text style={s.blocoTitulo}>{b.carregando ? 'Gerando…' : b.titulo}</Text>
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
              onPress={() => props.onExcluir(aluno)}
              accessibilityLabel={`Excluir ${aluno.nome} definitivamente`}
            >
              <Icon name="trash-outline" size={15} color={LC.danger} />
              <Text style={s.excluirTexto}>Excluir definitivamente</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
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
  plano: { fontSize: 13, fontWeight: '600', color: LC.primary, marginTop: 4 },
  fechar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: LC.neutralBg,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
  },

  corpo: { paddingHorizontal: 20, paddingBottom: 28 },

  chave: {
    flexDirection: 'row', backgroundColor: LC.neutralBg, borderRadius: 14, padding: 4, gap: 4,
  },
  chaveLado: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 11,
  },
  chaveTreina: { backgroundColor: LC.successBg },
  chaveParou: { backgroundColor: LC.bgCard, ...LC.shadow },
  chaveTexto: { fontSize: 13.5, fontWeight: '700', color: LC.textMuted },

  pergunta: {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: LC.dangerBg, borderWidth: 1, borderColor: '#FCA5A5',
  },
  perguntaTitulo: { fontSize: 15, fontWeight: '800', color: LC.dangerFg },
  perguntaTexto: { fontSize: 13, color: LC.dangerFg, marginTop: 5, lineHeight: 19 },
  perguntaBotoes: { flexDirection: 'row', gap: 10, marginTop: 12 },
  perguntaBotao: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  perguntaVoltar: { backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border },
  perguntaConfirmar: { backgroundColor: LC.danger },
  perguntaBotaoTexto: { fontSize: 14, fontWeight: '800' },

  recado: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, padding: 13,
    borderRadius: 14, backgroundColor: LC.primaryLight, borderWidth: 1, borderColor: LC.primarySoft,
  },
  recadoTitulo: { fontSize: 14, fontWeight: '800', color: LC.textPrimary },
  recadoTexto: { fontSize: 12.5, color: LC.textSecondary, marginTop: 3, lineHeight: 18 },

  convite: {
    flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12,
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
