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
  'globalThis.api={dispensarAvisoDiario,fecharLojaCash};'
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

let closed = false;
const rect = () => ({ width: 100, height: 24 });
const close = { innerText: 'Fechar', getBoundingClientRect: rect, click: () => { closed = true; } };
const root = { querySelectorAll: () => [close] };
const label = { innerText: 'Não mostrar novamente hoje' };
const checkbox = {
  type: 'checkbox', checked: false, disabled: false, labels: [label], parentElement: root,
  getAttribute: () => null, closest: () => null, getBoundingClientRect: rect,
  click() { this.checked = true; },
};
const game = { document: { body: {}, querySelectorAll: () => [checkbox] } };
assert.strictEqual(context.api.dispensarAvisoDiario(game), true);
assert.strictEqual(checkbox.checked, true, 'Primeiro marcar nao mostrar hoje');
assert.strictEqual(closed, false, 'Nao fechar antes de marcar');
assert.strictEqual(context.api.dispensarAvisoDiario(game), true);
assert.strictEqual(closed, true, 'Depois fechar o aviso');
game.document.querySelectorAll = () => [];
assert.strictEqual(context.api.dispensarAvisoDiario(game), false, 'Outros dialogos ficam intactos');
console.log('OK: aviso diario marca a caixa antes de fechar; outros dialogos nao sao atingidos.');

let cashClosed = false;
const cashButton = {
  innerText: '', getAttribute: () => 'Fechar', getBoundingClientRect: rect,
  click: () => { cashClosed = true; },
};
const cashRoot = { querySelectorAll: () => [cashButton], parentElement: game.document.body };
const cashTitle = { innerText: 'YggIdle · Loja de Cash', parentElement: cashRoot, getBoundingClientRect: rect };
game.document.querySelectorAll = () => [cashTitle];
assert.strictEqual(context.api.fecharLojaCash(game), true);
assert.strictEqual(cashClosed, true, 'Loja de Cash fechada sem interagir com compras');
game.document.querySelectorAll = () => [];
assert.strictEqual(context.api.fecharLojaCash(game), false, 'Outras lojas e NPCs intocados');
console.log('OK: Loja de Cash fecha somente quando o titulo exato esta presente.');

