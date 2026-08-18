/**
 * Catálogo de exercícios por grupo muscular, usado ao montar a ficha.
 *
 * Existe por dois motivos. O primeiro é conforto: o professor escolhe da lista
 * do grupo em vez de digitar. O segundo é mais importante — a evolução de
 * carga é casada pelo NOME do exercício (RegistroCarga.exercicio), então
 * "Supino reto" e "SUPINO RETO" viram históricos separados. Escolher da lista
 * mantém a grafia estável e o histórico do aluno inteiro.
 *
 * As chaves batem com GRUPOS em app/professor/treinos-aluno.tsx. A lista é um
 * ponto de partida, não uma camisa de força: quem monta o treino pode digitar
 * um nome que não esteja aqui.
 */
export const EXERCICIOS_POR_GRUPO: Record<string, string[]> = {
  Pernas: [
    'Agachamento livre',
    'Agachamento no Smith',
    'Agachamento sumô',
    'Leg press 45°',
    'Hack machine',
    'Cadeira extensora',
    'Cadeira flexora',
    'Mesa flexora',
    'Cadeira adutora',
    'Cadeira abdutora',
    'Afundo',
    'Passada',
    'Búlgaro',
    'Stiff',
    'Levantamento terra',
    'Panturrilha em pé',
    'Panturrilha sentado',
  ],
  Peitoral: [
    'Supino reto (barra)',
    'Supino reto (halteres)',
    'Supino inclinado (barra)',
    'Supino inclinado (halteres)',
    'Supino declinado',
    'Supino na máquina',
    'Crucifixo reto',
    'Crucifixo inclinado',
    'Voador (peck deck)',
    'Crossover',
    'Pullover',
    'Flexão de braço',
  ],
  Costas: [
    'Puxada frente',
    'Puxada supinada',
    'Puxada triângulo',
    'Barra fixa',
    'Remada baixa',
    'Remada curvada',
    'Remada cavalinho',
    'Remada unilateral (serrote)',
    'Remada na máquina',
    'Pulldown',
    'Levantamento terra',
    'Hiperextensão lombar',
  ],
  Ombro: [
    'Desenvolvimento (halteres)',
    'Desenvolvimento (máquina)',
    'Desenvolvimento militar',
    'Arnold press',
    'Elevação lateral',
    'Elevação frontal',
    'Crucifixo inverso',
    'Remada alta',
    'Face pull',
    'Encolhimento',
    'Rotação externa',
  ],
  Bíceps: [
    'Rosca direta (barra)',
    'Rosca direta (halteres)',
    'Rosca alternada',
    'Rosca martelo',
    'Rosca scott',
    'Rosca concentrada',
    'Rosca inversa',
    'Rosca no cabo',
    'Rosca 21',
  ],
  Tríceps: [
    'Tríceps pulley (corda)',
    'Tríceps pulley (barra)',
    'Tríceps testa',
    'Tríceps francês',
    'Tríceps coice',
    'Tríceps banco',
    'Mergulho entre bancos',
    'Supino fechado',
  ],
  Abdômen: [
    'Abdominal supra',
    'Abdominal infra',
    'Abdominal oblíquo',
    'Abdominal na máquina',
    'Abdominal remador',
    'Elevação de pernas',
    'Prancha isométrica',
    'Prancha lateral',
    'Bicicleta',
    'Russian twist',
  ],
  Glúteos: [
    'Elevação pélvica',
    'Coice na polia',
    'Glúteo quatro apoios',
    'Abdução na máquina',
    'Abdução com elástico',
    'Agachamento sumô',
    'Afundo',
    'Búlgaro',
    'Stiff',
  ],
  Aeróbico: [
    'Caminhada na esteira',
    'Corrida na esteira',
    'Bicicleta ergométrica',
    'Bike spinning',
    'Elíptico',
    'Escada (simulador)',
    'Remo ergométrico',
    'Pular corda',
  ],
};

/** Exercícios do grupo; lista vazia para grupo desconhecido. */
export const exerciciosDoGrupo = (grupo?: string | null): string[] =>
  EXERCICIOS_POR_GRUPO[(grupo ?? '').trim()] ?? [];
