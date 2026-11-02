const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
function extract(from, to) {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert.ok(a >= 0 && b > a, from);
  return source.slice(a, b);
}
const helpers = extract('  const precoBotaoRifa =', '  const rifaEsgotada =');
const buy = extract('  const comprarRifa =', '  const executarRifa =');

async function purchases({ lag = false, loadingLabel = false, cooldown = 1500, greenDelay = 0, losesGreen = false, saldoDelay = 0, semSaldo = false } = {}) {
  let now = 100000, balance = 3000000, tickets = [], clicks = [], pending = null, enabledAt = now;
  let greenAt = now + greenDelay;
  const debits = [];
  const record = { tentativas: 0, confirmados: 0, gasto: 0, resultado: 'Aguardando sorteio' };
  const cfg = { ligado: true, rifa: { ligado: true, premios: ['Fúria'], limiteGasto: 1500000 } };
  const advance = ms => {
    now += ms;
    if (pending && now >= pending.ticketAt && tickets.length < pending.number) tickets.push(pending.number);
    for (const debit of debits) if (now >= debit.at) balance = Math.min(balance, debit.balance);
    if (pending && now >= pending.readyAt) { enabledAt = now; greenAt = now + greenDelay; button.disabled = false; pending = null; }
  };
  const w = { document: { querySelectorAll: () => [] }, MouseEvent: class {
    constructor(type, init) { this.type = type; Object.assign(this, init); }
  } };
  w.document.defaultView = w;
  const isGreen = () => now >= greenAt && !button.disabled && !(losesGreen && now >= 100500 && now < 103000);
  w.getComputedStyle = () => ({ backgroundColor: isGreen() ? 'rgb(22, 163, 74)' : 'rgb(107, 114, 128)',
    display: 'block', visibility: 'visible', pointerEvents: 'auto', opacity: '1' });
  const button = {
    disabled: false, isConnected: true, ownerDocument: w.document, getAttribute: () => null,
    get innerText() { return loadingLabel && this.disabled ? 'Comprar número — Aguarde...' : 'Comprar número — 500.000z'; },
    click() { throw Error('Não deve usar o .click() global/por coordenadas'); },
    dispatchEvent(event) {
      assert.equal(event.type, 'click');
      assert.equal(this.disabled, false, 'Não clicar durante cooldown');
      assert.ok(isGreen(), 'Revalidar a cor imediatamente antes do clique');
      assert.ok(now >= greenAt + 600, 'Botão habilitado mas cinza não aceita compra; aguardar ficar verde e mais 0,6 s');
      assert.equal(pending, null, 'Uma compra por vez');
      if (clicks.length) assert.ok(now - clicks.at(-1) <= (lag && clicks.length === 2 ? 4700 : 2200) + greenDelay, 'Cooldown mais a pausa de estabilização não causa espera excessiva');
      assert.ok(now - enabledAt >= 600, 'Espera 0,6 s depois de o botão voltar a habilitar');
      if (clicks.length) assert.ok(now - clicks.at(-1) >= 600, 'Intervalo mínimo de 0,6 s, mesmo com botão liberado');
      clicks.push(now); this.disabled = true;
      const slow = lag && clicks.length === 2;
      pending = { number: tickets.length + 1, ticketAt: now + (slow ? 3300 : 100), readyAt: now + (slow ? 4000 : cooldown) };
      debits.push({ at: now + (lag ? (slow ? 3500 : 3000) : 100), balance: 3000000 - pending.number * 500000 });
      // No cenário de saldo atrasado a carteira anterior só chega na próxima compra.
    },
  };
  const modal = {
    get innerText() { return 'Rifa Yggidle\nPrêmio Fúria\nSeus números nesta edição\n' +
      (tickets.length ? tickets.join(' ') : 'Ainda não comprou nenhum número') + '\n' + button.innerText; },
    querySelectorAll: () => [button],
  };
  let status;
  const context = {
    cfg, rifaEstado: { compras: 0 }, rifaMenu: null, PREMIOS_RIFA: ['Fúria'], CHAVE_CFG: 'cfg',
    Date: { now: () => now }, normalizar: s => s.toLowerCase(), textoDe: x => x.innerText,
    janelaRifa: () => modal, posicao: () => ({ mapa: 'prontera' }), zenyRifa: () => semSaldo || now < 100000 + saldoDelay ? NaN : balance,
    premioMarcadoRifa: () => true, registroRifa: () => record, rifaEsgotada: () => false,
    registrarMotivoRifa: () => record,
    atualizarHistoricoRifa: () => {},
    rifaStatus: x => { status = x; }, gravarJson: () => {}, salvarCfg: () => {},
    esperar: async ms => { advance(ms); assert.ok(now < 150000, 'Loop deve terminar'); },
    esperarAte: async (fn, timeout, interval = 100) => {
      const end = now + timeout;
      while (now <= end) { const result = fn(); if (result) return result; advance(interval); }
      return null;
    },
  };
  vm.createContext(context);
  vm.runInContext(helpers + buy + '\nglobalThis.buy = comprarRifa;', context);
  await Promise.all([
    context.buy(w, { id: 'teste', inicio: 0 }, 'Fúria'),
    context.buy(w, { id: 'teste', inicio: 0 }, 'Fúria'),
  ]);
  if (semSaldo) {
    assert.equal(clicks.length, 0, 'Não enviar compra sem saldo identificado');
    assert.equal(record.tentativas, 0);
    assert.equal(cfg.rifa.ultimaEdicao, undefined, 'Falha de leitura antes do clique não consome a edição');
    assert.equal(status, 'Parada');
    assert.ok(now >= 108000 && now < 109000, 'Aguarda leitura por 8 s, sem travar indefinidamente');
    return;
  }
  assert.equal(clicks.length, 3);
  assert.equal(record.confirmados, 3);
  assert.equal(record.gasto, 1500000);
  assert.equal(record.auditoriaCompras.length, 3);
  assert.ok(record.auditoriaCompras.every(a => a.estado === 'confirmada'));
  assert.ok(record.auditoriaCompras.slice(1).every(a => a.intervaloMs >= 600));
  assert.equal(status, 'Limite atingido');
  assert.equal(cfg.rifa.ultimaEdicao, 'teste', 'Compra enviada consome edição e bloqueia repetição ambígua');
}

