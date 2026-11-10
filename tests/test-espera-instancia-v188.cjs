const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'AUTOHUNT-YGGIDLE.user.js'), 'utf8');
const ini = source.indexOf('  const ESPERA_INSTANCIA_MS =');
const fim = source.indexOf('  // 0 = Ignorar, 1 = Fugir, 2 = Preferir.', ini);
assert.ok(ini > 0 && fim > ini);
let agora = 1000, mapa = 'prontera', timer = null;
const chamadas = [], andou = [], logs = [];
const e = {
  getMinimapInfoSnapshot: () => ({ mapId: mapa, x: 1, y: 1 }),
  setAutopilotRunning: (v) => { chamadas.push(['run', v]); return 1; },
  setAutopilotPinnedTarget: (g) => { chamadas.push(['pin', g]); return 1; },
};
const w = { __elragEngine: e, __fznAndar: (x, y) => { andou.push([x, y]); return true; } };
const ctx = {
  Date: { now: () => agora }, cfg: { ligado: true }, log: (t) => logs.push(t), jogo: () => w,
  pausadoPelaRifa: () => false, setInterval: (fn) => { timer = fn; }, String, Number,
};
vm.createContext(ctx);
vm.runInContext('const posicao = (e) => { try { const m = e.getMinimapInfoSnapshot(); return m ? { mapa: m.mapId, x: m.x, y: m.y } : null; } catch { return null; } };\n' +
  source.slice(ini, fim) + '\nglobalThis.api = { emEsperaInstancia };', ctx);
const passo = (ms = 100) => { agora += ms; timer(); };
passo();
assert.equal(ctx.api.emEsperaInstancia(), false, 'fora de instancia nao espera');
mapa = '1@tower'; passo();
assert.equal(ctx.api.emEsperaInstancia(), true, 'entrou na instancia: espera');
assert.ok(chamadas.some(c => c[0] === 'run' && c[1] === false), 'desligou o autopilot');
chamadas.length = 0;
assert.equal(e.setAutopilotRunning(true), 0, 'religar e bloqueado na espera');
assert.equal(e.setAutopilotPinnedTarget(55), 0, 'fixar alvo e bloqueado na espera');
assert.equal(w.__fznAndar(3, 4), 0, 'andar e bloqueado na espera');
assert.deepEqual(andou, []);
assert.ok(!chamadas.some(c => c[1] === true || c[1] === 55), 'nada chegou ao motor');
for (let i = 0; i < 48; i++) passo();
assert.equal(ctx.api.emEsperaInstancia(), true, 'ainda dentro dos 5 s');
passo(300);
assert.equal(ctx.api.emEsperaInstancia(), false, 'apos 5 s libera');
assert.ok(chamadas.some(c => c[0] === 'run' && c[1] === true), 'religou a cacada ao fim');
assert.ok(w.__fznAndar(1, 2), 'andar volta a funcionar');
passo(); mapa = '1@tower';
assert.equal(ctx.api.emEsperaInstancia(), false, 'continuar no mesmo mapa nao reinicia a espera');
ctx.cfg.ligado = false; mapa = 'prontera'; passo(); mapa = '2@tower'; passo();
assert.equal(ctx.api.emEsperaInstancia(), false, 'Auto Hunt desligado nao mexe');
console.log('OK: 5 s parado ao entrar em instancia, depois a cacada volta.');
