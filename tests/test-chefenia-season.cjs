const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', name + '-YGGIDLE.user.js'), 'utf8');
const section = (text, from, to) => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  assert.ok(start >= 0 && end > start, from);
  return text.slice(start, end);
};
const voltar = section(source('AUTOVOLTAR'), '  const textoChefenia =', '  const faseExpedicaoNoTexto =');
const hunt = source('AUTOHUNT');
const recuperar = section(hunt, '  const textoChefenia =', '  const esperarCheff =') +
  section(hunt, '  const falarArauto =', '  let apParadoDesde =');

function setup(script, options = {}) {
  let pos = { mapa: 'prontera', x: 155, y: 190 };
  let aberto = options.open !== false;
  const clicks = [], walks = [], logs = [];
  const body = {};
  const titulo = { children: [], textContent: 'Arauto da Chefenia' };
  const painel = { parentElement: body };
  titulo.parentElement = { parentElement: painel, textContent: titulo.textContent };

  const entrada = (label, mode, extra = {}) => {
    const card = { parentElement: painel, textContent: label + ' Prêmio: carta selada do chefe Entrar' };
    return {
      parentElement: { parentElement: card, textContent: 'Entrar' },
      textContent: 'Entrar',
      click() {
        clicks.push(mode);
        if (options.warp !== false) pos = { mapa: mode === 'Season' ? 'mid_volsolo' : 'moro_vol' };
      },
      ...extra,
    };
  };
  const normal = entrada('Chefenia', 'Normal');
  const season = entrada('Chefenia de Season', 'Season', options.seasonButton);
  const modoFixo = options.locked;
  const botoes = modoFixo ? [modoFixo === 'Season' ? season : normal]
    : options.regular ? [normal] : options.reversed ? [season, normal] : [normal, season];
  if (options.duplicate) botoes.push(entrada('Chefenia de Season', 'duplicado'));
  if (options.missing) botoes.splice(botoes.indexOf(season), 1);
  const escolha = modoFixo ? 'Hoje: ' + modoFixo : options.regular ? '' : 'Escolha a Chefenia de hoje';
  painel.textContent = [titulo.textContent, escolha, 'Seu tempo de Chefenia Solo hoje'].join(' ');
  painel.querySelectorAll = () => botoes;
  const npc = {
    constructor: { TYPE_NPC: 3 }, objecttype: 3, GID: 25, name: titulo.textContent, position: [154, 196],
    onMouseDown() { aberto = true; },
  };
  const entidades = { forEach(fn) { fn(npc); } };
  const engine = { setAutopilotRunning() {}, getAutopilotSnapshot: () => ({ runtimeState: 2 }) };
  const w = { __elragEngine: engine, document: { body, querySelectorAll: () => aberto ? [titulo] : [] } };
  const ctx = {
    cfg: { ligado: true }, etapa() {}, salvarCfg() {}, religarEconomia() {},
    posicao: () => pos, cancelando: () => false, textoDe: el => el.textContent || '',
    normalizar: s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    visivel: el => !el.hidden, visivelCheff: el => !el.hidden,
    esperarAte: async fn => fn(), esperarCheff: async fn => fn(),
    log: mensagem => logs.push(mensagem), segurarRetorno: (_w, mensagem) => { logs.push(mensagem); return false; },
    mapaCheffenia: mapa => /^(?:mid_vol|moro_vol)/.test(mapa),
    validarChegadaFarm: () => pos.mapa !== 'prontera',
    carregarEntidadesNpc: async () => entidades,
    carregarCaminhadaBio4: async () => ({ andar(x, y) { walks.push([x, y]); pos = { mapa: 'prontera', x, y }; return true; } }),
    ponteNpcCheff: async () => entidades, canvasDoJogo: () => null,
    window: { top: {} }, recuperacaoCheffPendente: true, recuperacaoCheffOcupada: false, ultimaTentativaCheff: 0,
    Date: { now: () => 100000 }, personagemMorto: () => false, pausadoPelaRifa: () => false,
    renascimentoControladoPeloVoltar: () => false, AUTOPILOT_PARADO: new Set([0, 1]), poderInfernalVistoEm: 0,
  };
  vm.createContext(ctx);
  vm.runInContext(script === 'voltar'
    ? voltar + '\nglobalThis.go = entrarCheffenia;'
    : recuperar + '\nglobalThis.go = recuperarCheffenia;', ctx);
  return { go: () => ctx.go(w), clicks, walks, logs };
}

(async () => {
  for (const script of ['voltar', 'hunt']) {
    for (const [options, expected] of [
      [{}, ['Season']],
      [{ reversed: true }, ['Season']],
      [{ open: false }, ['Season']],
      [{ regular: true }, ['Normal']],
      [{ locked: 'Normal' }, ['Normal']],
      [{ locked: 'Season' }, ['Season']],
      [{ seasonButton: { disabled: true } }, []],
      [{ seasonButton: { getAttribute: () => 'true' } }, []],
      [{ seasonButton: { hidden: true } }, []],
      [{ missing: true }, []],
      [{ duplicate: true }, []],
    ]) {
      const test = setup(script, options);
      await test.go();
      assert.deepEqual(test.clicks, expected, script + ' ' + JSON.stringify(options));
      if (script === 'voltar' && options.open === false) assert.deepEqual(test.walks, [[154, 194]]);
    }
    const test = setup(script, { warp: false });
    await test.go();
    assert.deepEqual(test.clicks, ['Season']);
    assert.ok(test.logs.some(text => /(?:sem confirma|nao confirmada)/i.test(text)), script + ' aguarda chegada');
  }
  console.log('OK: Auto-voltar e Auto Hunt escolhem Season pelo cartão, aguardam chegada e respeitam entradas bloqueadas.');
})().catch(err => { console.error(err); process.exitCode = 1; });
