const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const start = source.indexOf('  const precoBotaoRifa =');
const end = source.indexOf('  const numerosCompradosRifa =', start);
const context = { textoDe: b => b.innerText };
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nglobalThis.ready = botaoCompraRifaAtivo; globalThis.buy = clicarCompraRifa;', context);
let clicks = 0;
const style = { backgroundColor: 'rgb(22, 163, 74)', display: 'block', visibility: 'visible', pointerEvents: 'auto', opacity: '1' };
const attrs = {};
const win = { getComputedStyle: () => style, MouseEvent: class {} };
const button = { isConnected: true, disabled: false, innerText: 'Comprar número — 500.000z',
  ownerDocument: { defaultView: win }, getAttribute: name => attrs[name] ?? null,
  getClientRects: () => [{}], matches: () => false, querySelector: () => null,
  dispatchEvent: () => { clicks++; }, click: () => { throw Error('Clique global proibido'); } };
assert.equal(context.buy(button), true);
assert.equal(clicks, 1);
for (const color of ['rgb(107, 114, 128)', 'rgb(37, 99, 235)', 'rgba(22, 163, 74, 0.4)', 'transparent', '']) {
  style.backgroundColor = color;
  assert.equal(context.buy(button), false, color);
}
for (const color of ['rgb(22 163 74)', 'rgba(22, 163, 74, 1)', 'oklch(72.3% 0.219 149.579)', 'oklch(0.723 0.219 149.579 / 1)']) {
  style.backgroundColor = color;
  assert.equal(context.ready(button), true, color);
}
style.backgroundColor = 'rgb(22, 163, 74)';
for (const name of ['aria-disabled', 'aria-busy']) {
  attrs[name] = 'true'; assert.equal(context.buy(button), false, name); delete attrs[name];
}
for (const label of ['Comprando...', 'Comprar número — Aguarde...', 'Comprar número — Carregando', 'Processando compra']) {
  button.innerText = label; assert.equal(context.buy(button), false, label);
}
button.innerText = 'Comprar número — 500.000z';
for (const [key, value] of [['display', 'none'], ['visibility', 'hidden'], ['pointerEvents', 'none'], ['opacity', '0.5']]) {
  const old = style[key]; style[key] = value; assert.equal(context.buy(button), false, key); style[key] = old;
}
button.disabled = true; assert.equal(context.buy(button), false); button.disabled = false;
button.isConnected = false; assert.equal(context.buy(button), false); button.isConnected = true;
button.matches = () => true; assert.equal(context.buy(button), false); button.matches = () => false;
button.querySelector = () => ({}); assert.equal(context.buy(button), false); button.querySelector = () => null;
button.getClientRects = () => []; assert.equal(context.buy(button), false); button.getClientRects = () => [{}];
win.getComputedStyle = () => { throw Error('Documento indisponível'); };
assert.equal(context.buy(button), false);
assert.equal(clicks, 1, 'Nenhum estado bloqueado pode enviar clique');
console.log('OK: compra exige botão verde, visível, habilitado e sem carregamento; cores RGB/OKLCH.');
