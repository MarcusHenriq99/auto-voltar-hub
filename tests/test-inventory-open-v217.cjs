const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

let source = fs.readFileSync(require('path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
source = source.replace(
  '  fznBypassIsTrusted(window);\n  fznHackClick(window);\n  fznInjetar();\n  setInterval(fznInjetar, 500);',
  ''
);
source = source.replace(
  '  atualizarPainel();\n  setInterval(verificar, 500);',
  'globalThis.api={cfg,estadoLoja,lerEspacos,mochilaCheiaConfirmada,precisaVender};'
);
const saved = new Map();
const context = {
  console,
  setInterval: () => 0,
  document: { querySelectorAll: () => [] },
  localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  },
};
vm.createContext(context);
vm.runInContext(source, context);
const { cfg, estadoLoja, lerEspacos, mochilaCheiaConfirmada, precisaVender } = context.api;
cfg.venda.ligado = true;

let label = '200 / 200 · Mochila cheia';
let visible = true;
const element = {
  get textContent() { return label; },
  getBoundingClientRect: () => ({ width: visible ? 100 : 0, height: visible ? 20 : 0 }),
  closest: () => null,
};
const game = {
  document: {
    querySelectorAll: () => [element],
    body: { innerText: '' },
  },
  __elragEngine: { requestInventorySnapshot: () => {} },
};
const snapshot = (n) => ({ equip: Array.from({ length: n }, (_, i) => ({ itemId: 1000 + i, name: 'item ' + i })) });
estadoLoja.janela = game;
estadoLoja.mochila = snapshot(60);
estadoLoja.mochilaEm = Date.now() - 1000;
assert.strictEqual(lerEspacos(game).usados, 60, 'Contador visual contraditorio nao dispara viagem');
assert.strictEqual(mochilaCheiaConfirmada(game), null);
assert.strictEqual(precisaVender(game), false, 'Abrir mochila sem peso/slots criticos nao inicia venda');

visible = false;
assert.strictEqual(lerEspacos(game).usados, 60, 'Janela invisivel nao altera contagem');
visible = true;
label = '190 / 200 · 10 espaços livres';
estadoLoja.mochila = snapshot(190);
estadoLoja.mochilaEm = Date.now() - 1000;
assert.strictEqual(mochilaCheiaConfirmada(game), null, 'Primeira leitura critica aguarda confirmacao');
setTimeout(() => {
  assert.strictEqual(mochilaCheiaConfirmada(game).usados, 190, '95% real e estavel deve disparar');
  console.log('OK: abrir mochila nao provoca viagem falsa; 95% real continua acionando.');
}, 1100);

