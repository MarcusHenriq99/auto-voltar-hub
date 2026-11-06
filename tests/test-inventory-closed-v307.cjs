const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const extract = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
let now = 100000, requests = 0, originalCalls = 0;
const ctx = {
  Date: class extends Date { static now() { return now; } },
  cfg: { venda: { ligado: true }, armazem: { ligado: false } },
  verdadeiro: Boolean, lerJson: () => null, gravarJson() {}, salvarCfg() {}, log() {},
  visivel: () => false, lerPeso: () => null, limiteSeguro: () => 70,
  guardarTudo: () => false, pesoTeimosoAte: 0, itensVendaveis: () => true,
};
vm.createContext(ctx);
vm.runInContext(extract('  const donoGancho =', '  const normalizar =') +
  extract('  const OCUPACAO_MAXIMA_MOCHILA =', '  const estadoAutopilot =') +
  '\nglobalThis.api = { instalarGanchos, estadoLoja, lerEspacos, mochilaCheiaConfirmada, limiteAtualConfirmado, precisaVender };', ctx);
const a = ctx.api;
let capacity = 200, used = 189;
const game = {
  document: { querySelectorAll: () => [], body: { innerText: '' } },
  __elragUI: {}, // React has not registered a receiver: no inventory panel.
  __elragEngine: {
    getInventoryCapacity: () => capacity,
    requestInventorySnapshot() {
      requests++;
      game.__elragUI.updateInventorySnapshot?.({ equip: Array.from({ length: used }, (_, i) => ({ itemId: i + 1, index: i, count: 1 })) });
    },
  },
};
assert.equal(a.lerEspacos(game), null, 'First response waits for settling');
now += 800;
assert.equal(a.lerEspacos(game).max, 200, 'Capacity read with no visible panel');
assert.equal(a.precisaVender(game), false, '189/200 does not trigger');
used = 190; now += 11000; a.lerEspacos(game); now += 800;
assert.equal(a.mochilaCheiaConfirmada(game), null);
used = 191; game.__elragEngine.requestInventorySnapshot(); now += 1100;
assert.equal(a.mochilaCheiaConfirmada(game).usados, 191, 'Drops do not restart critical confirmation');
assert.equal(a.precisaVender(game), true, 'Slots trigger even without weight');
const final = a.limiteAtualConfirmado(game);
assert.equal(final.peso, null);
assert.equal(final.atingido, true, 'Final check accepts slots with no weight');
ctx.lerPeso = () => ({ pct: 5 });
assert.equal(a.limiteAtualConfirmado(game).atingido, true, 'Low weight does not veto full inventory');
ctx.cfg.rotinaLimites = false;
assert.equal(a.precisaVender(game), false, 'OFF preserved');
ctx.cfg.rotinaLimites = true;
game.__elragUI.updateInventorySnapshot = () => { originalCalls++; };
a.instalarGanchos(game); game.__elragEngine.requestInventorySnapshot();
assert.equal(originalCalls, 1, 'Late React receiver is preserved');
used = 20; game.__elragEngine.requestInventorySnapshot(); now += 800;
assert.equal(a.limiteAtualConfirmado(game).atingido, false, 'Inventory freed during refresh cancels travel');
now += 21000;
game.__elragEngine.requestInventorySnapshot = () => { requests++; };
assert.equal(a.lerEspacos(game), null, 'Expired data is not accepted');
capacity = 100; used = 95;
game.__elragUI.updateInventorySnapshot({ equip: Array.from({ length: used }, (_, i) => ({ itemId: i + 1 })) }); now += 800;
assert.equal(a.lerEspacos(game).max, 100, 'Server capacity replaces stale 200-slot setting');
assert.ok(requests >= 3);
console.log('OK: closed inventory, absent/late React receiver, 100/200 slots, ongoing drops, no/low weight, OFF and stale data.');

