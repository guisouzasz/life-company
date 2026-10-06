const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { mascararSeForCpf, detalheSeguro } = require('../dist/src/logs/detalhe-seguro');
const { LIMITE_POR_CONTA } = require('../dist/src/auth/limite-por-conta');

/*
  Duas regras das portas de entrada que não podem voltar atrás:

  1. O registro de auditoria não guarda CPF. O login aceita CPF no campo
     "email", e "email" vai para o registro — então o CPF tem que sair
     mascarado de lá.
  2. O limite de tentativas conta por CONTA, não só por IP: a turma inteira
     sai pelo mesmo IP do Wi-Fi da academia. CPF com e sem máscara é a mesma
     conta; e-mail com maiúscula também.
*/

test('CPF sai mascarado, com ou sem pontuação', () => {
  assert.equal(mascararSeForCpf('123.456.789-09'), '***.456.789-**');
  assert.equal(mascararSeForCpf('12345678909'), '***.456.789-**');
  assert.equal(mascararSeForCpf(' 123 456 789 09 '), '***.456.789-**');
});

test('o que não é CPF passa como veio', () => {
  assert.equal(mascararSeForCpf('maria@gmail.com'), 'maria@gmail.com');
  assert.equal(mascararSeForCpf('12345'), '12345');
  assert.equal(mascararSeForCpf('Rua 12345678909'), 'Rua 12345678909');
});

test('login recusado pelo CPF: o detalhe do registro não leva o CPF nem a senha', () => {
  const detalhe = detalheSeguro({ email: '123.456.789-09', senha: 'Segredo1' });
  assert.equal(detalhe, JSON.stringify({ email: '***.456.789-**' }));
});

test('limite por conta: CPF com e sem máscara e e-mail em maiúscula são a mesma conta', () => {
  const tracker = (body) => LIMITE_POR_CONTA.getTracker({ ip: '10.0.0.1', body });
  assert.equal(tracker({ email: '123.456.789-09' }), tracker({ email: '12345678909' }));
  assert.equal(tracker({ email: 'Maria@Gmail.com' }), tracker({ email: 'maria@gmail.com' }));
  assert.notEqual(tracker({ email: 'maria@gmail.com' }), tracker({ email: 'joao@gmail.com' }));
});

test('limite por conta: o mesmo aluno em outra rede tem a própria contagem', () => {
  const a = LIMITE_POR_CONTA.getTracker({ ip: '10.0.0.1', body: { email: 'maria@gmail.com' } });
  const b = LIMITE_POR_CONTA.getTracker({ ip: '10.0.0.2', body: { email: 'maria@gmail.com' } });
  assert.notEqual(a, b);
});

test('limite por conta: o link do primeiro acesso identifica a conta', () => {
  const t = (body) => LIMITE_POR_CONTA.getTracker({ ip: '10.0.0.1', body });
  assert.equal(t({ token: 'abc-123', cpf: '12345678909' }), t({ token: 'abc-123', cpf: '00000000000' }));
  assert.notEqual(t({ token: 'abc-123' }), t({ token: 'xyz-999' }));
});
