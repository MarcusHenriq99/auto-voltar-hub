const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const start = source.indexOf('  const zenyRifa ='), end = source.indexOf('  const precoBotaoRifa =', start);
assert.ok(start > 0 && end > start);
const ctx = { visivel: e => e.visible !== false };
vm.createContext(ctx);
vm.runInContext(source.slice(start, end) + '\nglobalThis.read = zenyRifa;', ctx);
function element(text, attrs = {}, parentElement = null, visible = true) {
  return { textContent: text, innerText: text, parentElement, visible, tagName: 'SPAN',
    getAttribute: key => attrs[key] ?? null, closest: () => null };
}
let nodes = [], bodyText = '', hudText = '';
const ids = {};
const hud = { get innerText() { return hudText; }, querySelectorAll: () => nodes };
const w = { document: { body: { get innerText() { return bodyText; } }, getElementById: id => id === 'ui-root' ? hud : ids[id] } };
const parent = element('32.492.176', {}, hud);
const icon = element('Zeny', { title: 'Zeny' }, parent);
nodes = [icon];
assert.equal(ctx.read(w), 32492176, 'O tooltip no ícone não contém o saldo; ler o valor no controle pai');
parent.innerText = parent.textContent = 'Zeny\n32.492.176';
assert.equal(ctx.read(w), 32492176);
parent.innerText = parent.textContent = '32.492.176\n3.751/6.000';
assert.ok(Number.isNaN(ctx.read(w)), 'Não misturar valor de peso com o saldo');
const broken = element('Zeny', { title: 'Zeny' }, hud);
nodes = [broken, element('32.492.176', { 'aria-label': 'Zeny' }, hud)];
assert.equal(ctx.read(w), 32492176, 'Não parar no primeiro rótulo sem número');
nodes = [element('Zeny', { 'aria-describedby': 'zeny-help' }, element('32,492,176', {}, hud))];
ids['zeny-help'] = { textContent: 'Zeny' };
assert.equal(ctx.read(w), 32492176);
nodes = [element('', { title: 'Zeny: 32.492.176' }, hud)];
assert.equal(ctx.read(w), 32492176, 'Valor completo no tooltip também é válido');
for (const symbol of ['Ƶ', 'ℤ', 'ⓩ', '🪙', 'Z']) {
  nodes = [element(symbol + '32.492.176', { title: 'Zeny' }, hud)];
  assert.equal(ctx.read(w), 32492176, 'Ícone textual da moeda: ' + symbol);
}
const nested = element('moeda32.492.176', { title: 'Zeny' }, hud);
nested.querySelectorAll = () => [element('moeda'), element('32.492.176')];
nodes = [nested];
assert.equal(ctx.read(w), 32492176, 'Valor numérico isolado em span do controle identificado');
nested.querySelectorAll = () => [element('32.492.176'), element('3.751'), element('6.000')];
assert.ok(Number.isNaN(ctx.read(w)), 'Descendentes com múltiplos números não identificam uma carteira');
const svgTitle = element('Zeny', {}, element('Zeny', {}, element('32.492.176', {}, hud)), false);
svgTitle.tagName = 'title'; nodes = [svgTitle];
assert.equal(ctx.read(w), 32492176, 'Título SVG não tem retângulo, mas seu controle pai tem');
nodes = [element('0', { title: 'Zeny' }, hud)];
assert.equal(ctx.read(w), 0);
nodes = [element('99.000.000', { title: 'Zeny' }, hud, false)];
bodyText = 'Chat: Zeny 99.000.000\nComprar número — 500.000z';
assert.ok(Number.isNaN(ctx.read(w)), 'Não usar HUD oculta, chat ou preço da rifa');
nodes = []; hudText = 'HP 100%\nZeny\n32.492.176\nPeso 3.751/6.000';
assert.equal(ctx.read(w), 32492176, 'HUD expandida continua aceita');
hudText = '';
for (const invalid of ['.', '1.234,00', '500.000z por número', '32.492.176 / 6.000', '9007199254740992']) {
  nodes = [element(invalid, { title: 'Zeny' }, hud)];
  assert.ok(Number.isNaN(ctx.read(w)), invalid);
}
console.log('OK: saldo no ícone/irmão, SVG, aria-describedby, valor zero e HUD expandida; rejeita preço, chat e números ambíguos.');
