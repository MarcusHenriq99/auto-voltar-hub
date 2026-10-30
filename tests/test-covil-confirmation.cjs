const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const section = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Trecho ausente: ${start}`);
  return source.slice(a, b);
};

let now = 100000, kills = 0, exits = 0;
const alvo = { mobId: 1312, nome: 'Turtle General', tier: 4 };
const cfg = { ligado: true, covil: { ligado: true, mobId: 1312, hoje: 0, total: 0 } };
const covil = { dentro: true, entrouEm: now - 30000, viu: true, viuEm: now - 2000, gid: 42, reinvocar: false };
const mob = { _job: 1312 };
const manager = { get: () => mob, removeLife: () => {} };
const w = { __elragEngine: { getAutopilotRadarSnapshot: () => ({ mobs: [] }) } };
const context = {
  Date: { now: () => now }, WeakSet, cfg, covil, ocupado: false,
  covilAlvo: () => alvo, posicao: () => ({ mapa: '1@tower' }),
  carregarEntidadesNpc: async () => manager, autopilotLigado: () => true,
  ligarAutopilot: () => {}, etapa: () => {}, log: () => {},
  COVIL_SEM_MVP_MS: 25000, COVIL_LOOT_MS: 1500, COVIL_TETO_MS: 28 * 60000,
  contarCovil: () => { kills++; }, sairDoCovil: async () => { exits++; return true; },
  pedraDoCovil: () => '', quantosNaMochila: () => 0, precisaVender: () => false,
};
vm.createContext(context);
vm.runInContext(
  section('  const emInstancia =', '  const clicarCompleto =') +
  section('  const rodadaCovil =', '  let cidadeSemRotinaDesde =') +
  '\nglobalThis.rodadaCovil = rodadaCovil;', context);

(async () => {
  await context.rodadaCovil(w);
  assert.equal(kills, 0, 'Sumir do radar por dois segundos não confirma morte');
  assert.equal(exits, 0, 'Não sai enquanto o MVP está vivo fora do radar');
  now += 30000;
  await context.rodadaCovil(w);
  assert.equal(exits, 0, 'Não sai após o aviso de 25 segundos sem radar');
  manager.removeLife(42);
  now += 1500;
  await context.rodadaCovil(w);
  assert.equal(kills, 1, 'Conta somente a morte confirmada pelo jogo');
  assert.equal(exits, 1, 'Sai após a morte confirmada e a espera do drop');
  console.log('OK: Covil espera morte confirmada; radar e timeout não expulsam o personagem.');
})().catch((e) => { console.error(e); process.exitCode = 1; });
