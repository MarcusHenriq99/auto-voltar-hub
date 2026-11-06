const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const section = (a, b) => {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert.ok(start >= 0 && end > start, a);
  return source.slice(start, end);
};
function setup() {
  let now = 100000, map = 'prontera', fail = false;
  const calls = [];
  const forbidden = name => () => { throw Error(`Bio 4 must not call ${name}`); };
  const ctx = {
    Date: { now: () => now },
    cfg: { ligado: true, conteudo: { modo: 'bio4' },
      venda: { ligado: true }, armazem: { ligado: true, tudoNoMapa: true }, ferreiro: true, comprar: true },
    ocupado: false, vigia: null, chegadaAtrasada: null,
    recuperacao: { tentativas: 0, ultimaEm: 0, retomarAutopilot: true },
    retomadaPlanejada: new Map(),
    posicao: () => ({ mapa: map, x: 155, y: 183 }),
    normalizar: s => s.toLowerCase(), cancelando: () => false,
    log() {}, etapa() {}, salvarCfg() {}, atualizarPainel() {},
    autopilotLigado: () => true, botaoHunt: () => null,
    pausarCacada: async () => { calls.push('pause'); return true; },
    sairDaEconomia: async () => calls.push('wake'),
    sairParaRifa: async () => { calls.push('prontera'); map = 'prontera'; return true; },
    entrarBio4: async () => { calls.push('porteiro'); if (fail) return false; map = 'lhz_dun04'; return true; },
    retomarCacada: async () => { assert.equal(map, 'lhz_dun04'); calls.push('resume'); },
    validarChegadaFarm: () => map === 'lhz_dun04',
    lerPeso: forbidden('weight gate'), lerMochila: forbidden('inventory refresh'),
    mochilaCheia: forbidden('slot gate'),
    espacoTeimosoAte: 0, mochilaCheiaConfirmada: forbidden('slot confirmation'),
    fecharArmazem: forbidden('storage routine'), guardarProtegidos: forbidden('storage deposit'),
    curarNaKafra: forbidden('Kafra'), venderItens: forbidden('sale'),
    desmantelarNoFerreiro: forbidden('blacksmith'), comprarItens: forbidden('supplies'),
    semMunicaoParaCacar: forbidden('ammo gate'),
  };
  vm.createContext(ctx);
  vm.runInContext(section('  const pesoSeguroParaVoltar =', '  const OCUPACAO_MAXIMA_MOCHILA =') +
    section('  const precisaVender =', '  const estadoAutopilot =') +
    section('  const viagemDeVenda =', '  const registrarDestinoFarm =') +
    section('  const voltarAoMapa =', '  const TENTATIVAS_VOLTAR =') +
    section('  const rotinaDaCidade =', '  let chegadaAtrasada =') +
    section('  const rondaDaRecuperacao =', '  const conferirChegadaAtrasada =') +
    '\nglobalThis.api={pesoSeguroParaVoltar,precisaVender,viagemDeVenda,voltarAoMapa,rotinaDaCidade,rondaDaRecuperacao};', ctx);
  return { ctx, calls, advance: () => { now += 21000; }, fail: value => { fail = value; } };
}
(async () => {
  let t = setup();
  const originalOptions = JSON.stringify([t.ctx.cfg.venda, t.ctx.cfg.armazem, t.ctx.cfg.ferreiro]);
  assert.equal(t.ctx.api.precisaVender({}), false, 'Bio 4 ignores weight/slot sale triggers');
  assert.equal(await t.ctx.api.pesoSeguroParaVoltar({}), true, 'Bio 4 does not hold for inventory/weight');
  await t.ctx.api.rondaDaRecuperacao({});
  assert.deepEqual(t.calls, ['wake', 'pause', 'porteiro', 'resume'], 'Forced Prontera return goes straight to NPC and resumes');
  assert.equal(JSON.stringify([t.ctx.cfg.venda, t.ctx.cfg.armazem, t.ctx.cfg.ferreiro]), originalOptions, 'Account options are preserved for other farm modes');
  t = setup();
  assert.equal(await t.ctx.api.rotinaDaCidade({}, true, true), true, 'Death and old city watchdog callers also bypass services');
  assert.deepEqual(t.calls, ['wake', 'pause', 'porteiro', 'resume']);
  t = setup();
  assert.equal(await t.ctx.api.viagemDeVenda({}, false), false, 'Automatic sale cannot start while farming Bio 4');
  assert.deepEqual(t.calls, []);
  assert.equal(await t.ctx.api.viagemDeVenda({}, true), true, 'Executar manually uses direct Bio 4 return');
  assert.deepEqual(t.calls, ['wake', 'pause', 'porteiro', 'resume']);
  t = setup(); t.fail(true);
  await t.ctx.api.rondaDaRecuperacao({});
  assert.ok(t.ctx.recuperacao, 'Unconfirmed entry is retried');
  assert.deepEqual(t.calls, ['wake', 'pause', 'porteiro']);
  t.advance(); t.fail(false);
  await t.ctx.api.rondaDaRecuperacao({});
  assert.deepEqual(t.calls, ['wake', 'pause', 'porteiro', 'wake', 'pause', 'porteiro', 'resume'], 'Failed entry never falls back to storage/sale');
  console.log('OK: Bio 4 bypasses storage, sale, blacksmith, supplies, weight and slots across recovery, death/city and manual execution; retries only the NPC.');
})().catch(error => { console.error(error); process.exitCode = 1; });

