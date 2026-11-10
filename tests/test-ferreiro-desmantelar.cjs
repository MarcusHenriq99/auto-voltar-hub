const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'AUTOVOLTAR-YGGIDLE.user.js'), 'utf8');
const start = source.indexOf('  const TITULO_FERREIRO =');
const end = source.indexOf('  const vendaNaInstancia =', start);
assert.ok(start >= 0 && end > start);

function setup(options = {}) {
  const logs = [], selected = new Set(), clicks = [];
  const body = {};
  let confirmou = 0, modalAberto = false, respostasOriginais = 0;
  const control = (text, onClick) => ({
    innerText: text, getAttribute: () => null, click: onClick,
    dispatchEvent(event) { assert.equal(event.type, 'click'); onClick(); },
  });
  const row = (name, disabled = false) => {
    const control = {
      innerText: name + '\nComum\n+4 peças',
      dispatchEvent(event) {
        assert.equal(event.type, 'click');
        clicks.push(name);
        if (!options.ignoreSelection) selected.add(control);
      },
      getAttribute(attribute) {
        if (attribute === 'role' && !options.legacy) return 'checkbox';
        if (attribute === 'aria-checked') return String(selected.has(control));
        if (attribute === 'aria-disabled') return String(disabled);
        return null;
      },
      querySelector: () => ({ getAttribute: () => name }),
      get checked() { return selected.has(control); },
      disabled,
    };
    control.parentElement = { innerText: control.innerText };
    return control;
  };
  const rows = [
    row('Manto do Vento'), row('Escudo equipado'), row('Armadura recusada', true),
    row('Anel de Teste'),
  ];
  const mochila = [
    { name: 'Manto do Vento' }, { name: 'Escudo equipado', equipado: true },
    { name: 'Armadura recusada' }, { name: 'Anel de Teste' }, { name: 'Anel de Teste', equipado: true },
  ];
  const aba = control('Mochila', () => {});
  const abrir = control('Desmantelar 1 item', () => { modalAberto = true; });
  const original = () => { respostasOriginais++; };
  const ui = { updateDismantleResult: options.semRetorno ? undefined : original };
  const voltar = control('Voltar', () => {});
  const confirmar = control(options.countWrong ? 'Desmantelar 2 itens' : 'Desmantelar 1 item', () => {
    confirmou++;
    if (!options.timeout) ui.updateDismantleResult(options.result ?? { result: 0, itemsDestroyed: 1, piecesPaid: 4 });
  });
  const modal = {
    innerText: 'Confirmar desmantelamento',
    parentElement: body, contains: () => false,
    querySelectorAll: () => [voltar, confirmar],
  };
  confirmar.parentElement = modal;
  const painel = {
    get innerText() {
      const n = selected.size;
      return 'Ferreiro — Desmantelar\nSelecionar visíveis\n' +
        (n ? n + ' item selecionado' : 'Nenhum item selecionado');
    },
    querySelector: () => rows[0],
    querySelectorAll: selector => selector === 'button' ? [aba, abrir]
      : selector === 'input[type="checkbox"]' ? [] : rows,
  };
  const w = {
    __elragUI: ui,
    document: { body, querySelectorAll: s => s === 'div, section' ? [painel]
      : modalAberto ? [abrir, voltar, confirmar] : [abrir] },
    MouseEvent: class { constructor(type) { this.type = type; } },
  };
  const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const ctx = {
    cfg: { ligado: true }, visivel: () => true, normalizar, nomeBase: normalizar,
    textoDe: el => el.innerText || '', textoTela: () => painel.innerText,
    itensMochila: () => mochila.map(item => ({ item, tipo: 'equip' })),
    lerMochila: async () => true, lerEquipados: async () => new Set(),
    nuncaGuardar: item => item.equipado, motivoProtecao: () => false,
    falarComNpc: async () => true, esperarAte: async fn => fn(), esperar: async () => {},
    cancelando: () => false, log: m => logs.push(m),
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.run=desmantelarNoFerreiro;', ctx);
  return { run: () => ctx.run(w), logs, clicks,
    confirmou: () => confirmou, respostasOriginais: () => respostasOriginais,
    ganchoRestaurado: () => ui.updateDismantleResult === original };
}

(async () => {
  for (const legacy of [false, true]) {
    const t = setup({ legacy });
    assert.equal(await t.run(), true, 'Fluxo ' + (legacy ? 'legado' : 'atual') + ': ' + t.logs.join('; '));
    assert.deepEqual(t.clicks, ['Manto do Vento']);
    assert.equal(t.confirmou(), 1);
    assert.equal(t.respostasOriginais(), 1);
    assert.ok(t.ganchoRestaurado());
    assert.match(t.logs.join('\n'), /4 Peças de Aperfeiçoamento entregues/);
  }
  for (const options of [{ countWrong: true }, { ignoreSelection: true }, { semRetorno: true }]) {
    const t = setup(options);
    assert.equal(await t.run(), false);
    assert.equal(t.confirmou(), 0);
  }
  for (const options of [
    { timeout: true }, { result: { result: -5, itemsDestroyed: 0, piecesPaid: 0 } },
    { result: { result: 0, itemsDestroyed: 1, piecesPaid: 0 } },
    { result: { result: 0, itemsDestroyed: 2, piecesPaid: 4 } },
  ]) {
    const t = setup(options);
    assert.equal(await t.run(), false);
    assert.equal(t.confirmou(), 1);
    assert.ok(t.ganchoRestaurado());
    assert.doesNotMatch(t.logs.join('\n'), /peças de aperfeiçoamento entregues/i);
  }
  console.log('OK: linhas atuais e antigas, proteção de equipamentos, confirmação exata e entrega reconhecida pelo servidor.');
})().catch(err => { console.error(err); process.exitCode = 1; });
