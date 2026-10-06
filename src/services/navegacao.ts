import { router } from 'expo-router';

/**
 * Volta uma tela — e, sem tela anterior, vai para `semHistorico`.
 *
 * `router.back()` sozinho não faz nada quando não há para onde voltar, e no
 * celular isso é comum: o aluno abre o link do primeiro acesso direto do
 * WhatsApp, ou o navegador recarrega a página. A seta ficava morta, e a ficha
 * de saúde enviada não saía da tela. A raiz ("/") serve para todo mundo: o
 * layout leva cada papel à sua tela inicial.
 */
export function voltar(semHistorico = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(semHistorico as any);
}
