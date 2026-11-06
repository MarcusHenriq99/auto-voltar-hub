const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const hunt = fs.readFileSync(path.join(__dirname, '..', 'AUTOHUNT-YGGIDLE.user.js'), 'utf8');
const section = (text, from, to) => {
  const a = text.indexOf(from), b = text.indexOf(to, a);
  assert.ok(a >= 0 && b > a, from); return text.slice(a, b);
};
function setup(mode = 'native', initialMap = 'lhz_dun04') {
  let now = 100000, dead = mode !== 'alive', map = initialMap, requestedAt = 0;
  const deadline = now + 7000, requests = [], logs = [];
  let resumes = 0, originalSnapshots = 0;
  const advance = ms => {
    now += ms;
    if (mode === 'expelled' && now >= deadline - 1000) { map = 'prontera'; dead = false; }
    if (mode === 'automatic' && now >= deadline - 2000) dead = false;
    if (requestedAt && now >= requestedAt + 600 && mode !== 'pending') dead = false;
  };
  const request = () => { assert.equal(dead, true); assert.equal(map, initialMap); assert.ok(now >= deadline, 'Server cooldown longer than 3 s is respected'); requests.push(now); requestedAt = now; };
  const button = { dispatchEvent: event => { assert.equal(event.type, 'click'); request(); } };
  const w = {
    __elragUI: { updateEscapeSnapshot() { originalSnapshots++; } },
    __elragEngine: {
      openEscape() { w.__elragUI.updateEscapeSnapshot({ isDead: dead, hasLeaf: mode !== 'noLeaf', reviveAvailableAt: deadline }); },
      reviveNow: mode === 'button' ? undefined : request,
    },
    MouseEvent: class { constructor(type) { this.type = type; } },
    document: { body: { innerText: 'Voltar ao ponto de salvamento' } },
    location: { reload() { throw Error('No reload in special content'); } },
  };
  const ctx = {
    cfg: { ligado: true }, instanciaAutoVoltar: {},
    normalizar: s => s.toLowerCase(), mapaCheffenia: m => /^(moro_vol|mid_vol)/.test(m),
    posicao: () => ({ mapa: map }), covil: {}, mapaCovil: () => false,
    ocupado: false, morteConfirmada: () => dead, cancelando: () => false,
    Date: { now: () => now }, log: m => logs.push(m), etapa() {},
    sairDaEconomia: async () => {}, retomarCacada: async () => { assert.equal(dead, false); assert.equal(map, initialMap); resumes++; },
    botaoPorTexto: (_doc, match) => mode === 'button' && dead && now >= deadline && match('Renascer agora (gasta 1 Folha de Yggdrasil)') ? button : null,
    esperar: async ms => advance(ms),
    esperarAte: async (fn, ms, step = 200) => { const until = now + ms; while (now < until) { const result = fn(); if (result) return result; advance(step); } return null; },
  };
  vm.createContext(ctx);
  vm.runInContext(section(source, '  const mapaDeRenascer =', '  let ponteMorteJanela =') +
    '\nglobalThis.api={renascerNoLugar,aoMorrer,mapaDeRenascer};', ctx);
  return { ctx, w, requests, logs, resumes: () => resumes, snapshots: () => originalSnapshots };
}
(async () => {
  for (const map of ['lhz_dun04', 'lhz_dun04#instance', 'moro_vol', 'mid_volinf', 'vulcao_cheff']) {
    const t = setup('native', map);
    assert.equal(t.ctx.api.mapaDeRenascer({ mapa: map }), true);
    await t.ctx.api.aoMorrer(t.w, { click() { throw Error('Never send special-content death to save point'); } });
    assert.equal(t.requests.length, 1, 'One revive request for a confirmed death');
    assert.equal(t.resumes(), 1, 'Life and same map confirmed before resuming');
    assert.ok(t.snapshots() > 0, 'Original HUD receiver is preserved');
    assert.equal(t.ctx.ocupado, false);
  }
  for (const mode of ['noLeaf', 'expelled', 'alive', 'automatic', 'button', 'pending']) {
    const t = setup(mode);
    await t.ctx.api.renascerNoLugar(t.w);
    if (['noLeaf', 'expelled', 'alive', 'automatic'].includes(mode)) assert.equal(t.requests.length, 0, mode);
    if (mode === 'button') assert.equal(t.requests.length, 1);
    assert.equal(t.resumes(), ['automatic', 'button'].includes(mode) ? 1 : 0, mode);
    assert.ok(!t.logs.some(m => /Voltando ao ponto de salvamento/.test(m)));
  }

  // Auto Hunt may reenter after an actual map change; it cannot send the
  // character to Prontera on a death or compete with Auto-voltar for a leaf.
  let map = 'moro_vol', dead = true, entries = 0;
  const ctx = {
    posicao: () => ({ mapa: map }), personagemMorto: () => dead,
    mapaCheffenia: m => /^(moro_vol|mid_vol)/.test(m),
    renascimentoControladoPeloVoltar: () => false,
    recuperacaoCheffPendente: true, recuperacaoCheffOcupada: false, ultimaTentativaCheff: 0,
    Date: { now: () => 100000 }, window: { top: {} }, poderInfernalVistoEm: 0,
    falarArauto: async () => true, botaoCheff: (_w, match) => {
      if (match.test('Voltar ao ponto de salvamento')) throw Error('Hunt must never request save point');
      return { click() { entries++; map = 'moro_vol'; } };
    },
    esperarCheff: async fn => fn(), AUTOPILOT_PARADO: new Set([0, 1]), log() {},
  };
  vm.createContext(ctx);
  vm.runInContext(section(hunt, '  const recuperarCheffenia =', '  let apParadoDesde =') + '\nglobalThis.recover=recuperarCheffenia;', ctx);
  const w = { __elragEngine: { setAutopilotRunning() {}, getAutopilotSnapshot: () => ({ runtimeState: 2 }) } };
  await ctx.recover(w);
  assert.equal(entries, 0); assert.equal(ctx.window.top.__FZN_CHEFF_RECOVERY__.active, false);
  dead = false; map = 'prontera'; ctx.recuperacaoCheffPendente = true;
  await ctx.recover(w); assert.equal(entries, 1, 'Actual expulsion still permits NPC reentry');
  console.log('OK: wait for server cooldown, use one leaf and resume in same map; no save point/reload with missing leaf/button; Auto Hunt only reenters after real map change.');
})().catch(e => { console.error(e); process.exitCode = 1; });

