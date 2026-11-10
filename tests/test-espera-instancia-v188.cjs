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
// v1.90: as funcoes do motor NAO sao embrulhadas (o embrulho se empilhava ate estourar a pilha)
const runOrig = e.setAutopilotRunning;
for (let i = 0; i < 30; i++) passo(10);
assert.equal(e.setAutopilotRunning, runOrig, 'setAutopilotRunning continua sendo a funcao do jogo');
chamadas.length = 0;
e.setAutopilotRunning(true);
passo(400);
assert.equal(chamadas[chamadas.length - 1][1], false, 'quem religar na espera e desligado de novo em ate 400 ms');
for (let i = 0; i < 41; i++) passo();
assert.equal(ctx.api.emEsperaInstancia(), true, 'ainda dentro dos 5 s');
passo(300);
assert.equal(ctx.api.emEsperaInstancia(), false, 'apos 5 s libera');
assert.ok(chamadas.some(c => c[0] === 'run' && c[1] === true), 'religou a cacada ao fim');
passo(); mapa = '1@tower';
assert.equal(ctx.api.emEsperaInstancia(), false, 'continuar no mesmo mapa nao reinicia a espera');
ctx.cfg.ligado = false; mapa = 'prontera'; passo(); mapa = '2@tower'; passo();
assert.equal(ctx.api.emEsperaInstancia(), false, 'Auto Hunt desligado nao mexe');
console.log('OK: 5 s parado ao entrar em instancia, depois a cacada volta.');
const n = source.indexOf('  const explorarNoMotor = async');
assert.ok(/if \(ehInstancia\(pos\.mapa\)\)[\s\S]{0,300}return false;/.test(source.slice(n, n + 1500)), 'v1.89: explorar nunca anda em instancia');
console.log('OK: sem busca de monstros em instancia.');
assert.ok(!/travarNaEspera/.test(source), 'v1.90: nenhum embrulho do motor');
