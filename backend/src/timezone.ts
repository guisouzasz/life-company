/**
 * Fuso do estúdio, aplicado ANTES de qualquer outro módulo carregar.
 *
 * A Railway roda o container em UTC. Depois das 21h no Brasil o servidor já
 * estava no dia seguinte, e tudo que depende de "hoje" saía errado: as aulas
 * de hoje no painel, o início da semana ISO e o cron de auto-agendamento.
 *
 * Precisa ser um módulo separado porque `import` é içado: uma atribuição no
 * topo do main.ts rodaria depois dos imports, tarde demais (o Node fixa o
 * fuso no primeiro uso de Date).
 */
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';
