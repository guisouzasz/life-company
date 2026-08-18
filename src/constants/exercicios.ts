/**
 * Catálogo de exercícios por grupo muscular, usado ao montar a ficha.
 *
 * A lista é a do professor do estúdio — ordem e vocabulário dele. Serve de
 * atalho, não de limite: quem monta o treino continua podendo escrever um
 * exercício que não esteja aqui.
 *
 * Vale manter a grafia estável: a evolução de carga é casada pelo NOME do
 * exercício (RegistroCarga.exercicio), então "Rosca direta" e "rosca direta"
 * viram históricos separados e o aluno perde a progressão.
 */
export const EXERCICIOS_POR_GRUPO: Record<string, string[]> = {
  Abdominal: [
    'Canivete',
    'Canoa',
    'Oblíquo',
    'Extensão lombar bola',
    'Infra',
    'Militar',
    'Perdigueiro invertido',
    'Prancha',
    'Prancha lateral',
    'Remador',
    'Rodinha',
    'Russo',
    'Supra',
    'Tesoura',
  ],
  Aeróbico: [
    'Bicicleta',
    'Caminhada na esteira',
    'Corrida na esteira',
  ],
  Antebraço: [
    'Tortura chinesa',
    'Rosca inversa',
    'Rosca punho',
  ],
  Bíceps: [
    'Rosca 21',
    'Rosca 45º',
    'Rosca alternada',
    'Rosca concentrada',
    'Rosca cross',
    'Rosca cross 90º',
    'Rosca direta',
    'Rosca martelo',
    'Rosca scott',
    'Rosca zottman',
  ],
  Costas: [
    'Barra fixa',
    'Crucifixo inverso',
    'Pull down',
    'Puxada corda',
    'Puxada frente',
    'Remada aberta',
    'Remada fechada',
    'Remada alta',
    'Remada cavalinho',
    'Remada curvada',
    'Serrote',
    'Superman',
  ],
  Glúteo: [
    'Descida do caixote',
    'Elevação pélvica',
    'Glúteo cross',
    'Glúteo solo',
    'Agachamento búlgaro',
  ],
  Ombro: [
    'Desenvolvimento arnold',
    'Desenvolvimento frente barra',
    'Desenvolvimento halter',
    'Elevação frontal',
    'Elevação lateral',
    'Elevação mista',
    'Encolhimento',
  ],
  // O professor abriu o grupo mas ainda não mandou os exercícios. Fica
  // disponível para escolher, com o campo livre até a lista chegar.
  Panturrilha: [],
  Peitoral: [
    'Cross over',
    'Crucifixo reto',
    'Crucifixo inclinado',
    'Supino reto',
    'Supino inclinado',
    'Flexão',
    'Pull over',
    'Voador',
  ],
  Pernas: [
    'Abdutor',
    'Adutor',
    'Afundo',
    'Agachamento',
    'Extensor',
    'Flexor',
    'Extensão de quadril',
    'Flexão de joelho',
    'Flexão nórdica',
    'Leg press',
    'Levantamento terra',
    'Stiff',
    'Panturrilha',
    'Sumô',
    'Tibial',
  ],
  Tríceps: [
    'Coice',
    'Corda',
    'Barra',
    'Francês',
    'Testa',
    'Supino fechado',
    'Tríceps banco',
  ],
};

/**
 * Nomes de grupo usados em fichas antigas, antes de a lista do professor
 * chegar. Sem isso, abrir uma dessas fichas para editar mostraria o catálogo
 * vazio, porque a chave não bateria.
 */
const APELIDOS: Record<string, string> = {
  Abdômen: 'Abdominal',
  Glúteos: 'Glúteo',
};

/** Exercícios do grupo; lista vazia para grupo sem catálogo. */
export const exerciciosDoGrupo = (grupo?: string | null): string[] => {
  const chave = (grupo ?? '').trim();
  return EXERCICIOS_POR_GRUPO[APELIDOS[chave] ?? chave] ?? [];
};
