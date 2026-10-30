const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

let source = fs.readFileSync(require('path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
source = source.replace(
  '  fznBypassIsTrusted(window);\n  fznHackClick(window);\n  fznInjetar();\n  setInterval(fznInjetar, 500);',
  ''
);
source = source.replace(
  '  atualizarPainel();\n  setInterval(verificarSeguro, 500);',
  'globalThis.api={cfg,estadoLoja,lerEspacos,mochilaCheiaConfirmada,precisaVender};'
);
const saved = new Map();
let now = 10_000;
const context = {
  console,
  setInterval: () => 0,
  window: {},
  Date: class extends Date { static now() { return now; } },
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
estadoLoja.mochilaEm = now - 1000;
assert.strictEqual(lerEspacos(game).usados, 60, 'Contador visual contraditorio nao dispara viagem');
assert.strictEqual(mochilaCheiaConfirmada(game), null);
assert.strictEqual(precisaVender(game), false, 'Abrir mochila sem peso/slots criticos nao inicia venda');

visible = false;
assert.strictEqual(lerEspacos(game).usados, 60, 'Janela invisivel nao altera contagem');
estadoLoja.mochila = snapshot(95);
estadoLoja.mochilaEm = now - 1000;
assert.strictEqual(lerEspacos(game).max, 100, 'Conta comum tem 100 slots com a mochila fechada');
assert.strictEqual(mochilaCheiaConfirmada(game), null, 'Primeira leitura critica aguarda confirmacao');
now += 1100;
assert.strictEqual(mochilaCheiaConfirmada(game).usados, 95, '95/100 dispara sem abrir a mochila');
assert.strictEqual(precisaVender(game), true, 'Rotina por slots deve iniciar com a mochila fechada');
estadoLoja.mochila = snapshot(100);
estadoLoja.mochilaEm = now - 1000;
assert.strictEqual(mochilaCheiaConfirmada(game), null, 'Mudanca de ocupacao requer nova confirmacao');
now += 1100;
assert.strictEqual(mochilaCheiaConfirmada(game).usados, 100, '100/100 tambem dispara com a mochila fechada');

visible = true;
label = '190 / 200 · 10 espaços livres';
estadoLoja.mochila = snapshot(190);
estadoLoja.mochilaEm = now - 1000;
assert.strictEqual(lerEspacos(game).max, 200, 'Contador real aprende a mochila expandida');
assert.strictEqual(mochilaCheiaConfirmada(game), null, 'Primeira leitura critica aguarda confirmacao');
now += 1100;
assert.strictEqual(mochilaCheiaConfirmada(game).usados, 190, '95% real e estavel deve disparar');
visible = false;
assert.strictEqual(lerEspacos(game).max, 200, 'Capacidade expandida persiste com a mochila fechada');
console.log('OK: 95/100 e 100/100 fechados disparam; 200 slots aprendidos e mantidos sem janela.');
