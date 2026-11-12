const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
function section(first, last) {
  const start = source.indexOf(first);
  const end = source.indexOf(last, start + 1);
  assert.ok(start >= 0 && end > start, first);
  return source.slice(start, end);
}

function setup(map, limit = 'peso') {
  let now = 200_000;
  const w = { document: { body: { innerText: '' } } };
  const calls = [];
  const noop = () => {};
  const no = () => false;
  const yes = async () => true;
  const peso = limit === 'peso' ? { pct: 75 } : { pct: 35 };
  const espacos = limit === 'slots' ? { usados: 190, max: 200 } : null;
  const context = {
    Date: { now: () => now },
    window: { top: {} },
    cfg: {
      ligado: true, rotinaLimites: true, conteudo: { modo: 'normal' },
      covil: { ligado: false }, curarNaKafra: true, ferreiro: true,
      venda: { ligado: true }, armazem: { ligado: true },
    },
    posicao: () => map ? { mapa: map, x: 2, y: 3 } : null,
    log: noop,
    etapa: noop,
    autopilotLigado: no,
    botaoHunt: no,
    retomadaPlanejada: new WeakMap(),
    pausarCacada: async () => { calls.push('pausar'); return true; },
    esperarAte: async predicate => predicate() || predicate() || predicate(),
    chaveCelula: p => [p.mapa, p.x, p.y].join(':'),
    canvasDoJogo: () => true,
    sairDaEconomia: yes,
    vendaForcada: new WeakSet(),
    lerMochila: yes,
    esperar: yes,
    lerPeso: () => peso,
    limiteSeguro: () => 70,
    fecharArmazem: yes,
    curarNaKafra: async () => { calls.push('kafra'); },
    desmantelarNoFerreiro: async () => { calls.push('ferreiro'); return false; },
    fecharFerreiro: yes,
    guardarProtegidos: async () => ({ ok: true }),
    fezReducao: new WeakSet(),
    venderItens: async () => { calls.push('vender'); return true; },
    voltarAoMapa: async () => { calls.push('voltar'); return true; },
    atualizarPainel: noop,
    jogo: () => w,
    retomadasEmCurso: new WeakSet(),
    dispensarAvisoDiario: no,
    conferirResultadoRifa: noop,
    rifaRodando: false,
    fecharLojaCash: no,
    ligarCalibracao: noop,
    instalarGanchos: noop,
    vigiarLucky: noop,
    conferirFimConteudo: noop,
    vigiarTempoConteudo: noop,
    vigiarRifa: noop,
    morteConfirmada: no,
    mapaCovil: no,
    covil: {},
    mapaDeRenascer: no,
    sincronizarMapaAtual: noop,
    posicaoInicialVista: true,
    armazemInicialConferido: true,
    avisarJanelaOculta: noop,
    conferirMapaFarm: noop,
    vigiarCidadeSemRotina: noop,
    chegadaAtrasada: null,
    recuperacao: null,
    conteudoDireto: no,
    guardarTudo: no,
    pesoLidoEm: 0,
    espacoTeimosoAte: 0,
    mochilaCheiaConfirmada: () => espacos,
    VENDA_INTERVALO_MS: 60_000,
    ultimaViagemVenda: 0,
    conferindoLimite: false,
    limiteAtualConfirmado: () => ({ peso, espacos, atingido: true }),
    precisaVender: () => peso.pct >= 70,
    viagemDeVenda: async () => { calls.push('limite'); },
    travaDeMunicao: () => true,
  };
  vm.createContext(context);
  vm.runInContext([
    section('  const TENTATIVAS_VOLTAR =', '  setInterval(() => {'),
    section('  const rotinaDaCidade =', '  let chegadaAtrasada ='),
    section('  const verificar =', '  const calibrando ='),
    'globalThis.api = { verificar, rotinaDaCidade, setVigia: v => { vigia = v; }, getVigia: () => vigia };',
  ].join('\n'), context);
  return {
    context, w, calls, ...context.api,
    setMap(next) { map = next; },
    advance(ms) { now += ms; },
  };
}

async function main() {
  const stale = { cidade: 'man_fild03', refazerCidade: true, ultimaEm: 0 };
  for (const limit of ['peso', 'slots']) {
    const t = setup('man_fild03', limit);
    t.setVigia({ ...stale });
    t.verificar();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(t.getVigia(), null, 'Descarta o Vigia de cidade fora de Prontera');
    assert.deepEqual(t.calls, ['limite'], 'Confere ' + limit + ' no mesmo ciclo');
  }

  const fora = setup('man_fild03');
  assert.equal(await fora.rotinaDaCidade(fora.w), false);
  assert.deepEqual(fora.calls, []);
  assert.equal(fora.getVigia(), null);

  const saiu = setup('prontera');
  saiu.context.desmantelarNoFerreiro = async () => {
    saiu.calls.push('ferreiro');
    saiu.setMap('man_fild03');
    return false;
  };
  assert.equal(await saiu.rotinaDaCidade(saiu.w), false);
  assert.deepEqual(saiu.calls, ['pausar', 'kafra', 'ferreiro']);
  assert.equal(saiu.getVigia(), null, 'Uma saída durante o Ferreiro não agenda nova tentativa');

  const cidade = setup('prontera');
  assert.equal(await cidade.rotinaDaCidade(cidade.w), false);
  assert.equal(cidade.getVigia()?.cidade, 'prontera');
  cidade.verificar();
  assert.deepEqual(cidade.calls, ['pausar', 'kafra', 'ferreiro']);
  cidade.advance(120_000);
  cidade.setMap(null);
  cidade.verificar();
  assert.equal(cidade.getVigia()?.cidade, 'prontera', 'Mapa indisponível durante carregamento');
  assert.deepEqual(cidade.calls, ['pausar', 'kafra', 'ferreiro']);
  cidade.setMap('prontera');
  cidade.verificar();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(cidade.calls, ['pausar', 'kafra', 'ferreiro', 'pausar', 'kafra', 'ferreiro']);
  assert.equal(cidade.getVigia()?.cidade, 'prontera');
  console.log('OK: Vigia restrito a Prontera e limites reavaliados ao sair.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
