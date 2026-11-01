const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
function section(a, b) { const i = source.indexOf(a), j = source.indexOf(b, i); assert.ok(i >= 0 && j > i); return source.slice(i, j); }
async function scenario(mode) {
  let now = 100000, dead = true, map = '1@tower', clicks = 0, autopilot = false, polls = 0;
  const button = { disabled: mode === 'disabled', getAttribute: () => null,
    click: () => { throw Error('Não usar click global redirecionado'); },
    dispatchEvent: event => { assert.equal(event.type, 'click'); clicks++; },
  };
  const w = { document: {}, MouseEvent: class { constructor(type) { this.type = type; } } };
  const ctx = {
    Date: { now: () => now }, covil: {}, ocupado: false,
    posicao: () => ({ mapa: map }), botaoPorTexto: () => mode === 'absent' ? null : button,
    abrirMenuMorte: () => {}, etapa: () => {}, log: () => {}, morteConfirmada: () => dead,
    huntsPausados: new WeakSet(), botaoHunt: () => null,
    autopilotLigado: () => autopilot, ligarAutopilot: () => { autopilot = true; },
    esperarAte: async (fn, timeout, step = 200) => {
      const end = now + timeout;
      while (now <= end) {
        if (clicks && !autopilot) {
          polls++;
          if (mode === 'success' && polls >= 4) dead = false;
          if (mode === 'teleported') { dead = false; map = 'prontera'; }
        }
        const result = fn(); if (result) return result;
        now += step;
      }
      return null;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(section('  const mapaCovil =', '  const gidDoMvp =') +
    section('  const aoMorrer =', '  let ponteMorteJanela =') +
    '\nglobalThis.revive = renascerNoCovil; globalThis.die = aoMorrer;', ctx);
  await ctx.revive(w);
  assert.equal(clicks, ['absent', 'disabled'].includes(mode) ? 0 : 1, 'Um único evento no controle exato');
  assert.equal(autopilot, mode === 'success', 'Só retoma com vida confirmada no mesmo mapa');
  assert.equal(ctx.covil.mortePendente, mode !== 'success');
  assert.equal(ctx.ocupado, false);
  // Mesmo que a rota genérica de morte seja chamada, nunca usa salvamento.
  await ctx.die(w, { click: () => { throw Error('Salvamento proibido após morte no covil'); } });
}
(async () => {
  for (const mode of ['success', 'absent', 'disabled', 'pending', 'teleported']) await scenario(mode);
  const ctx = { mapaCovil: () => true, posicao: () => ({ mapa: '1@tower' }), covil: {} };
  vm.createContext(ctx);
  vm.runInContext(section('  const sairParaRifa =', '  const fecharRifa =') +
    section('  const vigiarRifa =', '  const abrirMenuRifa =') +
    '\nglobalThis.leave = sairParaRifa; globalThis.watch = vigiarRifa;', ctx);
  assert.equal(await ctx.leave({}), false, 'Rifa não sai do covil');
  ctx.watch({}); // Retorna antes de observar horário ou acionar compras.
  console.log('OK: covil usa uma Folha por tentativa, confirma vida no mesmo mapa e bloqueia salvamento/rifa.');
})().catch(e => { console.error(e); process.exitCode = 1; });
