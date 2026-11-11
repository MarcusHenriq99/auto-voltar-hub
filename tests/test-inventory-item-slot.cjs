const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const hunt = fs.readFileSync(path.join(__dirname, '..', 'AUTOHUNT-YGGIDLE.user.js'), 'utf8');
const voltar = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');

function trecho(fonte, inicio, fim) {
  const a = fonte.indexOf(inicio);
  const b = fonte.indexOf(fim, a + inicio.length);
  assert.ok(a >= 0 && b > a, `Trecho indisponível: ${inicio}`);
  return fonte.slice(a, b);
}

const comum = { index: 12, itemId: 601, name: 'Asa de Mosca', count: 3, canUse: true };
const gigante = { index: 23, itemId: 1280310, name: 'Asa de Mosca Gigante', count: 1, canUse: true };
const loja = { index: 12, itemId: 1280330, name: 'Loja de Bolso', count: 1, canUse: true };
const cartao = { index: 12, itemId: 12345, name: 'Cartão Kafra', count: 1, canUse: true };
const carta = { index: 12, itemId: 4001, name: 'Carta Poring', count: 1, canUse: false };

function inventario() {
  let atual = { usable: [], card: [] };
  let responder = true;
  const usos = [];
  const w = { document: {}, __elragUI: { updateInventorySnapshot() {} } };
  w.__elragEngine = {
    requestInventorySnapshot() { if (responder) w.__elragUI.updateInventorySnapshot(atual); },
    useInventoryItem(indice) { usos.push([...atual.usable, ...atual.card].find(i => i.index === indice)); },
  };
  return {
    w, usos,
    trocar(usable = [], card = []) { atual = { usable, card }; },
    suspenderLeitura() { responder = false; },
    publicar() { w.__elragEngine.requestInventorySnapshot(); },
  };
}

function montarHunt() {
  const inv = inventario();
  const ctx = vm.createContext({
    cfg: { asa: 'auto' }, Date: { now: () => 100000 },
    pausadoPelaRifa: () => false, emEsperaInstancia: () => false, sessaoCheffenia: () => false,
    modoMvpAtivo: () => false, mvpEmCombate: () => false, snapshotAp: () => ({}),
    posicao: () => ({ mapa: 'campo' }), setTimeout() {}, log() {},
  });
  vm.runInContext([
    trecho(hunt, '  const ASA_TRAVA_MS', '  const MVP_IDS'),
    trecho(hunt, '  const asa = ', '  const BIO4_IDS'),
    trecho(hunt, '  const usarAsa = ', '  setInterval(() => {'),
    'Object.assign(globalThis, { ganchoMochila, usarAsa, fugirComAsa });',
  ].join('\n'), ctx);
  ctx.ganchoMochila(inv.w);
  return {
    ...inv,
    usar: () => ctx.usarAsa(inv.w, inv.w.__elragEngine, 100000),
    fugir: () => ctx.fugirComAsa(inv.w),
  };
}

test('o mesmo slot passa da asa para uma carta após a atualização', () => {
  const jogo = montarHunt();
  jogo.trocar([comum]);
  jogo.publicar();
  jogo.trocar([], [carta]);
  jogo.publicar();
  assert.equal(jogo.usar(), false);
  assert.deepEqual(jogo.usos, []);
});

test('o Auto Hunt valida o conteúdo atual mesmo se o último retrato ficou no mapa anterior', () => {
  const jogo = montarHunt();
  jogo.trocar([comum]);
  jogo.publicar();
  jogo.trocar([], [carta]);
  assert.equal(jogo.usar(), false);
  assert.deepEqual(jogo.usos, []);
});

test('sem leitura da mochila, o Auto Hunt não usa um índice antigo', () => {
  const jogo = montarHunt();
  jogo.trocar([comum]);
  jogo.publicar();
  jogo.trocar([], [carta]);
  jogo.suspenderLeitura();
  assert.equal(jogo.usar(), false);
  assert.deepEqual(jogo.usos, []);
});

test('a fuga também verifica se a asa infinita ainda está no slot', () => {
  const jogo = montarHunt();
  jogo.trocar([{ ...gigante, index: 12 }]);
  jogo.publicar();
  jogo.trocar([], [carta]);
  jogo.fugir();
  assert.deepEqual(jogo.usos, []);
});

test('a rotina usa a asa gigante no índice atual e ignora cartas', () => {
  const jogo = montarHunt();
  jogo.trocar([{ ...comum, index: 18 }, gigante], [{ ...carta, name: 'Asa de Mosca Gigante' }]);
  assert.equal(jogo.usar(), true);
  assert.deepEqual(jogo.usos, [gigante]);
});

function montarVoltar() {
  const inv = inventario();
  const estadoLoja = { mochila: null, mochilaSeq: 0 };
  inv.w.__elragUI.updateInventorySnapshot = (snap) => { estadoLoja.mochila = snap; estadoLoja.mochilaSeq++; };
  const ctx = vm.createContext({
    estadoLoja, cfg: { armazem: { usarCartao: true } }, log() {}, instalarGanchos() {},
    normalizar: (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(),
    itensMochila: () => Object.values(estadoLoja.mochila || {}).flat().map(item => ({ item })),
    cartaoKafra: (item) => /Kafra/.test(item.name),
    esperar: async () => inv.trocar([], [carta]), esperarAte: async (condicao) => condicao(),
    lojaAberta: () => inv.usos.includes(loja), vendaAberta: () => inv.usos.includes(loja),
    armazemAberto: () => inv.usos.includes(cartao), botaoPorTexto() {}, fecharLoja() {},
  });
  vm.runInContext([
    trecho(voltar, '  const LOJA_BOLSO_ID', '  let bolsoNaoAbriu'),
    trecho(voltar, '  const abrirArmazem = ', '  const painelMochila'),
    'Object.assign(globalThis, { abrirLojaDeBolso, abrirVendaDeBolso, abrirArmazem });',
  ].join('\n'), ctx);
  return {
    ...inv,
    abrirCompra: () => ctx.abrirLojaDeBolso(inv.w),
    abrirVenda: () => ctx.abrirVendaDeBolso(inv.w),
    abrirKafra: () => ctx.abrirArmazem(inv.w, false),
  };
}

test('a compra de bolso revalida a mochila depois da espera de abertura', async () => {
  const jogo = montarVoltar();
  jogo.trocar([loja]);
  jogo.publicar();
  assert.equal(await jogo.abrirCompra(), false);
  assert.deepEqual(jogo.usos, []);
});

test('venda e Kafra ignoram um slot reutilizado por carta', async () => {
  for (const [metodo, consumivel] of [['abrirVenda', loja], ['abrirKafra', cartao]]) {
    const jogo = montarVoltar();
    jogo.trocar([consumivel]);
    jogo.publicar();
    jogo.trocar([], [carta]);
    assert.equal(await jogo[metodo](), false);
    assert.deepEqual(jogo.usos, []);
  }
});

test('venda e Kafra usam o consumível correto quando está presente', async () => {
  for (const [metodo, consumivel] of [['abrirVenda', loja], ['abrirKafra', cartao]]) {
    const jogo = montarVoltar();
    jogo.trocar([consumivel]);
    assert.equal(await jogo[metodo](), true);
    assert.deepEqual(jogo.usos, [consumivel]);
  }
});
