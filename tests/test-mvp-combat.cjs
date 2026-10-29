const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOHUNT-YGGIDLE.user.js'), 'utf8');
const start = source.indexOf('  const snapshotAp =');
const end = source.indexOf('  const golpeiEm =', start);
assert.ok(start >= 0 && end > start);

const ctx = {
  cfg: { soMvp: true }, mvpUltimoGid: 123, mvpVistoEm: 1000,
  meuAlvoGid: 123, meuGolpeEm: 1000, Date: { now: () => 2000 },
};
vm.createContext(ctx);
vm.runInContext(source.slice(start, end) + '\nglobalThis.emCombate = mvpEmCombate;', ctx);

assert.equal(ctx.emCombate({ targetGid: 123 }, 2000), true, 'MVP visivel e atacado');
assert.equal(ctx.emCombate({ targetGid: 0 }, 5000), true, 'Radar sem alvo por instantes, mas golpe recente');
assert.equal(ctx.emCombate({ targetGid: 123 }, 9000), true, 'Alvo ainda fixado durante a luta');
assert.equal(ctx.emCombate({ targetGid: 0 }, 12000), false, 'Liberar teleporte apos terminar o combate');
ctx.cfg.soMvp = false;
assert.equal(ctx.emCombate({ targetGid: 123 }, 2000), false, 'Nao interferir no farm comum');
console.log('OK: teleporte bloqueado durante combate com MVP e liberado apos a luta.');
