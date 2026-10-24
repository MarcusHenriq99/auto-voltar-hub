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
  'globalThis.api={cfg,estadoLoja,candidatosArmazem,motivoProtecao,totalLucky,itensMochila,itensArmazem};'
);
const context = {
  console, setInterval: () => 0,
  document: { querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem: () => {} },
};
vm.createContext(context);
vm.runInContext(source, context);

const { cfg, estadoLoja, candidatosArmazem, motivoProtecao, totalLucky, itensMochila, itensArmazem } = context.api;
assert.strictEqual(cfg.lucky[0], 'Ovo da La Voisin');
cfg.venda.proteger.etc = false;
const ovo = { index: 1, itemId: 101, name: 'Ovo da La Voisin', count: 1 };
const outro = { index: 2, itemId: 102, name: 'Osso', count: 5 };
const parecido = { index: 3, itemId: 103, name: 'Anel da La Voisin', count: 1 };
estadoLoja.mochila = { etc: [ovo, outro, parecido] };
estadoLoja.armazem = { etc: [{ ...ovo, index: 10, count: 2 }] };

assert.match(motivoProtecao(ovo, 'etc'), /lucky drop/);
assert.strictEqual(motivoProtecao(outro, 'etc'), null);
assert.strictEqual(motivoProtecao(parecido, 'etc'), null);
assert.strictEqual(totalLucky('Ovo da La Voisin', itensMochila()), 1);
assert.strictEqual(totalLucky('Ovo da La Voisin', itensArmazem()), 2);
assert.deepStrictEqual(Array.from(candidatosArmazem(new Set(), true), x => x.item.name), ['Osso', 'Anel da La Voisin']);

cfg.lucky = ['Gema Especial'];
const gema = { index: 4, itemId: 104, name: 'Gema Especial', count: 3 };
estadoLoja.mochila.etc.push(gema);
assert.match(motivoProtecao(gema, 'etc'), /lucky drop/);
assert.strictEqual(candidatosArmazem(new Set(), false).some(({ item }) => item === gema), true);
console.log('OK: lucky drop protegido, contagem por local e nomes exatos.');