function scheduling() {
  let now = 1000000, starts = 0, status = '';
  const cfg = { ligado: true, rifa: { ligado: true, premios: ['Fúria'], limiteGasto: 1500000 } };
  const edition = { id: 'teste', inicio: now, abriu: true };
  const context = {
    cfg, ocupado: false, rifaRodando: false, rifaEstado: { edicao: '' },
    mapaCovil: () => false, posicao: () => ({}), covil: {},
    tentativaEntradaRifa: { id: 'teste', quantidade: 1, depois: now + 10000 },
    Date: { now: () => now }, edicaoRifaAtual: () => edition, anuncioRifa: () => 'Fúria',
    premioMarcadoRifa: () => true, rifaStatus: x => { status = x; },
    registrarMotivoRifa: () => {}, encerrarObservacoesRifa: () => {},
    executarRifa: () => { starts++; }, salvarCfg: () => {}, log: () => {},
  };
  vm.createContext(context);
  vm.runInContext(extract('  const vigiarRifa =', '  const abrirMenuRifa =') + '\nglobalThis.watch = vigiarRifa;', context);
  context.watch({}); assert.equal(starts, 0, 'Respeitar intervalo entre falhas de entrada');
  now += 10000;
  context.watch({}); assert.equal(starts, 1, 'Retentar falha anterior ao NPC');
  assert.equal(cfg.rifa.ultimaEdicao, undefined, 'Vigia não deve consumir edição antes de entrar');
  context.tentativaEntradaRifa.quantidade = 3;
  context.watch({}); assert.equal(starts, 1); assert.equal(status, 'Parada');
  context.tentativaEntradaRifa.quantidade = 0;
  cfg.rifa.ultimaEdicao = edition.id;
  context.watch({}); assert.equal(starts, 1, 'Não reiniciar compra já iniciada');
  delete cfg.rifa.ultimaEdicao;
  context.premioMarcadoRifa = () => false;
  context.watch({}); assert.equal(starts, 1, 'Respeitar prêmio desmarcado'); assert.equal(status, 'Ignorada');
}

function exclusiveWatch() {
  let clicks = 0;
  const context = {
    atualizarPainel: () => {}, jogo: () => ({}), conferirResultadoRifa: () => {},
    dispensarAvisoDiario: () => false,
    rifaRodando: true, rifaFarmPausado: true,
    botaoHunt: () => ({ click: () => { clicks++; } }),
  };
  vm.createContext(context);
  vm.runInContext(extract('  const verificar =', '    // A tela de tres mortes') + '\n}; globalThis.check = verificar;', context);
  for (let i = 0; i < 100; i++) context.check();
  assert.equal(clicks, 0, 'Vigia não pode produzir spam durante a rifa');
  let otherRoutine = 0;
  Object.assign(context, {
    rifaRodando: false, dispensarAvisoDiario: () => false, cfg: { ligado: true },
    mapaCovil: () => false, covil: {},
    fecharLojaCash: () => false, ligarCalibracao: () => {}, instalarGanchos: () => {},
    vigiarLucky: () => {}, vigiarTempoConteudo: () => {},
    vigiarRifa: () => { context.rifaRodando = true; },
    posicao: () => { otherRoutine++; return {}; },
  });
  context.check(); assert.equal(otherRoutine, 1, 'Somente consulta mapa para proteger o covil; não executa farm ao iniciar rifa');
}

function targetAndReader() {
  const context = { textoDe: x => x.innerText };
  vm.createContext(context);
  vm.runInContext(helpers + '\nglobalThis.activate = clicarControleRifa; globalThis.count = numerosCompradosRifa;', context);
  let events = 0;
  const button = { isConnected: true, disabled: false, getAttribute: () => null,
    ownerDocument: { defaultView: { MouseEvent: class {} } },
    dispatchEvent: () => { events++; }, click: () => { throw Error('Clique global'); },
  };
  assert.equal(context.activate(button), true); assert.equal(events, 1);
  button.disabled = true; assert.equal(context.activate(button), false);
  button.disabled = false; button.isConnected = false; assert.equal(context.activate(button), false);
  button.isConnected = true; button.getAttribute = () => 'true'; assert.equal(context.activate(button), false);
  assert.equal(events, 1);
  assert.equal(context.count({ innerText: 'Seus números nesta edição\n1 7\nComprando — 500.000z' }), 2);
  assert.equal(context.count({ innerText: 'Seus números nesta edição\nAinda não comprou nenhum número\nComprar número — 500.000z' }), 0);
}

(async () => {
  await purchases();
  await purchases({ loadingLabel: true });
  await purchases({ lag: true });
  await purchases({ cooldown: 100 });
  await purchases({ greenDelay: 2000 });
  await purchases({ losesGreen: true });
  await purchases({ saldoDelay: 2000 });
  await purchases({ semSaldo: true });
  scheduling(); exclusiveWatch(); targetAndReader();
  console.log('OK: compras sucessivas, cooldown, preço em carregamento, carteira atrasada, entrada limitada, prêmio e exclusão de cliques paralelos.');
})().catch(e => { console.error(e); process.exitCode = 1; });
