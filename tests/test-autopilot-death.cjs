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
const ctx = {
  Date: { now: () => 10000 },
  botaoPorTexto: () => undefined,
  log: () => {},
};
vm.createContext(ctx);
vm.runInContext(morteSource + '\nglobalThis.morteConfirmadaTeste = morteConfirmada; globalThis.abrirMenuMorteTeste = abrirMenuMorte;', ctx);
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
console.log('OK: estados parados, janela do Covil e morte sem menu detectados.');
