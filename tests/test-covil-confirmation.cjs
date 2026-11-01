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

let now = 100000, kills = 0, exits = 0, entries = 0, removals = 0;
let map = '1@tower', radar = [], exitOk = true;
const alvo = { mobId: 1312, nome: 'Turtle General', tier: 4 };
const cfg = { ligado: true, covil: { ligado: true, mobId: 1312, hoje: 0, total: 0 } };
// Com pedras disponíveis, a versão anterior tentava reinvocar e saía se
// o novo MVP demorasse a aparecer. Não desabilitar essa via só no teste.
const covil = { dentro: true, entrouEm: now - 30000, viu: true, viuEm: now - 2000, gid: 42 };
const mob = { _job: 1312 };
const manager = { get: () => mob, removeLife: () => { removals++; } };
const w = { __elragEngine: { getAutopilotRadarSnapshot: () => ({ mobs: radar }) } };
const context = {
  Date: { now: () => now }, WeakSet, cfg, covil, ocupado: false,
  covilAlvo: () => alvo, posicao: () => ({ mapa: map }),
  carregarEntidadesNpc: async () => manager, autopilotLigado: () => true,
  ligarAutopilot: () => {}, etapa: () => {}, log: () => {},
  contarCovil: () => { kills++; }, sairDoCovil: async () => { exits++; return exitOk; },
  entrarNoCovil: async () => { entries++; map = '1@tower'; return true; },
  lerMochila: async () => {}, itensMochila: () => Array(6).fill({}),
  pedraDoCovil: () => '', quantosNaMochila: () => 20, precisaVender: () => false,
};
vm.createContext(context);
vm.runInContext(
  section('  const COVIL_SEM_MVP_MS =', '  const contarCovil =') +
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
  manager.removeLife(99);
  now += 8000;
  await context.rodadaCovil(w);
  assert.equal(exits, 0, 'Remoção de outro GID não é morte do MVP acompanhado');
  covil.entrouEm = now - 1000;
  manager.removeLife(42);
  now += 8000;
  await context.rodadaCovil(w);
  assert.equal(exits, 0, 'Remoção logo na entrada não encerra a tentativa');
  covil.entrouEm = now - 30000;
  manager.removeLife(42);
  const deathAt = covil.morteConfirmadaEm;
  now += 500;
  manager.removeLife(42);
  assert.equal(covil.morteConfirmadaEm, deathAt, 'Evento duplicado não reinicia a espera');
  await context.rodadaCovil(w);
  assert.equal(exits, 0, 'Espera a confirmação e o drop antes de sair');
  now += 500;
  await context.rodadaCovil(w);
  assert.equal(kills, 1, 'Conta somente a morte confirmada pelo jogo');
  assert.equal(exits, 1, 'Sai em 1 s após a confirmação');
  assert.equal(entries, 0, 'Não convoca outro MVP antes de sair, mesmo com pedras');
  assert.equal(removals, 4, 'Preserva uma chamada original por evento');

  // Uma nova instância nunca herda o abate anterior, nem após saída falhar.
  await context.rodadaCovil(w);
  assert.equal(covil.morto, false);
  assert.equal(covil.gid, 0);
  assert.equal(covil.morteConfirmadaEm, 0);
  radar = [{ mobId: 1312, gid: 77 }];
  await context.rodadaCovil(w);
  assert.equal(covil.gid, 77);
  map = 'prontera';
  await context.rodadaCovil(w);
  now += 500;
  map = '1@tower';
  await context.rodadaCovil(w);
  assert.equal(entries, 0, 'Leitura transitória fora da instância não convoca de novo');
  assert.equal(exits, 1, 'MVP vivo da tentativa nova não sofre saída herdada');

  radar = [];
  now += 30000;
  manager.removeLife(77);
  now += 1000;
  exitOk = false;
  for (let i = 0; i < 11; i++) await context.rodadaCovil(w);
  assert.equal(covil.dentro, true, 'Nem dez falhas de saída confirmam que saiu');
  assert.equal(kills, 2, 'Tentativas de saída não duplicam o abate');
  assert.equal(entries, 0, 'Não reinvoca durante falhas de saída');
  exitOk = true;
  await context.rodadaCovil(w);
  map = 'prontera';
  await context.rodadaCovil(w);
  now += 1000;
  await context.rodadaCovil(w);
  assert.equal(entries, 1, 'Próxima convocação apenas após saída estável');
  assert.equal(covil.morteConfirmadaEm, 0);
  assert.equal(covil.gid, 0);
  manager.removeLife(77);
  assert.equal(covil.morteConfirmadaEm, 0, 'Evento atrasado da tentativa anterior é ignorado');

  // Uma remoção seguida pelo reaparecimento do alvo não permite sair.
  radar = [{ mobId: 1312, gid: 88 }];
  await context.rodadaCovil(w);
  now += 30000;
  manager.removeLife(88);
  now += 1000;
  const exitsBeforeRadar = exits;
  await context.rodadaCovil(w);
  assert.equal(covil.morteConfirmadaEm, 0, 'Alvo no radar invalida a confirmação');
  assert.equal(exits, exitsBeforeRadar, 'Reaparecimento do MVP bloqueia saída');

  const entryContext = { posicao: () => ({ mapa: '1@tower' }) };
  vm.createContext(entryContext);
  vm.runInContext(section('  const emInstancia =', '  const mapaCovil =') +
    section('  const entrarNoCovil =', '  const voltarAoFarmDoCovil =') +
    '\nglobalThis.enter = entrarNoCovil;', entryContext);
  assert.equal(await entryContext.enter({}, alvo), false, 'Convocação interna é barrada antes de abrir a interface');
  console.log('OK: Covil confirma abate, sai em 1 s e não reinvoca dentro da instância.');
})().catch((e) => { console.error(e); process.exitCode = 1; });
