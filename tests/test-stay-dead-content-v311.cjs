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
  const normal = initialMap === 'prt_fild08';
  const inicio = now, deadline = now + (normal ? 23000 : 7000);
  const requests = [], saves = [], logs = [];
  let resumes = 0, originalSnapshots = 0, menuOpened = 0;
  const limiteTexto = 'Seu Autopilot já renasceu 10 vezes, o limite que você escolheu. Continuar renascendo (gasta 1 Folha de Yggdrasil) ou voltar para a cidade?';
  const advance = ms => {
    now += ms;
    if (mode === 'expelled' && now >= deadline - 1000) { map = 'prontera'; dead = false; }
    if (mode === 'automatic' && now >= deadline - 2000) dead = false;
    if (mode === 'normalOff' && now >= inicio + 10000) ctx.cfg.ligado = false;
    if (requestedAt && now >= requestedAt + 600 && mode !== 'pending') dead = false;
  };
  const request = () => { assert.equal(dead, true); assert.equal(map, initialMap); assert.ok(now >= deadline, 'Server cooldown longer than 3 s is respected'); requests.push(now); requestedAt = now; };
  const button = { dispatchEvent: event => { assert.equal(event.type, 'click'); request(); } };
  const save = { click() { saves.push(now - inicio); map = 'prontera'; dead = false; } };
  const w = {
    __elragUI: { updateEscapeSnapshot() { originalSnapshots++; } },
    __elragEngine: {
      getAutopilotSnapshot() {
        return { stopReason: mode === 'limitEngine' || mode === 'limitNoMenu' ||
          (mode === 'limitLate' && now >= inicio + 4000) ? 10 : 0 };
      },
      openEscape() {
        const conhecido = !normal || (now >= inicio + 9000 && mode !== 'normalMissing');
        w.__elragUI.updateEscapeSnapshot({
          isDead: dead,
          hasLeaf: conhecido && !['noLeaf', 'normalNoLeaf'].includes(mode),
          reviveAvailableAt: conhecido ? deadline : 0,
        });
      },
      reviveNow: mode === 'button' ? undefined : request,
      returnToSavePoint: mode === 'limitEngine' ? () => save.click() : undefined,
    },
    MouseEvent: class { constructor(type) { this.type = type; } },
    document: { body: { innerText: mode === 'limitHud' ? limiteTexto : 'Voltar ao ponto de salvamento' } },
    location: { reload() { throw Error('No reload in special content'); } },
  };
  const ctx = {
    cfg: { ligado: true }, instanciaAutoVoltar: {},
    normalizar: s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    mapaCheffenia: m => /^(moro_vol|mid_vol)/.test(m),
    posicao: () => ({ mapa: map }), covil: {}, mapaCovil: () => false,
    ocupado: false, morteConfirmada: () => dead, cancelando: () => false,
    Date: { now: () => now }, log: m => logs.push(m), etapa() {},
    sairDaEconomia: async () => {}, retomarCacada: async () => { assert.equal(dead, false); assert.equal(map, initialMap); resumes++; },
    autopilotLigado: () => false, botaoHunt: () => null, retomadaPlanejada: new WeakMap(),
    pausarCacada: async () => true, registrarDestinoFarm() {},
    abrirMenuMorte: () => { menuOpened++; },
    contarQuadros: async () => 0, espelhados: new WeakSet(),
    rotinaDaCidade: async () => assert.equal(map, 'prontera'),
    botaoPorTexto: (_doc, match) => {
      if (!dead) return null;
      if (match('Voltar ao ponto de salvamento')) return mode === 'limitNoMenu' ? null : save;
      // A HUD pode se adiantar ao estado do servidor durante a contagem.
      if ((mode === 'limitHud' || mode === 'normalDelayed' && now >= inicio + 9000 || mode === 'button' && now >= deadline)
          && match('Renascer agora (gasta 1 Folha de Yggdrasil)')) return button;
      return null;
    },
    esperar: async ms => advance(ms),
    esperarAte: async (fn, ms, step = 200) => { const until = now + ms; while (now < until) { const result = fn(); if (result) return result; advance(step); } return null; },
  };
  vm.createContext(ctx);
  vm.runInContext(section(source, '  const mapaDeRenascer =', '  let ponteMorteJanela =') +
    section(source, '  const recuperarMorteSemDialogo =', '  const abrirMenuMorte =') +
    '\nglobalThis.api={aoMorrer,mapaDeRenascer};', ctx);
  return { ctx, w, requests, saves, logs, resumes: () => resumes, snapshots: () => originalSnapshots, menuOpened: () => menuOpened };
}
(async () => {
  for (const map of ['lhz_dun04', 'lhz_dun04#instance', 'moro_vol', 'mid_volinf', 'vulcao_cheff']) {
    const t = setup('native', map);
    assert.equal(t.ctx.api.mapaDeRenascer({ mapa: map }), true);
    await t.ctx.api.aoMorrer(t.w);
    assert.deepEqual(t.saves, []);
    assert.equal(t.requests.length, 1, 'One revive request for a confirmed death');
    assert.equal(t.resumes(), 1, 'Life and same map confirmed before resuming');
    assert.ok(t.snapshots() > 0, 'Original HUD receiver is preserved');
    assert.equal(t.ctx.ocupado, false);
  }

  for (const [mode, saves, requests, resumes] of [
    ['normalDelayed', [], 1, 1],
    ['normalNoLeaf', [9000], 0, 0],
    ['normalMissing', [15000], 0, 0],
    ['normalOff', [], 0, 0],
  ]) {
    const t = setup(mode, 'prt_fild08');
    await t.ctx.api.aoMorrer(t.w);
    assert.deepEqual(t.saves, saves, mode);
    assert.equal(t.requests.length, requests, mode);
    assert.equal(t.resumes(), resumes, mode);
    assert.equal(t.ctx.ocupado, false, mode);
  }
  for (const mode of ['noLeaf', 'expelled', 'alive', 'automatic', 'button', 'pending']) {
    const t = setup(mode);
    await t.ctx.api.aoMorrer(t.w);
    if (['noLeaf', 'expelled', 'alive', 'automatic'].includes(mode)) assert.equal(t.requests.length, 0, mode);
    if (mode === 'button') assert.equal(t.requests.length, 1);
    assert.equal(t.resumes(), ['automatic', 'button'].includes(mode) ? 1 : 0, mode);
    assert.ok(!t.logs.some(m => /Voltando ao ponto de salvamento/.test(m)));
  }
  for (const [mode, when] of [['limitEngine', 0], ['limitHud', 0], ['limitLate', 4000]]) {
    for (const map of ['prt_fild08', 'lhz_dun04', 'mid_lhzinv']) {
      const t = setup(mode, map);
      await t.ctx.api.aoMorrer(t.w);
      assert.deepEqual(t.saves, [when], mode + ' on ' + map);
      assert.deepEqual(t.requests, []);
      assert.equal(t.ctx.retomadaPlanejada.get(t.w), true);
    }
  }
  const semMenu = setup('limitNoMenu');
  for (let i = 0; i < 3; i++) await semMenu.ctx.api.aoMorrer(semMenu.w);
  assert.equal(semMenu.menuOpened(), 3);
  assert.deepEqual(semMenu.saves, []);
  assert.deepEqual(semMenu.requests, []);
  assert.ok(!semMenu.logs.some(m => /reload/i.test(m)));

  // Auto Hunt may reenter after an actual map change; it cannot send the
  // character to Prontera on a death or compete with Auto-voltar for a leaf.
  let map = 'moro_vol', dead = true, entries = 0;
  const ctx = {
    posicao: () => ({ mapa: map }), personagemMorto: () => dead,
    mapaCheffenia: m => /^(moro_vol|mid_vol)/.test(m),
    renascimentoControladoPeloVoltar: () => false,
    cfg: { ligado: true }, pausadoPelaRifa: () => false,
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
  console.log('OK: wait for the server in normal and special maps, use a leaf before saving, and confirm life on the same map.');
})().catch(e => { console.error(e); process.exitCode = 1; });

