/**
 * Treinos e ficha de saúde de um aluno, pelo painel da dona.
 *
 * É a MESMA tela do professor, e de propósito: duas telas para a mesma ficha
 * ficariam discordando na primeira mudança. Ela mora também aqui porque a
 * regra de rotas mantém a dona dentro de /admin — pela rota do professor ela
 * era devolvida ao painel, e simplesmente não havia caminho até os treinos.
 *
 * Morar em /admin também dá à tela o menu lateral dela no computador.
 */
export { default } from '../professor/treinos-aluno';
