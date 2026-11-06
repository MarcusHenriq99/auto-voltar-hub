const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const section = (a, b) => {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert.ok(start >= 0 && end > start, a);
  return source.slice(start, end);
};
function setup(options = {}) {
  let now = 100000, current = { mapa: 'prontera', x: 155, y: 183 }, open = false, pending;
  const calls = [], blocks = [];
  const cfg = { ligado: true, conteudo: { modo: 'bio4', expiraEm: 1 }, retornoPendente: {}, caminhoBio4Alvo: '170,184' };
  const button = (label, action, disabled = false) => ({ textContent: label, disabled, click: action });
  const buttons = [button('Comprar', () => calls.push('BUY_FORBIDDEN')),
    button('Fechar', () => { calls.push('close'); open = false; })];
  if (!options.noPass) buttons.push(button(options.duo ? 'Voltar para a dupla' : options.entryLabel || 'Entrar no 4º andar', () => {
    calls.push('enter');
    if (!options.noArrival) { current = { mapa: 'lhz_dun04', x: 100, y: 100 }; open = false; }
  }, options.disabled));
  const panel = { textContent: 'Porteiro do Biolaboratório Tempo de passe O que o Porteiro oferece', querySelectorAll: () => buttons };
  const document = {
    // Actual HudPanel is portaled to body with data-hud-presentation.
    // It does NOT expose windowId as data-hud-window (v3.09 regression).
    querySelector: () => null,
    querySelectorAll: selector => selector === '[data-hud-presentation]' && open ? [panel] : [],
    body: { get innerText() { return open ? 'Porteiro do Biolaboratório Sem passe' : ''; } },
  };
  const game = { document, __elragEngine: {}, __fznBio4Caminhada: { andar(x, y) {
    calls.push(['walk', x, y]); pending = { x, y, desde: now }; return true;
  } } };
  const npc = { GID: 42, constructor: { TYPE_NPC: 7 }, objecttype: 7, position: [170, 184], onMouseDown() {
    calls.push('npc'); open = true;
  } };
  const ctx = {
    cfg, cfgLocal: false, cfgSessao: false, Date: { now: () => now },
    cancelando: () => false, salvarCfg() {}, log() {}, etapa() {},
    posicao: () => current, chaveCelula: p => `${p.mapa}:${p.x},${p.y}`,
    visivel: () => true, textoDe: b => b.textContent,
    canvasDoJogo: () => null, // No camera, focus, renderer or mouse required.
    carregarEntidadesNpc: async () => ({ forEach: fn => fn(npc) }),
    esperarAte: async (fn, ms, step = 250) => {
      const until = now + ms;
      while (now < until) {
        const result = fn(); if (result) return result;
        now += step;
        if (pending && now - pending.desde >= 250) {
          if (options.oneStepOnly) current = { mapa: 'prontera', x: 156, y: 183 };
          else if (now - pending.desde >= 750) { current = { mapa: 'prontera', x: pending.x, y: pending.y }; pending = null; }
        }
      }
      return null;
    },
    segurarRetorno: (_w, reason) => { blocks.push(reason); return false; },
    validarChegadaFarm: () => current.mapa === 'lhz_dun04',
    religarEconomia: async () => calls.push('economy'),
    botaoPorTexto: () => { throw Error('Modern dialog must never use global Entrar/Comprar'); },
  };
  vm.createContext(ctx);
  vm.runInContext(section('  const PORTEIRO_BIO4 =', '  const entrarCheffenia =') +
    '\nglobalThis.api = { aproximarPorteiro, falarComPorteiro, entrarBio4 };', ctx);
  return { ctx, game, calls, blocks, position: () => current };
}
(async () => {
  // Exercise the generated ESM bridge too, using the same packet layouts as
  // MapEngine.sendWalkRequest, without connecting to a server.
  const bridgeText = JSON.parse(source.match(/script\.textContent = ("Promise\.all\(\[import\('Network\/NetworkManager\.js'[\s\S]+?");/)[1]);
  for (const version of [20200101, 20160101]) {
    const sent = [];
    class Move { constructor() { this.dest = new Int16Array(2); this.kind = 'old'; } }
    class Move2 extends Move { constructor() { super(); this.kind = 'new'; } }
    const window = {};
    const modules = {
      'Network/NetworkManager.js': { default: { sendPacket: packet => sent.push(packet) } },
      'Network/PacketStructure.js': { default: { CZ: { REQUEST_MOVE: Move, REQUEST_MOVE2: Move2 } } },
      'Network/PacketVerManager.js': { default: { value: version } },
    };
    await vm.runInNewContext(bridgeText.replaceAll('import(', 'fakeImport('), { window, fakeImport: async name => modules[name] });
    assert.equal(window.__fznBio4Caminhada.andar(168, 181), true);
    assert.deepEqual(Array.from(sent[0].dest), [168, 181]);
    assert.equal(sent[0].kind, version >= 20180307 ? 'new' : 'old');
    assert.equal(window.__fznBio4Caminhada.andar(NaN, 181), false);
    assert.equal(window.__fznBio4Caminhada.andar(168, -1), false);
    assert.equal(sent.length, 1);
  }
  let t = setup();
  assert.equal(await t.ctx.api.entrarBio4(t.game), true);
  assert.deepEqual(t.calls, [['walk', 167, 181], 'npc', 'enter', 'economy']);
  assert.equal(t.position().mapa, 'lhz_dun04');
  assert.equal(t.ctx.cfg.retornoPendente, undefined);
  t = setup({ entryLabel: 'Entrar' });
  assert.equal(await t.ctx.api.entrarBio4(t.game), true, 'Older short label remains supported');
  t = setup({ noPass: true });
  assert.equal(await t.ctx.api.entrarBio4(t.game), false);
  assert.ok(t.calls.includes('npc') && t.calls.includes('close'));
  assert.ok(!t.calls.includes('BUY_FORBIDDEN') && !t.calls.includes('enter'));
  assert.match(t.blocks[0], /nao compro passe/);
  t = setup({ duo: true });
  assert.equal(await t.ctx.api.entrarBio4(t.game), true, 'Active duo reentry is recognized');
  t = setup({ disabled: true });
  assert.equal(await t.ctx.api.entrarBio4(t.game), false);
  assert.ok(!t.calls.includes('enter'), 'Disabled entry is not clicked');
  t = setup({ noArrival: true });
  assert.equal(await t.ctx.api.entrarBio4(t.game), false, 'Click alone is not entry success');
  assert.equal(t.calls.filter(c => c === 'enter').length, 1);
  assert.match(t.blocks[0], /sem confirmacao/);
  t = setup({ oneStepOnly: true });
  assert.equal(await t.ctx.api.aproximarPorteiro(t.game), false, 'One step does not prove arrival');
  t = setup(); t.ctx.cfg.ligado = false;
  assert.equal(await t.ctx.api.entrarBio4(t.game), false);
  assert.deepEqual(t.calls, [], 'OFF does not walk or interact');

  // Actual map change is enough; there is no need to guess the death count.
  let now = 100000, map = 'lhz_dun04';
  const ctx = {
    Date: { now: () => now }, cfg: { conteudo: { modo: 'bio4' } },
    posicao: () => ({ mapa: map }), normalizar: s => s.toLowerCase(),
    mapaDoConteudo: () => 'lhz_dun04', recuperacao: null, vigia: null,
    chegadaAtrasada: null, log() {}, etapa() {},
  };
  vm.createContext(ctx);
  vm.runInContext(section('  let cidadeSemRotinaDesde =', '  let foraFarmDesde =') + '\nglobalThis.check = vigiarCidadeSemRotina;', ctx);
  ctx.check({}); assert.equal(ctx.recuperacao, null);
  map = 'prontera'; ctx.check({}); now += 1100; ctx.check({});
  assert.equal(ctx.recuperacao.retomarAutopilot, true, 'Forced return to Prontera arms recovery of selected farm');
  assert.equal(ctx.cfg.conteudo.modo, 'bio4', 'Selected content is retained');
  console.log('OK: Bio 4 walks without screen/camera, confirms NPC and map; supports new window/duo, no-pass and OFF; recovers after forced Prontera return.');
})().catch(error => { console.error(error); process.exitCode = 1; });

