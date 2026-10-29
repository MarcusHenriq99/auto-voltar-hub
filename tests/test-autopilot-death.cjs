const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const voltar = fs.readFileSync(path.join(root, 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const hunt = fs.readFileSync(path.join(root, 'AUTOHUNT-YGGIDLE.user.js'), 'utf8');
const trecho = (source, from, to) => {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `Trecho ausente: ${from}`);
  return source.slice(a, b);
};

const apSource = trecho(voltar, '  const autopilotLigado =', '  const ligarAutopilot =');
const ap = vm.runInNewContext(apSource + '\nautopilotLigado;', {});
for (const state of [0, 1]) {
  assert.equal(ap({ __elragEngine: { getAutopilotSnapshot: () => ({ runtimeState: state }) } }), false);
}
assert.equal(ap({ __elragEngine: { getAutopilotSnapshot: () => ({ runtimeState: 2 }) } }), true);

const janelaSource = trecho(hunt, '  const janelaBloqueiaReligar =', '  // v1.60: sempre ativo');
const janela = vm.runInNewContext(janelaSource + '\njanelaBloqueiaReligar;', {
  temJanelaAberta: () => true,
});
assert.equal(janela({ document: { body: { innerText: 'Voltar para o mapa anterior' } } }, 'covil@1'), false);
assert.equal(janela({ document: { body: { innerText: 'Renascer agora' } } }, 'covil@1'), true);

const morteSource = trecho(voltar, '  let ponteMorteJanela =', '  const interromperTudo =');
let menuClicado = false;
let agora = 10000;
const ctx = {
  Date: { now: () => agora },
  botaoPorTexto: () => undefined,
  log: () => {},
};
vm.createContext(ctx);
vm.runInContext(morteSource + '\nglobalThis.morteConfirmadaTeste = morteConfirmada; globalThis.abrirMenuMorteTeste = abrirMenuMorte; globalThis.recuperarMorteSemDialogoTeste = recuperarMorteSemDialogo;', ctx);
const w = {
  __fznEu: () => ({ action: 5, ACTION: { DIE: 5 } }),
  document: {
    body: { innerText: '' },
    querySelector: () => ({ click: () => { menuClicado = true; } }),
  },
};
assert.equal(ctx.morteConfirmadaTeste(w), true, 'Detecta morte mesmo sem o menu aberto');
ctx.abrirMenuMorteTeste(w);
assert.equal(menuClicado, true, 'Abre o menu para permitir o retorno');
let recargas = 0;
const sessao = new Map();
const wSemDialogo = {
  document: {
    body: { innerText: 'HP\n1 / 56.458\n0,0%\nMenu\nConfigurações' },
    head: { appendChild: () => {} },
    createElement: () => ({ type: '', textContent: '' }),
    querySelector: () => ({ click: () => { menuClicado = true; } }),
  },
  sessionStorage: {
    getItem: (k) => sessao.get(k) || null,
    setItem: (k, v) => sessao.set(k, v),
  },
  location: { reload: () => { recargas++; } },
};
assert.equal(ctx.morteConfirmadaTeste(wSemDialogo), true, 'HP 1 e 0,0% detecta morte com menu comum');
ctx.recuperarMorteSemDialogoTeste(wSemDialogo);
assert.equal(recargas, 0, 'Primeiro tenta abrir o menu de morte');
agora += 9000;
ctx.recuperarMorteSemDialogoTeste(wSemDialogo);
assert.equal(recargas, 1, 'Recarrega somente o jogo se o dialogo de morte nao aparecer');
agora += 9000;
ctx.recuperarMorteSemDialogoTeste(wSemDialogo);
assert.equal(recargas, 1, 'Nao entra em ciclo de recargas durante dois minutos');
wSemDialogo.document.body.innerText = 'HP\n1 / 100\n1,0%';
assert.equal(ctx.morteConfirmadaTeste(wSemDialogo), false, 'Nao trata 1 HP vivo como morto');
console.log('OK: estados parados, janela do Covil e morte sem menu detectados.');
