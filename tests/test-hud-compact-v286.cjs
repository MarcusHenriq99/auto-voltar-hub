const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
function section(a, b) {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert.ok(start >= 0 && end > start, a);
  return source.slice(start, end);
}
const context = { visivel: e => e.visible !== false };
Object.assign(context, { cfg: { rotinaLimites: true, armazem: { ligado: false }, venda: { ligado: true } },
  espacoTeimosoAte: 0, pesoTeimosoAte: 0, mochilaCheiaConfirmada: () => null, limiteSeguro: () => 70 });
vm.createContext(context);
vm.runInContext(section('  const RE_PESO =', '  const nomeBase =') +
  section('  const zenyRifa =', '  const precoBotaoRifa =') + section('  const precisaVender =', '  const autopilotLigado =') +
  '\nglobalThis.read = lerPeso; globalThis.zeny = zenyRifa; globalThis.sell = precisaVender;', context);
const node = (text, attrs = {}, visible = true) => ({ textContent: text, innerText: text, visible,
  getAttribute: name => attrs[name] ?? null, closest: () => null, isConnected: true });
let nodes = [];
const w = { document: { body: { innerText: '' }, querySelectorAll: selector =>
  selector === '[title], [aria-label]' ? nodes.filter(n => n.getAttribute('title') || n.getAttribute('aria-label')) : nodes } };
function set(items, text) { nodes = items; w.document.body.innerText = text; for (const n of items) n.ownerDocument = w.document; }
const oldNormal = node('Peso 3.420 / 6.000');
set([oldNormal], 'HP 57.876 / 57.876 100,0%\nZeny 25.146.965\nPeso 3.420 / 6.000');
assert.ok(Math.abs(context.read(w).pct - 57) < 1e-9);
assert.equal(context.zeny(w), 25146965);
assert.equal(context.sell(w), false, 'Peso abaixo de 70% não inicia venda');
// Reprodução da conta 2: rótulos visuais somem, mas os tooltips persistem.
oldNormal.visible = false;
const weight = node('4.260/6.000', { title: 'Peso: 71% do total. O que não couber na mochila será perdido' });
const money = node('25.146.965', { 'aria-label': 'Zeny' });
set([oldNormal, node('200 / 200'), node('57.876 / 57.876'), weight, money], 'HP\n100,0%\nSP\n61,4%\n25.146.965\n4.260/6.000');
assert.equal(/Peso\s*([\d.]+)\s*\/\s*([\d.]+)/.test(w.document.body.innerText), false, 'Leitura antiga falha na reprodução');
assert.equal(context.read(w).atual, 4260);
assert.equal(context.read(w).pct, 71, 'Limite de venda continua legível sem expandir HUD ou mochila');
assert.equal(context.sell(w), true, 'O mesmo gatilho de venda aceita o peso compacto acima de 70%');
context.cfg.rotinaLimites = false;
assert.equal(context.sell(w), false, 'Respeitar rotina por limite desligada');
context.cfg.rotinaLimites = true;
assert.equal(context.zeny(w), 25146965, 'Saldo da rifa continua legível no compacto');
weight.innerText = weight.textContent = '4.320/6.000';
assert.equal(context.read(w).pct, 72, 'Leitura acompanha novos drops');
set([node('5.400/6.000', { 'aria-label': 'Peso: 90% do total' }), node('0', { title: 'Zeny' })], '');
assert.equal(context.read(w).pct, 90);
assert.equal(context.zeny(w), 0);
set([node('0/6.000', { title: 'Peso: 0% do total' })], '');
assert.equal(context.read(w).pct, 0);
set([node('200/200'), node('1/57.876'), node('4.320/6.000', { title: 'Peso: 72%' }, false)], '200/200\n1/57.876');
assert.equal(context.read(w), null, 'Sem peso identificado, não usar HP ou slots');
assert.ok(Number.isNaN(context.zeny(w)), 'Sem saldo identificado, não inventar zero');
console.log('OK: peso e zeny em HUD normal/compacta; limite 70%, dados vivos, cache oculto e fontes ambíguas.');
