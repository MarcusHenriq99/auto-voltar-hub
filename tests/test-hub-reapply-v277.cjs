const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const start = source.indexOf('  // O Hub descarta os timers');
const end = source.indexOf('  const fznBypassIsTrusted =', start);
assert.ok(start > 0 && end > start);
const setup = source.slice(start, end);

function harness(hub = true) {
  const cleanups = [], intervals = new Set();
  const ctx = {
    window: {}, started: 0, weight: 69, trips: 0, removed: 0,
    document: { querySelectorAll: () => [{ remove: () => { ctx.removed++; } }] },
    setInterval: fn => { intervals.add(fn); },
  };
  if (hub) ctx.FZN_onDispose = fn => cleanups.push(fn);
  vm.createContext(ctx);
  const inject = code => vm.runInContext(`(() => { ${code}\n started++; setInterval(() => { if (weight >= 70) trips++; }, 500); })();`, ctx);
  // Mesma ordem do arnes do Hub: callbacks do script, depois corte dos timers.
  const dispose = () => { for (const fn of cleanups.splice(0)) fn(); intervals.clear(); };
  return { ctx, inject, dispose, intervals, cleanups };
}

const legacy = `if (window.__fznAutoVoltarInstancia) return; window.__fznAutoVoltarInstancia = true;`;
const h = harness();
h.inject(legacy);
h.dispose();
h.inject(legacy);
assert.equal(h.intervals.size, 0, 'Reproduz painel instalado sem timer após reaplicar v2.74');
h.ctx.weight = 73;
for (const tick of h.intervals) tick();
assert.equal(h.ctx.trips, 0, 'Mesmo com 73%, a cópia antiga não tem vigia para iniciar viagem');
h.inject(setup);
assert.equal(h.intervals.size, 1, 'Migra marcador antigo e inicia o monitor');
assert.equal(h.ctx.removed, 1, 'Remove interface antiga ao migrar');
for (const tick of h.intervals) tick();
assert.equal(h.ctx.trips, 1, 'Após reaplicar, monitor responde ao peso crítico');
h.inject(setup);
assert.equal(h.intervals.size, 1, 'Injeção duplicada sem descarte não inicia outro monitor');
const oldCleanup = h.cleanups[0];
h.dispose();
assert.equal(h.ctx.window.__fznAutoVoltarInstancia, undefined, 'Descarte libera o marcador');
h.inject(setup);
assert.equal(h.intervals.size, 1, 'Próxima atualização continua com um monitor');
const removed = h.ctx.removed;
oldCleanup();
assert.equal(h.ctx.removed, removed, 'Descarte atrasado não remove a interface nova');

const external = harness(false);
external.inject(setup); external.inject(setup);
assert.equal(external.intervals.size, 1, 'Fora do Hub mantém proteção contra duplicação');
const externalLegacy = harness(false);
externalLegacy.ctx.window.__fznAutoVoltarInstancia = true;
externalLegacy.inject(setup);
assert.equal(externalLegacy.intervals.size, 0, 'Não substitui cópia legada fora do Hub');
console.log('OK: reproduz vigia parado da v2.74 e restaura monitor único após descarte/reaplicação no Hub.');
