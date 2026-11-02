const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
let now = 100000;
const logs = [];
const context = { cfg: { ligado: true }, Date: { now: () => now }, log: s => logs.push(s),
  visivel: e => e.visible !== false && e.isConnected !== false,
  textoDe: e => e.innerText || '',
  normalizar: s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim() };
vm.createContext(context);
const start = source.indexOf('  const avisosDiarios ='), end = source.indexOf('  const PREMIOS_RIFA =', start);
assert.ok(start >= 0 && end > start);
vm.runInContext(source.slice(start, end) + '\nglobalThis.dismiss = dispensarAvisoDiario; globalThis.cash = fecharLojaCash;', context);
function scenario({ heading = 'Logue e Ganhe', checkbox = true, checked = false, hiddenCheckbox = false, ariaClose = true, delayed = false } = {}) {
  let closes = 0, toggles = 0, claims = 0;
  const body = {};
  const close = { innerText: ariaClose ? '' : 'Fechar', isConnected: true, disabled: false,
    getAttribute: name => name === 'aria-label' && ariaClose ? 'Fechar' : null,
    click: () => { throw Error('Fechar não pode usar clique global que troca o alvo'); },
    dispatchEvent: event => { assert.equal(event.type, 'click'); closes++; if (!delayed) close.isConnected = false; } };
  const claim = { innerText: 'Coletar recompensa', getAttribute: () => null, click: () => { claims++; } };
  const title = { innerText: heading, getAttribute: () => null };
  const check = { checked, visible: !hiddenCheckbox, getAttribute: () => null,
    labels: [{ innerText: 'Não mostrar novamente hoje' }], closest: () => null,
    click: () => { toggles++; check.checked = !check.checked; } };
  const panel = { innerText: heading, parentElement: body, querySelectorAll: () => [close, claim] };
  title.parentElement = check.parentElement = panel;
  const w = { MouseEvent: class { constructor(type) { this.type = type; } }, document: { body,
    querySelectorAll: selector => !close.isConnected ? [] : selector === 'input[type="checkbox"]' ? (checkbox ? [check] : []) : [title] } };
  return { w, close, check, stats: () => ({ closes, toggles, claims }) };
}
const off = scenario();
context.cfg.ligado = false;
assert.equal(context.dismiss(off.w), false, 'OFF deixa a recompensa aberta');
assert.deepEqual(off.stats(), { closes: 0, toggles: 0, claims: 0 });
assert.equal(off.check.checked, false);
assert.equal(context.dismiss({ document: { querySelectorAll: () => { throw Error('OFF nem procura controles para fechar'); } } }), false);
context.cfg.ligado = true;
assert.equal(context.dismiss(off.w), true, 'ON volta a permitir o fechamento');
assert.deepEqual(off.stats(), { closes: 1, toggles: 0, claims: 0 });
for (const checked of [false, true]) {
  const s = scenario({ heading: 'Aviso do dia', checked });
  assert.equal(context.dismiss(s.w), true);
  assert.deepEqual(s.stats(), { closes: 1, toggles: 0, claims: 0 });
  assert.equal(s.check.checked, checked, 'Preservar caixa e resgate do usuário');
  assert.equal(context.dismiss(s.w), false, 'Confirmar desaparecimento e liberar rotina');
}
const hidden = scenario({ hiddenCheckbox: true });
assert.equal(context.dismiss(hidden.w), true, 'Checkbox visualmente customizado não impede reconhecer o aviso');
assert.equal(hidden.stats().toggles, 0);
for (const heading of ['Logue e Ganhe', 'Logue & Ganhe', 'Recompensa Diária', 'Recompensas Diárias']) {
  const s = scenario({ heading, checkbox: false });
  assert.equal(context.dismiss(s.w), true, heading + ' dispensa checkbox');
  assert.deepEqual(s.stats(), { closes: 1, toggles: 0, claims: 0 });
}
const legacyClose = scenario({ ariaClose: false, checkbox: false });
assert.equal(context.dismiss(legacyClose.w), true, 'Fechar textual também funciona');
const delayed = scenario({ delayed: true });
assert.equal(context.dismiss(delayed.w), true);
for (let i = 0; i < 10; i++) assert.equal(context.dismiss(delayed.w), true);
assert.equal(delayed.stats().closes, 1, 'Não spammar enquanto a janela fecha');
now += 1500; context.dismiss(delayed.w);
assert.equal(delayed.stats().closes, 2, 'Retentar fechamento sem efeito com intervalo');
context.cfg.ligado = false;
now += 2000;
assert.equal(context.dismiss(delayed.w), false, 'Desligar suspende também a retentativa de fechamento');
assert.equal(delayed.stats().closes, 2);
context.cfg.ligado = true;
for (const heading of ['Kafra', 'Confirmar compra', 'Prêmios da rifa', 'Ferreiro', 'Chat: Logue e Ganhe']) {
  const s = scenario({ heading, checkbox: false });
  assert.equal(context.dismiss(s.w), false, heading);
  assert.deepEqual(s.stats(), { closes: 0, toggles: 0, claims: 0 });
}
let cashClosed = false;
const cashButton = { innerText: '', getAttribute: () => 'Fechar', click: () => { cashClosed = true; } };
const cashBody = {};
const cashPanel = { querySelectorAll: () => [cashButton], parentElement: cashBody };
const cashTitle = { innerText: 'YggIdle · Loja de Cash', parentElement: cashPanel };
assert.equal(context.cash({ document: { body: cashBody, querySelectorAll: () => [cashTitle] } }), true);
assert.equal(cashClosed, true);
let checkedDuringRaffle = 0;
const priority = { cfg: { ligado: true }, atualizarPainel: () => {}, jogo: () => ({}),
  dispensarAvisoDiario: () => { checkedDuringRaffle++; return true; }, rifaRodando: true,
  conferirResultadoRifa: () => { throw Error('Não agir enquanto o aviso cobre o jogo'); } };
vm.createContext(priority);
const checkStart = source.indexOf('  const verificar = () => {');
const checkEnd = source.indexOf('    if (cfg.ligado && fecharLojaCash(w))', checkStart);
vm.runInContext(source.slice(checkStart, checkEnd) + '\n}; globalThis.check = verificar;', priority);
priority.check();
assert.equal(checkedDuringRaffle, 1, 'Reset diário também é tratado durante a rifa');
priority.cfg.ligado = false;
priority.conferirResultadoRifa = () => {};
priority.check();
assert.equal(checkedDuringRaffle, 1, 'Vigia não chama fechamento no OFF, mesmo com estado de rifa pendente');
console.log('OK: fecha aviso e Logue e Ganhe sem marcar lembrete nem coletar; título exclusivo, ícone, cooldown e confirmação.');
