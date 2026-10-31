const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const extract = (from, to) => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Trecho ausente: ${from}`);
  return source.slice(start, end);
};
const priceSource = extract('  const precoBotaoRifa =', '  const numerosCompradosRifa =');
const buySource = extract('  const comprarRifa =', '  const executarRifa =');

async function scenario(mode) {
  let balance = 2_000_000, numbers = 0, clicks = 0, confirms = 0, status = '', waits = 0;
  const cfg = { ligado: true, rifa: { ligado: true, premios: ['Fúria do Berserker'], limiteGasto: 500_000 } };
  const record = { tentativas: 0, confirmados: 0, gasto: 0, resultado: 'Aguardando sorteio' };
  const confirmButton = {
    disabled: false, parentElement: { parentElement: { innerText: 'Confirmar compra: você vai gastar 500.000z' } },
    click() { confirms++; balance -= 500_000; numbers++; },
  };
  const buyButton = {
    disabled: false,
    click() {
      clicks++;
      if (mode === 'direct') { balance -= 500_000; numbers++; }
    },
  };
  const modal = {
    innerText: 'Rifa Yggidle\nPrêmio Fúria do Berserker\n0 de 80 números vendidos\nSeus números nesta edição\nComprar número — 500.000z',
    querySelectorAll: () => [buyButton],
  };
  const w = {
    document: { querySelectorAll: () => mode === 'legacy' ? [confirmButton] : [] },
  };
  const context = {
    cfg, rifaEstado: { premio: '', compras: 0 }, rifaMenu: null, PREMIOS_RIFA: ['Fúria do Berserker'], CHAVE_CFG: 'cfg',
    normalizar: x => x.toLowerCase(), textoDe: x => x === buyButton ? 'Comprar número — 500.000z' : 'Comprar — 500.000z',
    visivel: () => true, janelaRifa: () => modal, posicao: () => ({ mapa: 'prontera' }),
    zenyRifa: () => balance, numerosCompradosRifa: () => numbers,
    premioMarcadoRifa: () => true, registroRifa: () => record,
    rifaEsgotada: () => false, rifaStatus: (x) => { status = x; },
    gravarJson: () => {}, salvarCfg: () => {}, esperar: async () => {},
    esperarAte: async fn => {
      waits++;
      if (mode === 'delayed' && waits === 2) { balance -= 500_000; numbers++; }
      return fn();
    }, Date, Math, Number,
  };
  vm.createContext(context);
  vm.runInContext(priceSource + buySource + '\nglobalThis.buy = comprarRifa;', context);
  await context.buy(w, { inicio: Date.now() - 60_000 }, 'Fúria do Berserker');
  return { clicks, confirms, numbers, balance, record, status };
}

(async () => {
  const direct = await scenario('direct');
  assert.equal(direct.clicks, 1);
  assert.equal(direct.confirms, 0);
  assert.equal(direct.record.confirmados, 1);
  assert.equal(direct.record.gasto, 500_000);
  assert.equal(direct.status, 'Limite atingido');

  const legacy = await scenario('legacy');
  assert.equal(legacy.clicks, 1);
  assert.equal(legacy.confirms, 1);
  assert.equal(legacy.record.confirmados, 1);
  assert.equal(legacy.record.gasto, 500_000);

  const uncertain = await scenario('uncertain');
  assert.equal(uncertain.clicks, 1, 'Nao repete uma compra sem comprovante');
  assert.equal(uncertain.record.confirmados, 0);
  assert.equal(uncertain.status, 'Parada');
  const delayed = await scenario('delayed');
  assert.equal(delayed.clicks, 1, 'Compra lenta não gera segundo clique');
  assert.equal(delayed.record.confirmados, 1, 'Compra lenta entra no histórico após atualização');
  console.log('OK: compra direta, interface antiga, retorno lento, limite e falha sem repeticao.');
})().catch(error => { console.error(error); process.exitCode = 1; });
