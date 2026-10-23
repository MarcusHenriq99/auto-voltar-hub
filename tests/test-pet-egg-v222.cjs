const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

let source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
source = source.replace(
  '  fznBypassIsTrusted(window);\n  fznHackClick(window);\n  fznInjetar();\n  setInterval(fznInjetar, 500);',
  ''
);
source = source.replace(
  '  atualizarPainel();\n  setInterval(verificar, 500);',
  'globalThis.api={cfg,estadoLoja,candidatosArmazem,motivoProtecao};'
);
const saved = new Map();
const context = {
  console, setInterval: () => 0,
  document: { querySelectorAll: () => [] },
  localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  },
};
vm.createContext(context);
vm.runInContext(source, context);

const { cfg, estadoLoja, candidatosArmazem, motivoProtecao } = context.api;
cfg.venda.proteger.etc = false;
const ovo = { index: 1, itemId: 301, name: 'Ovo de Esqueleto', count: 1 };
const osso = { index: 2, itemId: 302, name: 'Osso', count: 5 };
estadoLoja.mochila = { etc: [ovo, osso] };

assert.deepStrictEqual(Array.from(candidatosArmazem(new Set(), true), x => x.item.name), ['Osso']);
assert.strictEqual(candidatosArmazem(new Set(), false).length, 0);
assert.match(motivoProtecao(ovo, 'etc'), /ovo de pet/);
assert.strictEqual(motivoProtecao(osso, 'etc'), null);

estadoLoja.mochila.etc[0] = { ...ovo, name: 'Ovo do Esqueleto' };
assert.strictEqual(candidatosArmazem(new Set(), true).length, 1);
console.log('OK: ovos de pet permanecem na mochila sem bloquear outros itens.');

