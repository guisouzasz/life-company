const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { AuthService } = require('../dist/src/auth/auth.service');

/*
  O link de acesso tem dois modos na tela: cadastro (ficha inteira e termo) e
  troca de senha (só CPF e a senha nova). Quem escolhe é a marca
  `redefinir=1`, e a pergunta que decide é uma só: a pessoa já tem senha?

  Antes o botão "Gerar link" da dona nunca marcava — a aluna que só perdeu a
  senha recebia o cadastro inteiro de novo — e o e-mail de "esqueci a senha"
  marcava sempre, até para quem nunca tinha entrado.
*/

function servico(senhaHash) {
  const db = {
    usuario: { findUnique: async () => ({ senhaHash }) },
    primeiroAcesso: { upsert: async () => ({}) },
  };
  const config = { get: () => undefined };
  return new AuthService(db, {}, config, {});
}

test('quem ja tem senha recebe o link de trocar senha', async () => {
  const { link } = await servico('$2b$hash-da-senha-antiga').gerarLinkPrimeiroAcesso('ana');
  assert.match(link, /primeiro-acesso\?token=[\w-]+&redefinir=1$/);
});

test('quem nunca entrou recebe o link de cadastro, sem a marca', async () => {
  const { link } = await servico(null).gerarLinkPrimeiroAcesso('bia');
  assert.match(link, /primeiro-acesso\?token=[\w-]+$/);
  assert.doesNotMatch(link, /redefinir/);
});
